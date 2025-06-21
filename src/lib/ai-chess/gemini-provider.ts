import { BaseAIChessProvider } from './base-provider';
import { AIRequestOptions } from '@/types/ai-chess-provider';
import { GoogleGenAI } from '@google/genai';

// Rate limiting settings
const RATE_LIMIT = {
  MAX_REQUESTS_PER_MINUTE: 10,
  COOLDOWN_MS: 6000, // 6 seconds between requests
};

/**
 * Gemini AI provider implementation using the official Google GenAI SDK
 */
export class GeminiProvider extends BaseAIChessProvider {
  private apiKey: string | null = null;
  private genAI: GoogleGenAI | null = null;
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private requestResetTimeout: NodeJS.Timeout | null = null;
  
  constructor() {
    super(
      'gemini',
      'Google Gemini',
      [
        {
          id: 'gemini-2.0-pro',
          name: 'Gemini 2.0 Pro',
          description: 'Google\'s Gemini 2.0 Pro model',
          strength: 'Advanced'
        },
        {
          id: 'gemini-2.0-flash',
          name: 'Gemini 2.0 Flash',
          description: 'Faster version of Gemini 2.0',
          strength: 'Fast'
        },
        {
          id: 'gemini-2.5-pro',
          name: 'Gemini 2.5 Pro',
          description: 'Google\'s most powerful Gemini model',
          strength: 'Very Advanced'
        }
      ]
    );
    
    // Reset request count every minute
    this.startRequestCountReset();
  }
  
  /**
   * Start the request count reset interval
   */
  private startRequestCountReset() {
    if (typeof window !== 'undefined') {
      this.requestResetTimeout = setInterval(() => {
        this.requestCount = 0;
      }, 60000); // Reset every minute
    }
  }
  
  /**
   * Clean up resources
   */
  public cleanup() {
    if (this.requestResetTimeout) {
      clearInterval(this.requestResetTimeout);
      this.requestResetTimeout = null;
    }
  }
  
  /**
   * Check rate limits and apply delay if needed
   */
  private async checkRateLimit(): Promise<void> {
    // Check if we've exceeded our rate limit
    if (this.requestCount >= RATE_LIMIT.MAX_REQUESTS_PER_MINUTE) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    // Calculate time since last request
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // If we need to wait, delay the request
    if (timeSinceLastRequest < RATE_LIMIT.COOLDOWN_MS) {
      const delayMs = RATE_LIMIT.COOLDOWN_MS - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    // Update request tracking
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }
  
  /**
   * Set the API key for Gemini
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
    } else {
      this.genAI = null;
    }
  }
  
  /**
   * Get the best move using Gemini
   */
  async getBestMove(
    fen: string, 
    callback: (bestMove: string) => void,
    options?: AIRequestOptions
  ): Promise<void> {
    if (!this.apiKey || !this.genAI) {
      throw new Error('Gemini API key not set');
    }
    
    const modelId = options?.modelId || 'gemini-2.0-pro';
    const temperature = options?.temperature || 0.2;
    
    try {
      // Check rate limits before making the request
      await this.checkRateLimit();
      
      // Prepare the prompt for Gemini
      const contents = [
        {
          role: 'user',
          parts: [
            {
              text: `
You are a chess engine analyzing the following position in FEN notation:
${fen}

Please analyze this position and determine the best move. You must respond with ONLY a valid UCI chess move notation (e.g., "e2e4", "g8f6").
Your response must be a single valid chess move and nothing else.

Rules:
1. The move must be legal according to chess rules for this position.
2. Provide only the move in UCI format (e.g., "e2e4").
3. Do not include any explanations, analysis, or additional text.
4. For castling, use the king's move (e.g., "e1g1" for white kingside castle).
5. For pawn promotion, include the promotion piece (e.g., "e7e8q" for promotion to queen).
`
            }
          ]
        }
      ];

      const config = {
        temperature,
        responseMimeType: 'text/plain',
      };

      // Generate content
      const response = await this.genAI.models.generateContent({
        model: modelId,
        contents,
        config,
      });
      
      // Extract text from response
      let text = '';
      if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          const part = candidate.content.parts[0];
          if (part.text) {
            text = part.text.trim();
          }
        }
      }
      
      // Validate that the response is a chess move (basic validation)
      const isMoveFormat = /^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/.test(text);
      
      if (isMoveFormat) {
        callback(text);
      } else {
        // If not a valid move format, try to extract a move from the text
        const moveMatch = text.match(/[a-h][1-8][a-h][1-8][qrbnQRBN]?/);
        if (moveMatch && moveMatch[0]) {
          // Found a valid move pattern within the text
          callback(moveMatch[0]);
        } else {
          throw new Error(`Invalid move format received from Gemini: "${text}"`);
        }
      }
    } catch (error) {
      // If we hit a rate limit error, add extra delay before retrying
      if (error instanceof Error && error.message.includes('Rate limit')) {
        this.lastRequestTime = Date.now() + 30000; // Add 30 seconds penalty
      }
      
      console.error('Gemini provider error:', error);
      throw error;
    }
  }
  
  /**
   * Check if Gemini is available
   */
  async isReady(): Promise<boolean> {
    if (!this.apiKey) return false;
    
    try {
      // Just check if we have a valid API key
      return true;
    } catch (error) {
      console.error('Error checking Gemini availability:', error);
      return false;
    }
  }
} 