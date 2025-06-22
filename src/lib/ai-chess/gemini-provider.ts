import { BaseAIChessProvider } from './base-provider';
import { AIRequestOptions } from '@/types/ai-chess-provider';
import { GoogleGenAI } from '@google/genai';
import { Chess } from 'chess.js';
import { MoveValidator } from './move-validator';

// Model-specific rate limiting settings - OPTIMIZED FOR SPEED
const MODEL_RATE_LIMITS = {
  'gemini-2.5-flash': {
    MAX_REQUESTS_PER_MINUTE: 10, // 10 RPM for Gemini 2.5 Flash
    COOLDOWN_MS: 0, // NO ARTIFICIAL DELAY - let API handle rate limiting
    BURST_LIMIT: 10, // Allow full RPM in burst
    BURST_WINDOW_MS: 60000, // 60 second burst window
  },
  'gemini-2.0-flash-exp': {
    MAX_REQUESTS_PER_MINUTE: 15, // 15 RPM for Gemini 2.0 Flash
    COOLDOWN_MS: 0, // NO ARTIFICIAL DELAY - let API handle rate limiting
    BURST_LIMIT: 15, // Allow full RPM in burst
    BURST_WINDOW_MS: 60000, // 60 second burst window
  },
  'gemini-2.0-flash-thinking-exp-1219': {
    MAX_REQUESTS_PER_MINUTE: 15, // 15 RPM for Gemini 2.0 Flash Thinking
    COOLDOWN_MS: 0, // NO ARTIFICIAL DELAY - let API handle rate limiting
    BURST_LIMIT: 15, // Allow full RPM in burst
    BURST_WINDOW_MS: 60000, // 60 second burst window
  }
};

// Default rate limiting settings for unknown models - OPTIMIZED FOR SPEED
const DEFAULT_RATE_LIMIT = {
  MAX_REQUESTS_PER_MINUTE: 10, // Conservative default
  COOLDOWN_MS: 0, // NO ARTIFICIAL DELAY - let API handle rate limiting
  BURST_LIMIT: 10, // Allow full RPM in burst
  BURST_WINDOW_MS: 60000, // 60 second burst window
};

// Common rate limiting settings
const RATE_LIMIT_COMMON = {
  BACKOFF_MULTIPLIER: 1.5, // Exponential backoff multiplier
  MAX_BACKOFF_MS: 60000, // Maximum backoff delay (60 seconds)
  RETRY_ATTEMPTS: 3, // Number of retry attempts for rate limited requests
};

// Helper function to get rate limits for a specific model
function getModelRateLimit(modelId: string) {
  return MODEL_RATE_LIMITS[modelId as keyof typeof MODEL_RATE_LIMITS] || DEFAULT_RATE_LIMIT;
}

// Request queue interface
interface QueuedRequest {
  id: string;
  fen: string;
  callback: (bestMove: string) => void;
  options?: AIRequestOptions;
  timestamp: number;
  retryCount: number;
  resolve: (value: void) => void;
  reject: (error: Error) => void;
  gameContext?: GameContext;
  previousInvalidMove?: string;
  invalidMoveReason?: string;
}

// Game context interface for strategic enhancement
interface GameContext {
  moveHistory?: string[]; // PGN moves
  gamePhase?: 'opening' | 'middlegame' | 'endgame';
  timeControl?: 'blitz' | 'rapid' | 'classical';
  timeRemaining?: number;
  materialBalance?: number;
  isImportantPosition?: boolean;
}

/**
 * Enhanced Gemini AI provider implementation with intelligent rate limiting and request queuing
 */
export class GeminiProvider extends BaseAIChessProvider {
  private apiKey: string | null = null;
  private genAI: GoogleGenAI | null = null;
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private burstCount: number = 0;
  private burstWindowStart: number = 0;
  private requestResetTimeout: NodeJS.Timeout | null = null;
  private activeRequests: Set<string> = new Set();
  private requestQueue: QueuedRequest[] = [];
  private isProcessingQueue: boolean = false;
  private currentBackoffDelay: number = DEFAULT_RATE_LIMIT.COOLDOWN_MS;
  private consecutiveFailures: number = 0;
  // Track rate limiting per model
  private modelRequestCounts: Map<string, number> = new Map();
  private modelLastRequestTimes: Map<string, number> = new Map();
  private modelBurstCounts: Map<string, number> = new Map();
  private modelBurstWindowStarts: Map<string, number> = new Map();
  
