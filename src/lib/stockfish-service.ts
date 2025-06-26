"use client"

import { StockfishAnalysis, StockfishOptions } from './hooks/useStockfish';
import { createStockfishWorker, isStockfishSupported } from './worker-utils';

export interface StockfishServiceInterface {
  isReady(): Promise<boolean>;
  analyzePosition(
    fen: string, 
    callback: (evaluation: number, bestMove: string) => void,
    depth?: number,
    timeLimit?: number
  ): Promise<void>;
  getBestMove(
    fen: string, 
    callback: (bestMove: string) => void,
    depth?: number
  ): Promise<void>;
  stop(): void;
}

/**
 * Client-side Stockfish service using Web Workers
 * This replaces the server-side API implementation
 */
export class ClientStockfishService implements StockfishServiceInterface {
  private worker: Worker | null = null;
  private isInitialized = false;
  private isEngineReady = false;
  private currentAnalysis: {
    callback: (evaluation: number, bestMove: string) => void;
    resolve: () => void;
    reject: (error: Error) => void;
  } | null = null;

  constructor() {
    this.initializeWorker();
  }

  private async initializeWorker(): Promise<void> {
    if (typeof window === 'undefined') {
      // Server-side rendering - skip initialization
      return;
    }

    try {
      // Check if Stockfish is supported
      if (!isStockfishSupported()) {
        throw new Error('Stockfish requirements not met (WebAssembly, Web Workers, or fetch not supported)');
      }

      this.worker = createStockfishWorker();
      
      this.worker.onmessage = (e) => {
        this.handleWorkerMessage(e.data);
      };

      this.worker.onerror = (error) => {
        console.error('Stockfish worker error:', error);
        this.isEngineReady = false;
        if (this.currentAnalysis) {
          this.currentAnalysis.reject(new Error('Worker error: ' + error.message));
          this.currentAnalysis = null;
        }
      };

      // Initialize the worker
      this.worker.postMessage({ type: 'init' });
      this.isInitialized = true;

    } catch (error) {
      console.error('Failed to initialize Stockfish worker:', error);
      throw new Error('Failed to initialize Stockfish: ' + (error as Error).message);
    }
  }

  private handleWorkerMessage(data: any): void {
    const { type, ...payload } = data;

    switch (type) {
      case 'ready':
        this.isEngineReady = payload.ready;
        break;

      case 'analysis':
        if (this.currentAnalysis) {
          const { evaluation, bestMove } = payload;
          this.currentAnalysis.callback(evaluation, bestMove || '');
        }
        break;

      case 'bestmove':
        if (this.currentAnalysis) {
          const { bestMove } = payload;
          this.currentAnalysis.callback(0, bestMove || '');
          this.currentAnalysis.resolve();
          this.currentAnalysis = null;
        }
        break;

      case 'error':
        console.error('Stockfish engine error:', payload.error);
        if (this.currentAnalysis) {
          this.currentAnalysis.reject(new Error(payload.error));
          this.currentAnalysis = null;
        }
        break;

      default:
        console.warn('Unknown message type from Stockfish worker:', type);
    }
  }

  async isReady(): Promise<boolean> {
    // Wait for initialization if needed
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait
    
    while (!this.isInitialized && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    return this.isInitialized && this.isEngineReady;
  }

  async analyzePosition(
    fen: string, 
    callback: (evaluation: number, bestMove: string) => void,
    depth: number = 15,
    timeLimit: number = 5000
  ): Promise<void> {
    if (!this.worker || !this.isEngineReady) {
      throw new Error('Stockfish not ready');
    }

    // Stop any ongoing analysis
    this.stop();

    return new Promise((resolve, reject) => {
      this.currentAnalysis = {
        callback,
        resolve,
        reject
      };

      // Set timeout for analysis
      const timeout = setTimeout(() => {
        if (this.currentAnalysis) {
          this.stop();
          reject(new Error('Analysis timeout'));
        }
      }, timeLimit + 1000);

      // Override resolve to clear timeout
      const originalResolve = resolve;
      this.currentAnalysis.resolve = () => {
        clearTimeout(timeout);
        originalResolve();
      };

      // Override reject to clear timeout
      const originalReject = reject;
      this.currentAnalysis.reject = (error: Error) => {
        clearTimeout(timeout);
        originalReject(error);
      };

      // Start analysis
      this.worker!.postMessage({
        type: 'analyze',
        data: { fen, depth, timeLimit }
      });
    });
  }

  async getBestMove(
    fen: string, 
    callback: (bestMove: string) => void,
    depth: number = 15
  ): Promise<void> {
    return this.analyzePosition(
      fen, 
      (evaluation, bestMove) => {
        if (bestMove) {
          callback(bestMove);
        }
      },
      depth,
      5000
    );
  }

  stop(): void {
    if (this.worker && this.currentAnalysis) {
      this.worker.postMessage({ type: 'stop' });
      this.currentAnalysis = null;
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'quit' });
      this.worker.terminate();
      this.worker = null;
    }
    this.isInitialized = false;
    this.isEngineReady = false;
    this.currentAnalysis = null;
  }
}

// Singleton instance
let stockfishServiceInstance: ClientStockfishService | null = null;

export function getStockfishService(): ClientStockfishService {
  if (!stockfishServiceInstance) {
    stockfishServiceInstance = new ClientStockfishService();
  }
  return stockfishServiceInstance;
}

// For compatibility with existing code
export const stockfishService = getStockfishService();
