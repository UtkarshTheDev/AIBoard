import { BaseAIChessProvider } from './base-provider';
import { AIRequestOptions } from '@/types/ai-chess-provider';
import { useApiStockfish } from '@/lib/hooks/useApiStockfish';

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
    let level = 10; // Default level
    const match = modelId.match(/stockfish-level-(\d+)/);
    if (match && match[1]) {
      level = parseInt(match[1], 10);
    }
    
    // Use the API Stockfish service
    // Note: This is a workaround since we can't directly access the hook here
    // In a real implementation, we would use a service directly
    const stockfishService = window.__stockfishService;
    
    if (!stockfishService) {
      throw new Error('Stockfish service not available');
    }
    
    try {
      await stockfishService.getBestMove(fen, level, callback);
    } catch (error) {
      console.error('Error getting best move from Stockfish:', error);
      throw error;
    }
  }
  
  /**
   * Check if Stockfish is available
   */
  async isReady(): Promise<boolean> {
    // We need to check if the Stockfish service is available
    // This is a workaround since we can't directly access the hook here
    const stockfishService = window.__stockfishService;
    
    if (!stockfishService) {
      return false;
    }
    
    try {
      return await stockfishService.isReady();
    } catch (error) {
      console.error('Error checking Stockfish availability:', error);
      return false;
    }
  }
}

// Add global type for stockfish service
declare global {
  interface Window {
    __stockfishService?: any;
  }
} 