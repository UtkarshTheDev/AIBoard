import { BaseAIChessProvider } from './base-provider';
import { AIRequestOptions } from '@/types/ai-chess-provider';
import { GoogleGenAI } from '@google/genai';
import { MoveValidator } from './move-validator';

// Rate limiting settings based on Gemini free tier limits
// Using most restrictive model (Gemini 2.5 Flash: 10 RPM) for compatibility
const RATE_LIMIT = {
  MAX_REQUESTS_PER_MINUTE: 10, // Based on Gemini 2.5 Flash free tier limit
  COOLDOWN_MS: 6000, // 6 seconds between requests (10 RPM = 6s intervals)
  BURST_LIMIT: 3, // Conservative burst for free tier
  BURST_WINDOW_MS: 20000, // 20 second burst window
  BACKOFF_MULTIPLIER: 1.5, // Exponential backoff multiplier
  MAX_BACKOFF_MS: 60000, // Maximum backoff delay (60 seconds)
  RETRY_ATTEMPTS: 3, // Number of retry attempts for rate limited requests
};

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
  private currentBackoffDelay: number = RATE_LIMIT.COOLDOWN_MS;
  private consecutiveFailures: number = 0;
  
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
        console.log('[GeminiProvider] Resetting request count and burst limits');
        this.requestCount = 0;
        this.burstCount = 0;
        this.burstWindowStart = 0;
        this.consecutiveFailures = 0;
        this.currentBackoffDelay = RATE_LIMIT.COOLDOWN_MS;
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
          this.currentBackoffDelay = RATE_LIMIT.COOLDOWN_MS;

          console.log(`[GeminiProvider] Request ${request.id} completed successfully`);
        } else {
          // Re-queue the request if we can't proceed
          if (request.retryCount < RATE_LIMIT.RETRY_ATTEMPTS) {
            request.retryCount++;
            this.requestQueue.unshift(request); // Put back at front

            console.log(`[GeminiProvider] Request ${request.id} rate limited, retrying (${request.retryCount}/${RATE_LIMIT.RETRY_ATTEMPTS})`);

            // Wait before retrying with exponential backoff
            const backoffDelay = Math.min(
              this.currentBackoffDelay * Math.pow(RATE_LIMIT.BACKOFF_MULTIPLIER, request.retryCount),
              RATE_LIMIT.MAX_BACKOFF_MS
            );

            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            continue;
          } else {
            // Max retries reached
            console.error(`[GeminiProvider] Request ${request.id} failed after ${RATE_LIMIT.RETRY_ATTEMPTS} retries`);
            request.reject(new Error('Rate limit exceeded after maximum retries'));
          }
        }
      } catch (error) {
        console.error(`[GeminiProvider] Request ${request.id} failed with error:`, error);
        request.reject(error instanceof Error ? error : new Error(String(error)));
      }

      // Small delay between processing requests to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 100));
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
   * Advanced rate limiting with burst support and exponential backoff
   */
  private async checkAdvancedRateLimit(requestId: string): Promise<boolean> {
    // If this is an active request, don't count it again
    if (this.activeRequests.has(requestId)) {
      console.log(`[GeminiProvider] Request ${requestId} already active, not checking rate limit`);
      return true;
    }

    const now = Date.now();

    // Check burst limit
    if (this.burstWindowStart === 0 || (now - this.burstWindowStart) > RATE_LIMIT.BURST_WINDOW_MS) {
      // Reset burst window
      this.burstWindowStart = now;
      this.burstCount = 0;
    }

    // Check if we've exceeded burst limit
    if (this.burstCount >= RATE_LIMIT.BURST_LIMIT) {
      const timeUntilBurstReset = RATE_LIMIT.BURST_WINDOW_MS - (now - this.burstWindowStart);
      if (timeUntilBurstReset > 0) {
        console.warn(`[GeminiProvider] Burst limit exceeded, waiting ${timeUntilBurstReset}ms`);
        return false;
      }
    }

    // Check overall rate limit
    if (this.requestCount >= RATE_LIMIT.MAX_REQUESTS_PER_MINUTE) {
      console.warn(`[GeminiProvider] Rate limit exceeded (${this.requestCount}/${RATE_LIMIT.MAX_REQUESTS_PER_MINUTE} requests)`);
      return false;
    }

    // Calculate time since last request with exponential backoff
    const timeSinceLastRequest = now - this.lastRequestTime;
    const requiredDelay = Math.min(this.currentBackoffDelay, RATE_LIMIT.MAX_BACKOFF_MS);

    if (timeSinceLastRequest < requiredDelay) {
      const delayMs = requiredDelay - timeSinceLastRequest;
      console.log(`[GeminiProvider] Applying rate limit delay: ${delayMs}ms (backoff: ${this.currentBackoffDelay}ms)`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    // Add to active requests
    this.activeRequests.add(requestId);

    // Update request tracking
    this.lastRequestTime = Date.now();
    this.requestCount++;
    this.burstCount++;

    console.log(`[GeminiProvider] Request count: ${this.requestCount}/${RATE_LIMIT.MAX_REQUESTS_PER_MINUTE}, burst: ${this.burstCount}/${RATE_LIMIT.BURST_LIMIT}`);

    return true;
  }


  
  /**
   * Execute a queued request
   */
  private async executeRequest(request: QueuedRequest): Promise<void> {
    if (!this.apiKey || !this.genAI) {
      throw new Error('Gemini API key not set');
    }

    const modelId = request.options?.modelId || 'gemini-2.0-flash-exp';
    const temperature = request.options?.temperature || 0.2;

    console.log(`[GeminiProvider] Executing request for position: ${request.fen.substring(0, 20)}... using model: ${modelId}`);

    // Prepare the prompt for Gemini
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: `
You are a chess engine analyzing the following position in FEN notation:
${request.fen}

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
        // Try to get a fallback move if validation fails
        const fallbackMove = MoveValidator.getRandomLegalMove(request.fen);
        if (fallbackMove) {
          console.warn(`[GeminiProvider] Using fallback move: ${fallbackMove} due to invalid response: "${text}"`);
          request.callback(fallbackMove);
        } else {
          throw new Error(`Invalid move format received from Gemini and no fallback available: "${text}"`);
        }
      }
    } catch (error) {
      // Remove from active requests
      this.activeRequests.delete(request.id);

      // Handle rate limit errors with exponential backoff
      if (error instanceof Error && (error.message.includes('Rate limit') || error.message.includes('429'))) {
        this.consecutiveFailures++;
        this.currentBackoffDelay = Math.min(
          this.currentBackoffDelay * RATE_LIMIT.BACKOFF_MULTIPLIER,
          RATE_LIMIT.MAX_BACKOFF_MS
        );
        console.warn(`[GeminiProvider] Rate limit error, increasing backoff to ${this.currentBackoffDelay}ms`);
      }

      throw error;
    }
  }

  /**
   * Validate and extract move from API response using enhanced validation
   */
  private validateAndExtractMove(fen: string, text: string): string | null {
    const validation = MoveValidator.validateAIResponse(fen, text);

    if (validation.isValid && validation.move) {
      console.log(`[GeminiProvider] Valid move found: ${validation.move}`);
      return validation.move;
    }

    console.warn(`[GeminiProvider] Move validation failed: ${validation.error}`);
    return null;
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