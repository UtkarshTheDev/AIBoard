import { BaseAIChessProvider } from './base-provider';
import { AIRequestOptions } from '@/types/ai-chess-provider';
import { getStockfishService } from '@/lib/stockfish-service';

/**
 * Stockfish AI provider implementation
 */
export class StockfishProvider extends BaseAIChessProvider {
  constructor() {
    super(
      'stockfish',
      'Stockfish',
      [
        {
          id: 'stockfish-level-1',
          name: 'Stockfish Level 1',
          description: 'Beginner level Stockfish',
          strength: 'Beginner'
        },
        {
          id: 'stockfish-level-5',
          name: 'Stockfish Level 5',
          description: 'Intermediate level Stockfish',
          strength: 'Intermediate'
        },
        {
          id: 'stockfish-level-10',
          name: 'Stockfish Level 10',
          description: 'Advanced level Stockfish',
          strength: 'Advanced'
        },
        {
          id: 'stockfish-level-20',
          name: 'Stockfish Level 20',
          description: 'Master level Stockfish',
          strength: 'Master'
        }
      ]
    );
  }
  
  /**
   * Get the best move using Stockfish
   */
  async getBestMove(
    fen: string,
    callback: (bestMove: string) => void,
    options?: AIRequestOptions
  ): Promise<void> {
    // Get the model ID or use a default
    const modelId = options?.modelId || 'stockfish-level-10';

    // Extract the level from the model ID
    let depth = 10; // Default depth
    const match = modelId.match(/stockfish-level-(\d+)/);
    if (match && match[1]) {
      depth = parseInt(match[1], 10);
    }

    // Use the client-side Stockfish service
    const stockfishService = getStockfishService();

    try {
      await stockfishService.getBestMove(fen, callback, depth);
    } catch (error) {
      console.error('Error getting best move from Stockfish:', error);
      throw error;
    }
  }
  
  /**
   * Check if Stockfish is available
   */
  async isReady(): Promise<boolean> {
    try {
      const stockfishService = getStockfishService();
      return await stockfishService.isReady();
    } catch (error) {
      console.error('Error checking Stockfish availability:', error);
      return false;
    }
  }
}