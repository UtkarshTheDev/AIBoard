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

    // Extract the level from the model ID and map to appropriate depth for high-quality play
    let depth = 18; // Default depth for strong play
    const match = modelId.match(/stockfish-level-(\d+)/);
    if (match && match[1]) {
      const level = parseInt(match[1], 10);
      // Map level to depth with higher minimums for quality play:
      // level 1-3 = depth 12-14 (still strong but faster)
      // level 4-7 = depth 15-18 (tournament strength)
      // level 8-10 = depth 19-21 (master level)
      // level 11+ = depth 22-25 (grandmaster level)
      if (level <= 3) {
        depth = 12 + (level - 1);
      } else if (level <= 7) {
        depth = 15 + (level - 4);
      } else if (level <= 10) {
        depth = 19 + (level - 8);
      } else {
        depth = Math.min(22 + (level - 11), 25);
      }
    }

    console.log(`[StockfishProvider] Using depth ${depth} for ${modelId}`);

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