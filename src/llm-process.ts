// node-llama-cpp is available via @electron/llm dependency
// Using dynamic import to avoid TypeScript version conflicts
let getLlama: any;
let LlamaModel: any;
let LlamaContext: any;
let LlamaChatSession: any;

// Message types for communication
interface LLMMessage {
  type: 'initialize' | 'generate' | 'cancel' | 'ping';
  payload?: any;
  requestId?: string;
}

interface LLMResponse {
  type: 'initialized' | 'chunk' | 'complete' | 'error' | 'pong';
  payload?: any;
  requestId?: string;
}

let model: any = null;
let context: any = null;
let session: any = null;
let currentGeneration: AbortController | null = null;
let messagePort: any = null;

// Initialize MessagePort communication
// In Electron utility process, we receive the MessagePort via parentPort
// The main process will send an 'init' message with the port
// parentPort is available on the process object in utility processes
const parentPort = (process as any).parentPort;

if (parentPort) {
  console.log('[LLM Process] Setting up parentPort listener');
  
  // Wait for initialization message with MessagePort
  // In Electron utility processes, postMessage sends (message, transferList)
  // The ports come in the event.ports array
  parentPort.on('message', (event: any) => {
    console.log('[LLM Process] Received message on parentPort:', event);
    
    // In Electron utility processes, ports are passed as the second argument to postMessage
    // They appear in event.ports
    const ports = event.ports || [];
    
    if (ports.length > 0) {
      console.log('[LLM Process] Setting up MessagePort');
      messagePort = ports[0];
      
      messagePort.on('message', async (msgEvent: { data: LLMMessage }) => {
        const msg = msgEvent.data;
        console.log('[LLM Process] Received message on MessagePort:', msg.type);
        
        try {
          await handleMessage(msg);
        } catch (error) {
          console.error('[LLM Process] Error handling message:', error);
          sendResponse({
            type: 'error',
            payload: { error: error instanceof Error ? error.message : String(error) },
            requestId: msg.requestId,
          });
        }
      });

      messagePort.start();
      
      // Send a ready signal back
      console.log('[LLM Process] Sending ready signal');
      sendResponse({
        type: 'pong',
        payload: { message: 'Utility process ready' },
      });
    } else {
      console.log('[LLM Process] No ports in message');
    }
  });
  
  console.log('[LLM Process] ParentPort listener set up');
} else {
  console.error('[LLM Process] parentPort not available!');
}

async function handleMessage(message: LLMMessage): Promise<void> {
  switch (message.type) {
    case 'ping':
      sendResponse({ type: 'pong', requestId: message.requestId });
      break;

    case 'initialize':
      await initializeModel(message.payload?.modelPath, message.requestId);
      break;

    case 'generate':
      await generateText(message.payload?.prompt, message.requestId);
      break;

    case 'cancel':
      cancelGeneration();
      break;

    default:
      sendResponse({
        type: 'error',
        payload: { error: `Unknown message type: ${message.type}` },
        requestId: message.requestId,
      });
  }
}

async function initializeModel(modelPath?: string, requestId?: string): Promise<void> {
  try {
    console.log('[LLM Process] initializeModel called with path:', modelPath);
    
    if (model && context) {
      // Model already initialized
      console.log('[LLM Process] Model already initialized');
      sendResponse({
        type: 'initialized',
        payload: { message: 'Model already initialized' },
        requestId,
      });
      return;
    }

    if (!modelPath) {
      throw new Error('Model path is required');
    }

    // Validate model path exists
    console.log('[LLM Process] Validating model path...');
    const fs = await import('node:fs/promises');
    try {
      await fs.access(modelPath);
      console.log('[LLM Process] Model file exists');
    } catch {
      throw new Error(`Model file not found: ${modelPath}`);
    }

    // Dynamically import node-llama-cpp (available via @electron/llm)
    console.log('[LLM Process] Importing node-llama-cpp...');
    // @ts-ignore - node-llama-cpp is a transitive dependency, types may not be available
    const nodeLlamaCpp = await import('node-llama-cpp');
    console.log('[LLM Process] node-llama-cpp imported successfully');
    
    getLlama = nodeLlamaCpp.getLlama;
    LlamaModel = nodeLlamaCpp.LlamaModel;
    LlamaContext = nodeLlamaCpp.LlamaContext;
    LlamaChatSession = nodeLlamaCpp.LlamaChatSession;

    // Initialize node-llama-cpp
    console.log('[LLM Process] Getting Llama instance...');
    const llama = await getLlama();
    console.log('[LLM Process] Llama instance obtained');
    
    // Load the GGUF model
    console.log('[LLM Process] Loading model...');
    model = new LlamaModel({ modelPath });
    console.log('[LLM Process] Model loaded');
    
    // Create context
    console.log('[LLM Process] Creating context...');
    context = new LlamaContext({ model });
    console.log('[LLM Process] Context created');
    
    // Create chat session
    console.log('[LLM Process] Creating chat session...');
    session = new LlamaChatSession({ context });
    console.log('[LLM Process] Chat session created');

    console.log('[LLM Process] Model initialization complete');
    sendResponse({
      type: 'initialized',
      payload: { message: 'Model initialized successfully', modelPath },
      requestId,
    });
  } catch (error) {
    console.error('[LLM Process] Error in initializeModel:', error);
    sendResponse({
      type: 'error',
      payload: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      requestId,
    });
  }
}

async function generateText(prompt: string, requestId?: string): Promise<void> {
  if (!session) {
    sendResponse({
      type: 'error',
      payload: { error: 'Model not initialized. Call initialize first.' },
      requestId,
    });
    return;
  }

  // Cancel any ongoing generation
  if (currentGeneration) {
    currentGeneration.abort();
  }

  currentGeneration = new AbortController();
  const signal = currentGeneration.signal;

  try {
    // Stream tokens using the chat session
    // node-llama-cpp prompt returns an async iterable
    const response = session.prompt(prompt, { signal });
    
    // Iterate over the streaming response
    for await (const chunk of response) {
      if (signal.aborted) {
        break;
      }

      // Send each token chunk to main process
      sendResponse({
        type: 'chunk',
        payload: { token: chunk, text: chunk },
        requestId,
      });
    }

    // Generation complete
    if (!signal.aborted) {
      sendResponse({
        type: 'complete',
        payload: { message: 'Generation complete' },
        requestId,
      });
    }
  } catch (error) {
    if (signal.aborted) {
      sendResponse({
        type: 'complete',
        payload: { message: 'Generation cancelled' },
        requestId,
      });
    } else {
      sendResponse({
        type: 'error',
        payload: {
          error: error instanceof Error ? error.message : String(error),
        },
        requestId,
      });
    }
  } finally {
    currentGeneration = null;
  }
}

function cancelGeneration(): void {
  if (currentGeneration) {
    currentGeneration.abort();
    currentGeneration = null;
  }
}

function sendResponse(response: LLMResponse): void {
  if (messagePort) {
    messagePort.postMessage(response);
  }
}

// Handle process errors
process.on('uncaughtException', (error) => {
  sendResponse({
    type: 'error',
    payload: { error: `Uncaught exception: ${error.message}` },
  });
});

process.on('unhandledRejection', (reason) => {
  sendResponse({
    type: 'error',
    payload: { error: `Unhandled rejection: ${String(reason)}` },
  });
});

