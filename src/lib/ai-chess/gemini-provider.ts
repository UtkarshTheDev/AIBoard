import { BaseAIChessProvider } from './base-provider';
import { AIRequestOptions } from '@/types/ai-chess-provider';
import { GoogleGenAI } from '@google/genai';
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
            text: `You are a fast chess engine. Analyze this position and respond immediately with the best move:

Position: ${request.fen}

Requirements:
- Respond with ONLY the move in UCI format (e.g., "e2e4", "g8f6")
- No explanations or analysis text
- Make your decision quickly but accurately
- For castling: use king's move (e.g., "e1g1")
- For promotion: include piece (e.g., "e7e8q")

Move:`
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
          this.currentBackoffDelay * RATE_LIMIT_COMMON.BACKOFF_MULTIPLIER,
          RATE_LIMIT_COMMON.MAX_BACKOFF_MS
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