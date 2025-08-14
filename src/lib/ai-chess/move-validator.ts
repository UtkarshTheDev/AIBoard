import { Chess } from 'chess.js';

/**
 * Enhanced move validation utilities for AI chess providers
 */
export class MoveValidator {
  /**
   * Validate if a move string is in correct UCI format
   */
  static isValidUCIFormat(move: string): boolean {
    // Basic UCI format: e2e4, e7e8q (with promotion)
    const uciPattern = /^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/;
    return uciPattern.test(move);
  }

  /**
   * Validate if a move is legal in the given position
   */
  static isLegalMove(fen: string, move: string): boolean {
    try {
      const game = new Chess();
      game.load(fen);
      
      // Try to make the move
      const result = game.move(move);
      return result !== null;
    } catch (error) {
      console.warn(`[MoveValidator] Error validating move ${move} in position ${fen}:`, error);
      return false;
    }
  }

  /**
   * Extract potential moves from AI response text
   */
  static extractMovesFromText(text: string): string[] {
    const moves: string[] = [];
    
    // Look for UCI format moves
    const uciMatches = text.match(/[a-h][1-8][a-h][1-8][qrbnQRBN]?/g);
    if (uciMatches) {
      moves.push(...uciMatches);
    }
    
    // Look for algebraic notation and try to convert
    const algebraicMatches = text.match(/[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?/g);
    if (algebraicMatches) {
      // Note: Converting algebraic to UCI requires the position context
      // This is a simplified extraction - full conversion would need the Chess instance
      moves.push(...algebraicMatches.filter(move => move.length >= 2));
    }
    
    return moves;
  }

  /**
   * Find the best valid move from AI response
   */
  static findBestValidMove(fen: string, responseText: string): string | null {
    // First, try exact UCI format match
    const cleanText = responseText.trim();
    if (this.isValidUCIFormat(cleanText) && this.isLegalMove(fen, cleanText)) {
      return cleanText;
    }

    // Extract all potential moves from the text
    const potentialMoves = this.extractMovesFromText(responseText);
    
    // Test each potential move
    for (const move of potentialMoves) {
      if (this.isValidUCIFormat(move) && this.isLegalMove(fen, move)) {
        console.log(`[MoveValidator] Found valid move: ${move} from text: "${responseText}"`);
        return move;
      }
    }

    // Try to convert algebraic notation to UCI
    try {
      const game = new Chess();
      game.load(fen);
      
      for (const move of potentialMoves) {
        try {
          const result = game.move(move);
          if (result) {
            // Convert the move result back to UCI format
            const uciMove = `${result.from}${result.to}${result.promotion || ''}`;
            console.log(`[MoveValidator] Converted algebraic ${move} to UCI ${uciMove}`);
            return uciMove;
          }
        } catch {
          // Continue to next potential move
          continue;
        }
      }
    } catch (error) {
      console.warn(`[MoveValidator] Error converting algebraic notation:`, error);
    }

    return null;
  }

  /**
   * Validate and sanitize AI response
   */
  static validateAIResponse(fen: string, responseText: string): {
    isValid: boolean;
    move: string | null;
    error?: string;
  } {
    if (!responseText || typeof responseText !== 'string') {
      return {
        isValid: false,
        move: null,
        error: 'Empty or invalid response'
      };
    }

    const move = this.findBestValidMove(fen, responseText);
    
    if (move) {
      return {
        isValid: true,
        move
      };
    }

    return {
      isValid: false,
      move: null,
      error: `No valid move found in response: "${responseText}"`
    };
  }

  /**
   * Get all legal moves for a position (for fallback generation)
   */
  static getLegalMoves(fen: string): string[] {
    try {
      const game = new Chess();
      game.load(fen);
      
      return game.moves({ verbose: true }).map(move => 
        `${move.from}${move.to}${move.promotion || ''}`
      );
    } catch (error) {
      console.error(`[MoveValidator] Error getting legal moves for ${fen}:`, error);
      return [];
    }
  }

  /**
   * Get a random legal move (emergency fallback)
   */
  static getRandomLegalMove(fen: string): string | null {
    const legalMoves = this.getLegalMoves(fen);
    if (legalMoves.length === 0) {
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * legalMoves.length);
    return legalMoves[randomIndex];
  }
}
