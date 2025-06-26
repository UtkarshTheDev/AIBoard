"use client"

import { useEffect, useState, useRef, useCallback } from 'react';
import { createStockfishWorker, isStockfishSupported } from '../worker-utils';

export interface StockfishAnalysis {
  depth: number;
  evaluation: number;
  bestMove: string | null;
  principalVariation: string[];
}

export interface StockfishOptions {
  depth?: number;
  timeLimit?: number;
}

export interface UseStockfishReturn {
  isReady: boolean;
  isAnalyzing: boolean;
  currentAnalysis: StockfishAnalysis | null;
  error: string | null;
  analyzePosition: (fen: string, options?: StockfishOptions) => Promise<void>;
  getBestMove: (fen: string, options?: StockfishOptions) => Promise<string | null>;
  stopAnalysis: () => void;
  clearError: () => void;
}

export function useStockfish(): UseStockfishReturn {
  const [isReady, setIsReady] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<StockfishAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const workerRef = useRef<Worker | null>(null);
  const analysisCallbackRef = useRef<((analysis: StockfishAnalysis) => void) | null>(null);
  const bestMoveCallbackRef = useRef<((bestMove: string | null) => void) | null>(null);
  const analysisTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Stockfish worker
  useEffect(() => {
    let mounted = true;

    const initWorker = async () => {
      try {
        // Check if Stockfish is supported
        if (!isStockfishSupported()) {
          throw new Error('Stockfish requirements not met (WebAssembly, Web Workers, or fetch not supported)');
        }

        // Create worker using utility function
        const worker = createStockfishWorker();
        workerRef.current = worker;

        // Set up message handler
        worker.onmessage = (e) => {
          if (!mounted) return;

          const { type, ...data } = e.data;

          switch (type) {
            case 'ready':
              setIsReady(data.ready);
              setError(null);
              break;

            case 'analysis':
              const analysis: StockfishAnalysis = {
                depth: data.depth,
                evaluation: data.evaluation,
                bestMove: data.bestMove,
                principalVariation: data.principalVariation || []
              };
              setCurrentAnalysis(analysis);
              
              // Call analysis callback if set
              if (analysisCallbackRef.current) {
                analysisCallbackRef.current(analysis);
              }
              break;

            case 'bestmove':
              setIsAnalyzing(false);
              
              // Call best move callback if set
              if (bestMoveCallbackRef.current) {
                bestMoveCallbackRef.current(data.bestMove);
              }
              
              // Clear timeout
              if (analysisTimeoutRef.current) {
                clearTimeout(analysisTimeoutRef.current);
                analysisTimeoutRef.current = null;
              }
              break;

            case 'error':
              setError(data.error);
              setIsAnalyzing(false);
              setIsReady(false);
              
              // Clear timeout
              if (analysisTimeoutRef.current) {
                clearTimeout(analysisTimeoutRef.current);
                analysisTimeoutRef.current = null;
              }
              break;

            default:
              console.warn('Unknown message type from Stockfish worker:', type);
          }
        };

        // Handle worker errors
        worker.onerror = (error) => {
          if (!mounted) return;
          console.error('Stockfish worker error:', error);
          setError('Stockfish worker error: ' + error.message);
          setIsReady(false);
          setIsAnalyzing(false);
        };

        // Initialize the worker
        worker.postMessage({ type: 'init' });

      } catch (error) {
        if (!mounted) return;
        console.error('Failed to create Stockfish worker:', error);
        setError('Failed to initialize Stockfish: ' + (error as Error).message);
      }
    };

    initWorker();

    return () => {
      mounted = false;
      
      // Clean up worker
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'quit' });
        workerRef.current.terminate();
        workerRef.current = null;
      }
      
      // Clear timeout
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
        analysisTimeoutRef.current = null;
      }
    };
  }, []);

  // Analyze position function
  const analyzePosition = useCallback(async (fen: string, options: StockfishOptions = {}) => {
    if (!workerRef.current || !isReady) {
      throw new Error('Stockfish not ready');
    }

    if (isAnalyzing) {
      // Stop current analysis
      workerRef.current.postMessage({ type: 'stop' });
    }

    setIsAnalyzing(true);
    setCurrentAnalysis(null);
    setError(null);

    const { depth = 15, timeLimit = 5000 } = options;

    return new Promise<void>((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not available'));
        return;
      }

      // Set up analysis callback
      analysisCallbackRef.current = (analysis: StockfishAnalysis) => {
        // Analysis updates are handled in the message handler
      };

      // Set up completion callback
      bestMoveCallbackRef.current = (bestMove: string | null) => {
        analysisCallbackRef.current = null;
        bestMoveCallbackRef.current = null;
        resolve();
      };

      // Set timeout for analysis
      analysisTimeoutRef.current = setTimeout(() => {
        if (workerRef.current) {
          workerRef.current.postMessage({ type: 'stop' });
        }
        setIsAnalyzing(false);
        analysisCallbackRef.current = null;
        bestMoveCallbackRef.current = null;
        reject(new Error('Analysis timeout'));
      }, timeLimit + 1000); // Add buffer to worker timeout

      // Start analysis
      workerRef.current.postMessage({
        type: 'analyze',
        data: { fen, depth, timeLimit }
      });
    });
  }, [isReady, isAnalyzing]);

  // Get best move function
  const getBestMove = useCallback(async (fen: string, options: StockfishOptions = {}): Promise<string | null> => {
    return new Promise((resolve, reject) => {
      analyzePosition(fen, options)
        .then(() => {
          resolve(currentAnalysis?.bestMove || null);
        })
        .catch(reject);
    });
  }, [analyzePosition, currentAnalysis]);

  // Stop analysis function
  const stopAnalysis = useCallback(() => {
    if (workerRef.current && isAnalyzing) {
      workerRef.current.postMessage({ type: 'stop' });
      setIsAnalyzing(false);
      
      // Clear callbacks and timeout
      analysisCallbackRef.current = null;
      bestMoveCallbackRef.current = null;
      
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
        analysisTimeoutRef.current = null;
      }
    }
  }, [isAnalyzing]);

  // Clear error function
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isReady,
    isAnalyzing,
    currentAnalysis,
    error,
    analyzePosition,
    getBestMove,
    stopAnalysis,
    clearError
  };
}
