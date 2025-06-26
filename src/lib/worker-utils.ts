"use client";

// Use a local implementation instead of CDN-dependent worker
const STOCKFISH_WORKER_URL = '/stockfish-local.worker.js';

export function createStockfishWorker(): Worker {
  try {
    // Check browser support first
    if (typeof window === 'undefined') {
      throw new Error('Window object not available (SSR)');
    }

    if (!('Worker' in window)) {
      throw new Error('Web Workers not supported in this browser');
    }

    if (!('WebAssembly' in window)) {
      throw new Error('WebAssembly not supported in this browser');
    }

    // Create worker with absolute URL to avoid path issues
    const workerUrl = new URL(STOCKFISH_WORKER_URL, window.location.origin).href;
    return new Worker(workerUrl);
  } catch (error) {
    console.error('Failed to create Stockfish worker:', error);
    throw new Error(`Stockfish initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if all required features are supported
 */
export function isStockfishSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'Worker' in window &&
    'WebAssembly' in window &&
    'fetch' in window
  );
}

/**
 * Check if Web Workers are supported
 */
export function isWorkerSupported(): boolean {
  return typeof Worker !== 'undefined';
}

/**
 * Get the worker URL for debugging
 */
export function getWorkerUrl(): string {
  return STOCKFISH_WORKER_URL;
}
