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
const electron = require('electron');
const parentPort = (electron as any).parentPort;

if (parentPort) {
  // Wait for initialization message with MessagePort
  parentPort.once('message', (event: any) => {
    // The main process sends the port as part of the message
    if (event.ports && event.ports.length > 0) {
      messagePort = event.ports[0];
      
      messagePort.on('message', async (msgEvent: { data: LLMMessage }) => {
        const msg = msgEvent.data;
        
        try {
          await handleMessage(msg);
        } catch (error) {
          sendResponse({
            type: 'error',
            payload: { error: error instanceof Error ? error.message : String(error) },
            requestId: msg.requestId,
          });
        }
      });

      messagePort.start();
    }
  });
}

async function handleMessage(message: LLMMessage): Promise<void> {
  switch (message.type) {
    case 'ping':
      sendResponse({ type: 'pong', requestId: message.requestId });
      break;

    case 'initialize':
      await initializeModel(message.payload?.modelPath);
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

async function initializeModel(modelPath?: string): Promise<void> {
  try {
    if (model && context) {
      // Model already initialized
      sendResponse({
        type: 'initialized',
        payload: { message: 'Model already initialized' },
      });
      return;
    }

    if (!modelPath) {
      throw new Error('Model path is required');
    }

    // Validate model path exists
    const fs = await import('node:fs/promises');
    try {
      await fs.access(modelPath);
    } catch {
      throw new Error(`Model file not found: ${modelPath}`);
    }

    // Dynamically import node-llama-cpp (available via @electron/llm)
    // @ts-ignore - node-llama-cpp is a transitive dependency, types may not be available
    const nodeLlamaCpp = await import('node-llama-cpp');
    getLlama = nodeLlamaCpp.getLlama;
    LlamaModel = nodeLlamaCpp.LlamaModel;
    LlamaContext = nodeLlamaCpp.LlamaContext;
    LlamaChatSession = nodeLlamaCpp.LlamaChatSession;

    // Initialize node-llama-cpp
    const llama = await getLlama();
    
    // Load the GGUF model
    model = new LlamaModel({ modelPath });
    
    // Create context
    context = new LlamaContext({ model });
    
    // Create chat session
    session = new LlamaChatSession({ context });

    sendResponse({
      type: 'initialized',
      payload: { message: 'Model initialized successfully', modelPath },
    });
  } catch (error) {
    sendResponse({
      type: 'error',
      payload: {
        error: error instanceof Error ? error.message : String(error),
      },
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