  constructor() {
    super(
      'gemini',
      'Google Gemini',
      [
        {
          id: 'gemini-2.0-flash-exp',
          name: 'Gemini 2.0 Flash',
          description: 'Fast and efficient model with 15 RPM on free tier',
          strength: 'Fast'
        },
        {
          id: 'gemini-2.0-flash-thinking-exp-1219',
          name: 'Gemini 2.0 Flash Thinking',
          description: 'Enhanced reasoning model with 15 RPM on free tier',
          strength: 'Advanced'
        },
        {
          id: 'gemini-2.5-flash',
          name: 'Gemini 2.5 Flash',
          description: 'Latest model with 10 RPM on free tier',
          strength: 'Very Advanced'
        }
      ]
    );

    // Reset request count every minute
    this.startRequestCountReset();

    // Start queue processor
    this.startQueueProcessor();

    // Try to load API key from localStorage if in browser environment
    if (typeof window !== 'undefined') {
      const storedApiKey = localStorage.getItem('gemini_api_key');
      if (storedApiKey) {
        this.setApiKey(storedApiKey);
      }
    }
  }
  
  /**
   * Start the request count reset interval
   */
  private startRequestCountReset() {
    if (typeof window !== 'undefined') {
      this.requestResetTimeout = setInterval(() => {
        console.log('[GeminiProvider] Resetting request count and burst limits for all models');
        this.requestCount = 0;
        this.burstCount = 0;
        this.burstWindowStart = 0;
        this.consecutiveFailures = 0;
        this.currentBackoffDelay = DEFAULT_RATE_LIMIT.COOLDOWN_MS;
        // Reset per-model tracking
        this.modelRequestCounts.clear();
        this.modelBurstCounts.clear();
        this.modelBurstWindowStarts.clear();
      }, 60000); // Reset every minute
    }
  }

  /**
   * Start the queue processor
   */
  private startQueueProcessor(): void {
    if (this.isProcessingQueue) return;

    this.isProcessingQueue = true;
    this.processQueue();
  }

  /**
   * Process the request queue with intelligent rate limiting
   */
  private async processQueue(): Promise<void> {
    console.log(`[GeminiProvider] Starting queue processor, ${this.requestQueue.length} requests in queue`);

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (!request) continue;

      console.log(`[GeminiProvider] Processing request ${request.id}, ${this.requestQueue.length} remaining in queue`);

      try {
        // Check if we can make the request
        const canProceed = await this.checkAdvancedRateLimit(request.id);

        if (canProceed) {
          await this.executeRequest(request);
          request.resolve();

          // Reset consecutive failures on success
          this.consecutiveFailures = 0;
          this.currentBackoffDelay = DEFAULT_RATE_LIMIT.COOLDOWN_MS;

          console.log(`[GeminiProvider] Request ${request.id} completed successfully`);
        } else {
          // Re-queue the request if we can't proceed
          if (request.retryCount < RATE_LIMIT_COMMON.RETRY_ATTEMPTS) {
            request.retryCount++;
            this.requestQueue.unshift(request); // Put back at front

            console.log(`[GeminiProvider] Request ${request.id} rate limited, retrying (${request.retryCount}/${RATE_LIMIT_COMMON.RETRY_ATTEMPTS})`);

            // NO DELAY - immediate retry for fastest response
            // Removed exponential backoff for maximum speed
            continue;
          } else {
            // Max retries reached
            console.error(`[GeminiProvider] Request ${request.id} failed after ${RATE_LIMIT_COMMON.RETRY_ATTEMPTS} retries`);
            request.reject(new Error('Rate limit exceeded after maximum retries'));
          }
        }
      } catch (error) {
        console.error(`[GeminiProvider] Request ${request.id} failed with error:`, error);
        request.reject(error instanceof Error ? error : new Error(String(error)));
      }

      // NO DELAY - process requests as fast as possible
    }

