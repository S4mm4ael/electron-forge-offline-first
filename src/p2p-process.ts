// P2P Utility Process
// Handles libp2p networking in an isolated utility process
// Built as ESM to support libp2p (ESM-only package)

import { createLibp2p } from 'libp2p';
import { tcp } from '@libp2p/tcp';
import { mdns } from '@libp2p/mdns';
import type { Libp2p } from 'libp2p';

// Message types for communication
interface P2PMessage {
  type: 'start' | 'stop' | 'get-peer-count' | 'get-peers' | 'ping';
  payload?: any;
  requestId?: string;
}

interface P2PResponse {
  type: 'started' | 'stopped' | 'peer-count' | 'peers' | 'error' | 'pong' | 'peer-updated';
  payload?: any;
  requestId?: string;
}

let node: Libp2p | null = null;
let peerCount: number = 0;
let peerIds: string[] = [];

// Initialize communication via parentPort
const parentPort = (process as any).parentPort;

if (parentPort) {
  console.log('[P2P Process] Setting up parentPort listener');

  parentPort.on('message', async (message: P2PMessage) => {
    console.log('[P2P Process] Received message:', message.type);

    try {
      await handleMessage(message);
    } catch (error) {
      console.error('[P2P Process] Error handling message:', error);
      sendResponse({
        type: 'error',
        payload: { error: error instanceof Error ? error.message : String(error) },
        requestId: message.requestId,
      });
    }
  });

  // Send a ready signal back
  console.log('[P2P Process] Sending ready signal');
  sendResponse({
    type: 'pong',
    payload: { message: 'P2P utility process ready' },
  });

  console.log('[P2P Process] ParentPort listener set up');
} else {
  console.error('[P2P Process] parentPort not available!');
}

async function handleMessage(message: P2PMessage): Promise<void> {
  switch (message.type) {
    case 'ping':
      sendResponse({ type: 'pong', requestId: message.requestId });
      break;

    case 'start':
      await startP2PNode(message.requestId);
      break;

    case 'stop':
      await stopP2PNode(message.requestId);
      break;

    case 'get-peer-count':
      sendResponse({
        type: 'peer-count',
        payload: { count: peerCount },
        requestId: message.requestId,
      });
      break;

    case 'get-peers':
      sendResponse({
        type: 'peers',
        payload: { peers: peerIds },
        requestId: message.requestId,
      });
      break;

    default:
      sendResponse({
        type: 'error',
        payload: { error: `Unknown message type: ${message.type}` },
        requestId: message.requestId,
      });
  }
}

async function startP2PNode(requestId?: string): Promise<void> {
  try {
    if (node) {
      console.log('[P2P Process] Node already started');
      sendResponse({
        type: 'started',
        payload: { message: 'P2P node already running', peerCount },
        requestId,
      });
      return;
    }

    console.log('[P2P Process] Creating libp2p node...');

    // Create libp2p node with TCP transport and mDNS peer discovery
    node = await createLibp2p({
      addresses: {
        listen: ['/ip4/0.0.0.0/tcp/0'], // Listen on all interfaces, random port
      },
      transports: [tcp()],
      peerDiscovery: [
        mdns({
          interval: 10000, // Discover peers every 10 seconds
        }),
      ],
    });

    // Set up event listeners
    node.addEventListener('peer:discovery', (evt) => {
      const peerId = evt.detail.id.toString();
      console.log('[P2P Process] Peer discovered:', peerId);
      
      // Try to connect to discovered peer
      node?.dial(evt.detail.id).catch((err) => {
        console.log('[P2P Process] Failed to connect to peer:', err.message);
      });
    });

    node.addEventListener('peer:connect', (evt) => {
      const peerId = evt.detail.toString();
      console.log('[P2P Process] Peer connected:', peerId);
      
      if (!peerIds.includes(peerId)) {
        peerIds.push(peerId);
        peerCount = peerIds.length;
        updatePeerStatus();
      }
    });

    node.addEventListener('peer:disconnect', (evt) => {
      const peerId = evt.detail.toString();
      console.log('[P2P Process] Peer disconnected:', peerId);
      
      peerIds = peerIds.filter((id) => id !== peerId);
      peerCount = peerIds.length;
      updatePeerStatus();
    });

    // Start the node
    await node.start();
    console.log('[P2P Process] libp2p node started');
    console.log('[P2P Process] Node ID:', node.peerId.toString());
    console.log('[P2P Process] Listen addresses:', node.getMultiaddrs().map((addr) => addr.toString()));

    sendResponse({
      type: 'started',
      payload: {
        message: 'P2P node started successfully',
        peerId: node.peerId.toString(),
        addresses: node.getMultiaddrs().map((addr) => addr.toString()),
        peerCount: 0,
      },
      requestId,
    });
  } catch (error) {
    console.error('[P2P Process] Error starting P2P node:', error);
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

async function stopP2PNode(requestId?: string): Promise<void> {
  try {
    if (!node) {
      console.log('[P2P Process] Node not running');
      sendResponse({
        type: 'stopped',
        payload: { message: 'P2P node was not running' },
        requestId,
      });
      return;
    }

    console.log('[P2P Process] Stopping libp2p node...');
    await node.stop();
    node = null;
    peerCount = 0;
    peerIds = [];

    console.log('[P2P Process] libp2p node stopped');
    sendResponse({
      type: 'stopped',
      payload: { message: 'P2P node stopped successfully' },
      requestId,
    });
  } catch (error) {
    console.error('[P2P Process] Error stopping P2P node:', error);
    sendResponse({
      type: 'error',
      payload: {
        error: error instanceof Error ? error.message : String(error),
      },
      requestId,
    });
  }
}

function updatePeerStatus(): void {
  // Send peer count update to main process
  sendResponse({
    type: 'peer-updated',
    payload: {
      peerCount,
      peers: peerIds,
    },
  });
}

function sendResponse(response: P2PResponse): void {
  if (parentPort) {
    parentPort.postMessage(response);
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

