"use client"

interface StockfishResponse {
  evaluation?: number;
  bestMove?: string;
  error?: string;
}

class ApiStockfishService {
  private isReady: boolean = true;
  private currentRequest: AbortController | null = null;

  constructor() {}

  public async analyzePosition(
    fen: string, 
    callback: (evaluation: number, bestMove: string) => void,
    depth: number = 15,
    timeLimit: number = 5000
  ): Promise<void> {
    try {
      // Cancel any ongoing request
      this.stop();
      
      // Create a new abort controller for this request
      this.currentRequest = new AbortController();
      
      const response = await fetch('/api/stockfish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fen, depth, timeLimit }),
        signal: this.currentRequest.signal
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP error ${response.status}` }));
        console.error('Stockfish API error:', errorData);
        throw new Error(errorData.error || `Failed to analyze position: HTTP ${response.status}`);
      }
      
      const result: StockfishResponse = await response.json().catch(err => {
        console.error('Error parsing JSON response:', err);
        throw new Error('Failed to parse analysis result');
      });
      
      if (result.error) {
        console.error('Stockfish analysis error:', result.error);
        throw new Error(result.error);
      }
      
      if (result.bestMove) {
        callback(
          result.evaluation !== undefined ? result.evaluation : 0, 
          result.bestMove
        );
      } else {
        throw new Error('No best move found in response');
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error during Stockfish analysis:', error);
        throw error;
      }
    } finally {
      this.currentRequest = null;
    }
  }

  public async getBestMove(
    fen: string, 
    callback: (bestMove: string) => void,
    depth: number = 15
  ): Promise<void> {
    try {
      await this.analyzePosition(fen, (_, bestMove) => {
        if (bestMove) {
          callback(bestMove);
        }
      }, depth);
    } catch (error) {
      console.error('Error getting best move:', error);
      // Don't rethrow to prevent UI disruption
    }
  }

  public stop(): void {
    if (this.currentRequest) {
      try {
        this.currentRequest.abort();
      } catch (e) {
        console.error('Error aborting request:', e);
      } finally {
        this.currentRequest = null;
      }
    }
  }
}

// Export as singleton
export const apiStockfishService = new ApiStockfishService();

// For compatibility with the existing hook pattern
let apiStockfishInstance: ApiStockfishService | null = null;

export function getApiStockfishService(): ApiStockfishService {
  if (!apiStockfishInstance) {
    apiStockfishInstance = new ApiStockfishService();
  }
  return apiStockfishInstance;
} 