    console.log(`[GeminiProvider] Queue processor finished, queue is empty`);
    this.isProcessingQueue = false;
  }

  /**
   * Clean up resources
   */
  public cleanup() {
    if (this.requestResetTimeout) {
      clearInterval(this.requestResetTimeout);
      this.requestResetTimeout = null;
    }
    this.activeRequests.clear();
    this.requestQueue = [];
    this.isProcessingQueue = false;
  }
  
  /**
   * Model-specific rate limiting with burst support and exponential backoff
   */
  private async checkAdvancedRateLimit(requestId: string): Promise<boolean> {
    // If this is an active request, don't count it again
    if (this.activeRequests.has(requestId)) {
      console.log(`[GeminiProvider] Request ${requestId} already active, not checking rate limit`);
      return true;
    }

    // Extract model ID from request ID
    const modelId = requestId.split('-')[0];
    const rateLimit = getModelRateLimit(modelId);
    const now = Date.now();

    // Initialize model tracking if not exists
    if (!this.modelRequestCounts.has(modelId)) {
      this.modelRequestCounts.set(modelId, 0);
      this.modelLastRequestTimes.set(modelId, 0);
      this.modelBurstCounts.set(modelId, 0);
      this.modelBurstWindowStarts.set(modelId, 0);
    }

    const modelRequestCount = this.modelRequestCounts.get(modelId) || 0;
    const modelLastRequestTime = this.modelLastRequestTimes.get(modelId) || 0;
    const modelBurstWindowStart = this.modelBurstWindowStarts.get(modelId) || 0;

    // Check burst limit for this model
    if (modelBurstWindowStart === 0 || (now - modelBurstWindowStart) > rateLimit.BURST_WINDOW_MS) {
      // Reset burst window for this model
      this.modelBurstWindowStarts.set(modelId, now);
      this.modelBurstCounts.set(modelId, 0);
    }

    // DISABLED: No artificial rate limiting - let API handle it naturally
    // This allows maximum speed and lets the API return rate limit errors if needed
    //
    // Note: Burst and RPM limits are disabled to ensure fastest possible response
    // If API rate limits are hit, the error will be handled by fallback system

    // NO ARTIFICIAL DELAYS - let the API handle rate limiting naturally
    // Only apply minimal cooldown if specified by model (which is now 0 for all models)
    const timeSinceLastRequest = now - modelLastRequestTime;
    const requiredDelay = rateLimit.COOLDOWN_MS; // This is now 0 for all models

    if (requiredDelay > 0 && timeSinceLastRequest < requiredDelay) {
      const delayMs = requiredDelay - timeSinceLastRequest;
      console.log(`[GeminiProvider] Applying minimal rate limit delay for ${modelId}: ${delayMs}ms`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    // Add to active requests
    this.activeRequests.add(requestId);

    // Minimal tracking for debugging purposes only (no rate limiting applied)
    this.modelLastRequestTimes.set(modelId, Date.now());
    this.modelRequestCounts.set(modelId, modelRequestCount + 1);
    this.modelBurstCounts.set(modelId, (this.modelBurstCounts.get(modelId) || 0) + 1);

    // Also update global tracking for backward compatibility
    this.lastRequestTime = Date.now();
    this.requestCount++;
    this.burstCount++;

    console.log(`[GeminiProvider] ${modelId} request sent immediately - no rate limiting applied`);

    return true;
  }


  
  /**
   * SYSTEM ROLE OPTIMIZATION - Generate system message
   */
  private generateSystemMessage(gameContext: GameContext): string {
    const { gamePhase, timeControl, isImportantPosition } = gameContext;

    let systemPrompt = "You are a professional chess engine. ";

    // Adapt based on time control
    if (timeControl === 'blitz') {
      systemPrompt += "Respond immediately with fast, tactical moves. ";
    } else if (timeControl === 'classical') {
      systemPrompt += "Consider strategic depth while maintaining efficiency. ";
    } else {
      systemPrompt += "Balance speed and accuracy for optimal play. ";
    }

    // Add game phase context
    if (gamePhase === 'opening') {
      systemPrompt += "Focus on development and center control. ";
    } else if (gamePhase === 'endgame') {
      systemPrompt += "Prioritize king activity and pawn promotion. ";
    } else {
      systemPrompt += "Look for tactical opportunities and positional improvements. ";
    }

    // Add importance context
    if (isImportantPosition) {
      systemPrompt += "This is a critical position - be extra careful. ";
    }

    systemPrompt += "Always respond with ONLY the UCI move format (e.g., 'e2e4').";

    return systemPrompt;
  }

  /**
   * INTELLIGENT RETRY WITH FEEDBACK - Generate enhanced prompt
   */
  private generateEnhancedPrompt(request: QueuedRequest): any[] {
    const gameContext = this.analyzeGameContext(request.fen, request.options);
    const systemMessage = this.generateSystemMessage(gameContext);

    let userPrompt = `${systemMessage}\n\nPosition: ${request.fen}\n\n`;

    // Add previous invalid move feedback if this is a retry
    if (request.previousInvalidMove && request.invalidMoveReason) {
      userPrompt += `IMPORTANT: Your previous response "${request.previousInvalidMove}" was invalid because: ${request.invalidMoveReason}\n`;
      userPrompt += `Please provide a different, legal move.\n\n`;
    }

    // Add strategic context based on game phase
    if (gameContext.gamePhase === 'endgame') {
      userPrompt += `This is an endgame position. Focus on king activity and pawn advancement.\n`;
    } else if (gameContext.gamePhase === 'opening') {
      userPrompt += `This is an opening position. Prioritize piece development and center control.\n`;
    }

    // Add time pressure context
    if (gameContext.timeControl === 'blitz') {
      userPrompt += `Time control: Blitz - respond with your best move immediately.\n`;
    }

    userPrompt += `\nRespond with ONLY the UCI move (e.g., "e2e4", "g8f6"):\n`;

    // Gemini API only supports 'user' and 'model' roles, not 'system'
    return [
      {
        role: 'user',
        parts: [{ text: userPrompt }]
      }
    ];
  }

  /**
   * Execute a queued request with enhanced prompting and retry logic
   */
  private async executeRequest(request: QueuedRequest): Promise<void> {
    if (!this.apiKey || !this.genAI) {
      throw new Error('Gemini API key not set');
    }

    const modelId = request.options?.modelId || 'gemini-2.0-flash-exp';
    const temperature = request.options?.temperature || 0.2;

    console.log(`[GeminiProvider] Executing request for position: ${request.fen.substring(0, 20)}... using model: ${modelId}`);

    // Generate enhanced prompt with context
    const contents = this.generateEnhancedPrompt(request);

    const config = {
      temperature,
      responseMimeType: 'text/plain',
    };

    try {
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

      console.log(`[GeminiProvider] Received response: "${text}"`);

      // Remove from active requests
      this.activeRequests.delete(request.id);

      // Validate and extract move with position context
      const move = this.validateAndExtractMove(request.fen, text);
      if (move) {
        request.callback(move);
      } else {
        // INTELLIGENT RETRY WITH FEEDBACK
        if (request.retryCount < 2) { // Allow 2 retries for invalid moves
          console.warn(`[GeminiProvider] Invalid move "${text}", retrying with feedback`);

          // Create retry request with feedback
          const retryRequest: QueuedRequest = {
            ...request,
            retryCount: request.retryCount + 1,
            previousInvalidMove: text,
            invalidMoveReason: `"${text}" is not a valid UCI move format or is illegal in this position`
          };

          // Add to front of queue for immediate retry
          this.requestQueue.unshift(retryRequest);
          return;
        }

        // Max retries reached, use fallback
        const fallbackMove = MoveValidator.getRandomLegalMove(request.fen);
        if (fallbackMove) {
          console.warn(`[GeminiProvider] Using fallback move: ${fallbackMove} after max retries`);
          request.callback(fallbackMove);
        } else {
          throw new Error(`Invalid move format received from Gemini and no fallback available: "${text}"`);
        }
      }
    } catch (error) {
      // Remove from active requests
      this.activeRequests.delete(request.id);

      // Handle rate limit errors
      if (error instanceof Error && (error.message.includes('Rate limit') || error.message.includes('429'))) {
        this.consecutiveFailures++;
        console.warn(`[GeminiProvider] Rate limit error, consecutive failures: ${this.consecutiveFailures}`);
      }

      throw error;
    }
  }

  /**
   * ROBUST OUTPUT PARSING - Enhanced cleanup and extraction
   */
  private parseGeminiResponse(text: string): string | null {
    if (!text || typeof text !== 'string') {
      return null;
    }

    // Clean up the response text
    let cleanText = text.trim();

    // Remove common prefixes and suffixes
    const prefixPatterns = [
      /^move:\s*/i,
      /^the\s+best\s+move\s+is:\s*/i,
      /^i\s+recommend:\s*/i,
      /^my\s+move\s+is:\s*/i,
      /^best\s+move:\s*/i,
      /^response:\s*/i,
      /^answer:\s*/i,
      /^solution:\s*/i
    ];

    for (const pattern of prefixPatterns) {
      cleanText = cleanText.replace(pattern, '');
    }

    // Remove trailing explanations (everything after the first space or newline)
    cleanText = cleanText.split(/[\s\n]/)[0];

    // Extract UCI moves using multiple regex patterns
    const uciPatterns = [
      /\b([a-h][1-8][a-h][1-8][qrbnQRBN]?)\b/g, // Standard UCI format
      /\b([a-h]\d[a-h]\d[qrbnQRBN]?)\b/g,        // Alternative digit format
      /([a-h][1-8]-[a-h][1-8][qrbnQRBN]?)/g,     // With dash separator
    ];

    for (const pattern of uciPatterns) {
      const matches = cleanText.match(pattern);
      if (matches && matches.length > 0) {
        // Return the first valid-looking UCI move
        for (const match of matches) {
          const cleanMatch = match.replace('-', '').toLowerCase();
          if (this.isValidUCIFormat(cleanMatch)) {
            return cleanMatch;
          }
        }
      }
    }

    // Fallback: try the cleaned text directly
    if (this.isValidUCIFormat(cleanText.toLowerCase())) {
      return cleanText.toLowerCase();
    }

    return null;
  }

  /**
   * Check if a string matches UCI format
   */
  private isValidUCIFormat(move: string): boolean {
    const uciPattern = /^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/;
    return uciPattern.test(move);
  }

  /**
   * Enhanced move validation with robust parsing
   */
  private validateAndExtractMove(fen: string, text: string): string | null {
    // First try robust parsing
    const parsedMove = this.parseGeminiResponse(text);
    if (parsedMove && MoveValidator.isLegalMove(fen, parsedMove)) {
      console.log(`[GeminiProvider] Valid move found via robust parsing: ${parsedMove}`);
      return parsedMove;
    }

    // Fallback to original validation
    const validation = MoveValidator.validateAIResponse(fen, text);
    if (validation.isValid && validation.move) {
      console.log(`[GeminiProvider] Valid move found via fallback validation: ${validation.move}`);
      return validation.move;
    }

    console.warn(`[GeminiProvider] Move validation failed: ${validation.error}`);
    return null;
  }

  /**
   * STRATEGIC CONTEXT ENHANCEMENT - Analyze game context
   */
  private analyzeGameContext(fen: string, options?: AIRequestOptions): GameContext {
    const game = new Chess();
    game.load(fen);

    // Determine game phase
    const pieces = fen.split(' ')[0];
    const pieceCount = pieces.replace(/[^a-zA-Z]/g, '').length;
    let gamePhase: 'opening' | 'middlegame' | 'endgame';

    if (pieceCount >= 28) {
      gamePhase = 'opening';
    } else if (pieceCount >= 16) {
      gamePhase = 'middlegame';
    } else {
      gamePhase = 'endgame';
    }

    // Calculate material balance (rough estimate)
    const materialValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    let whiteValue = 0, blackValue = 0;

    for (const char of pieces) {
      if (char.match(/[a-z]/)) {
        blackValue += materialValues[char as keyof typeof materialValues] || 0;
      } else if (char.match(/[A-Z]/)) {
        whiteValue += materialValues[char.toLowerCase() as keyof typeof materialValues] || 0;
      }
    }

    const materialBalance = whiteValue - blackValue;

    // Determine time control from options
    const timeControl = options?.timeControl || 'rapid';

    // Check if position is important (in check, near promotion, etc.)
    const isImportantPosition = game.inCheck() ||
                               fen.includes('7') || fen.includes('2') || // Pawns near promotion
                               pieceCount <= 10; // Endgame positions

    return {
      gamePhase,
      timeControl,
      materialBalance,
      isImportantPosition,
      timeRemaining: options?.timeRemaining
    };
  }

  /**
   * Generate move history in PGN format for context
   */
  private generateMoveHistory(fen: string, maxMoves: number = 10): string[] {
    // This would ideally come from the chess store, but for now we'll return empty
    // In a full implementation, this would be passed from the calling component
    return [];
  }

  /**
   * Set the API key for Gemini
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    if (apiKey) {
      console.log('[GeminiProvider] API key set successfully');
      this.genAI = new GoogleGenAI({ apiKey });
    } else {
      console.log('[GeminiProvider] API key cleared');
      this.genAI = null;
    }
  }
  
  /**
   * Get the best move using Gemini with intelligent queuing
   */
  async getBestMove(
    fen: string,
    callback: (bestMove: string) => void,
    options?: AIRequestOptions
  ): Promise<void> {
    if (!this.apiKey || !this.genAI) {
      console.error('[GeminiProvider] API key not set');
      throw new Error('Gemini API key not set');
    }

    const modelId = options?.modelId || 'gemini-2.0-flash-exp';
    const requestId = `${modelId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    console.log(`[GeminiProvider] Queuing request for position: ${fen.substring(0, 20)}... using model: ${modelId}`);

    // Create a promise that will be resolved when the request is processed
    return new Promise<void>((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        id: requestId,
        fen,
        callback,
        options,
        timestamp: Date.now(),
        retryCount: 0,
        resolve,
        reject
      };

      // Add to queue
      this.requestQueue.push(queuedRequest);

      // Start processing if not already running
      if (!this.isProcessingQueue) {
        this.startQueueProcessor();
      }
    });
  }
  
  /**
   * Get queue status for monitoring
   */
  getQueueStatus(): {
    queueLength: number;
    isProcessing: boolean;
    activeRequests: number;
    requestCount: number;
    burstCount: number;
    currentBackoffDelay: number;
    consecutiveFailures: number;
  } {
    return {
      queueLength: this.requestQueue.length,
      isProcessing: this.isProcessingQueue,
      activeRequests: this.activeRequests.size,
      requestCount: this.requestCount,
      burstCount: this.burstCount,
      currentBackoffDelay: this.currentBackoffDelay,
      consecutiveFailures: this.consecutiveFailures
    };
  }

  /**
   * Clear the request queue (emergency use)
   */
  clearQueue(): void {
    console.warn('[GeminiProvider] Clearing request queue');
    this.requestQueue.forEach(request => {
      request.reject(new Error('Queue cleared'));
    });
    this.requestQueue = [];
    this.isProcessingQueue = false;
  }

  /**
   * Check if Gemini is available
   */
  async isReady(): Promise<boolean> {
    if (!this.apiKey) {
      console.log('[GeminiProvider] Not ready: API key not set');
      return false;
    }

    try {
      // Just check if we have a valid API key
      console.log('[GeminiProvider] Ready with API key');
      return true;
    } catch (error) {
      console.error('[GeminiProvider] Error checking availability:', error);
      return false;
    }
  }
}