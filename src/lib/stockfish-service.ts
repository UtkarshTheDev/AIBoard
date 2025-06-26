"use client"

import { StockfishAnalysis, StockfishOptions } from './hooks/useStockfish';
import { createStockfishWorker, isStockfishSupported } from './worker-utils';
import { MoveValidator } from './ai-chess/move-validator';

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

    // Optimize depth and time for high-quality play
    const safeDepth = Math.min(Math.max(depth, 12), 25); // Between 12 and 25 for stronger play
    const safeTimeLimit = Math.min(Math.max(timeLimit, 5000), 20000); // Between 5s and 20s for quality analysis

    // Stop any ongoing analysis
    this.stop();

    return new Promise((resolve, reject) => {
      this.currentAnalysis = {
        callback,
        resolve,
        reject
      };

      // Set timeout for analysis with generous buffer for quality play
      const timeout = setTimeout(() => {
        if (this.currentAnalysis) {
          console.warn(`[StockfishService] Analysis timeout after ${safeTimeLimit}ms, generating fallback move`);

          // Generate fallback move
          const fallbackMove = MoveValidator.getRandomLegalMove(fen);
          if (fallbackMove) {
            console.log(`[StockfishService] Timeout fallback move: ${fallbackMove}`);
            this.currentAnalysis.callback(0, fallbackMove);
            this.currentAnalysis.resolve();
          } else {
            this.currentAnalysis.reject(new Error('Analysis timeout and no legal moves available'));
          }
          this.currentAnalysis = null;
        }
      }, safeTimeLimit + 5000); // Extra 5 seconds buffer for quality analysis

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
        data: { fen, depth: safeDepth, timeLimit: safeTimeLimit }
      });
    });
  }

  async getBestMove(
    fen: string,
    callback: (bestMove: string) => void,
    depth: number = 18
  ): Promise<void> {
    console.log(`[StockfishService] Requesting move for position with depth ${depth}`);

    return this.analyzePosition(
      fen,
      (evaluation, bestMove) => {
        if (bestMove && bestMove !== '(none)') {
          // Validate the move before calling the callback
          if (MoveValidator.isLegalMove(fen, bestMove)) {
            console.log(`[StockfishService] Valid move found: ${bestMove} (eval: ${evaluation})`);
            callback(bestMove);
          } else {
            console.warn(`[StockfishService] Illegal move generated: ${bestMove}, generating fallback`);
            // Generate a fallback legal move
            const fallbackMove = MoveValidator.getRandomLegalMove(fen);
            if (fallbackMove) {
              console.log(`[StockfishService] Using fallback move: ${fallbackMove}`);
              callback(fallbackMove);
            } else {
              console.error(`[StockfishService] No legal moves available for position: ${fen}`);
            }
          }
        } else {
          // No move returned, try to generate a fallback
          const fallbackMove = MoveValidator.getRandomLegalMove(fen);
          if (fallbackMove) {
            console.log(`[StockfishService] No move from engine, using fallback: ${fallbackMove}`);
            callback(fallbackMove);
          } else {
            console.error(`[StockfishService] No moves available - game may be over`);
          }
        }
      },
      depth,
      Math.max(8000, depth * 400) // Increased timeout for better analysis
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
