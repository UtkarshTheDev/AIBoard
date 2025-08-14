import { toast } from 'sonner';

/**
 * Error types for AI chess operations
 */
export enum AIChessErrorType {
  RATE_LIMIT = 'RATE_LIMIT',
  API_KEY_INVALID = 'API_KEY_INVALID',
  API_KEY_MISSING = 'API_KEY_MISSING',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_MOVE = 'INVALID_MOVE',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Structured error class for AI chess operations
 */
export class AIChessError extends Error {
  public readonly type: AIChessErrorType;
  public readonly providerId: string;
  public readonly retryable: boolean;
  public readonly retryDelay: number;
  public readonly originalError?: Error;

  constructor(
    type: AIChessErrorType,
    message: string,
    providerId: string,
    retryable: boolean = false,
    retryDelay: number = 0,
    originalError?: Error
  ) {
    super(message);
    this.name = 'AIChessError';
    this.type = type;
    this.providerId = providerId;
    this.retryable = retryable;
    this.retryDelay = retryDelay;
    this.originalError = originalError;
  }
}

/**
 * Error handler for AI chess operations
 */
export class AIChessErrorHandler {
  /**
   * Classify an error and return structured error information
   */
  static classifyError(error: Error | unknown, providerId: string): AIChessError {
    const errorMessage = (error instanceof Error ? error.message : String(error));
    const errorString = errorMessage.toLowerCase();

    // Rate limiting errors
    if (errorString.includes('rate limit') || errorString.includes('429') || errorString.includes('too many requests')) {
      return new AIChessError(
        AIChessErrorType.RATE_LIMIT,
        'Rate limit exceeded. Switching to fallback provider.',
        providerId,
        true,
        0, // NO DELAY - immediate fallback
        error instanceof Error ? error : new Error(String(error))
      );
    }

    // API key errors
    if (errorString.includes('api key') && (errorString.includes('invalid') || errorString.includes('unauthorized'))) {
      return new AIChessError(
        AIChessErrorType.API_KEY_INVALID,
        'Invalid API key. Please check your API key configuration.',
        providerId,
        false,
        0,
        error instanceof Error ? error : new Error(String(error))
      );
    }

    if (errorString.includes('api key not set') || errorString.includes('api key') && errorString.includes('missing')) {
      return new AIChessError(
        AIChessErrorType.API_KEY_MISSING,
        'API key not set. Please configure your API key.',
        providerId,
        false,
        0,
        error instanceof Error ? error : new Error(String(error))
      );
    }

    // Network errors
    if (errorString.includes('network') || errorString.includes('fetch') || errorString.includes('connection')) {
      return new AIChessError(
        AIChessErrorType.NETWORK_ERROR,
        'Network error. Switching to fallback provider.',
        providerId,
        true,
        0, // NO DELAY - immediate fallback
        error instanceof Error ? error : new Error(String(error))
      );
    }

    // Timeout errors
    if (errorString.includes('timeout') || errorString.includes('timed out')) {
      return new AIChessError(
        AIChessErrorType.TIMEOUT,
        'Request timed out. Switching to fallback provider.',
        providerId,
        true,
        0, // NO DELAY - immediate fallback
        error instanceof Error ? error : new Error(String(error))
      );
    }

    // Quota exceeded
    if (errorString.includes('quota') || errorString.includes('limit exceeded')) {
      return new AIChessError(
        AIChessErrorType.QUOTA_EXCEEDED,
        'API quota exceeded. Switching to fallback provider.',
        providerId,
        true,
        0, // NO DELAY - immediate fallback
        error instanceof Error ? error : new Error(String(error))
      );
    }

    // Invalid move errors
    if (errorString.includes('invalid move') || errorString.includes('illegal move')) {
      return new AIChessError(
        AIChessErrorType.INVALID_MOVE,
        'AI generated an invalid move. Retrying immediately.',
        providerId,
        true,
        0, // NO DELAY - immediate retry
        error instanceof Error ? error : new Error(String(error))
      );
    }

    // Provider unavailable
    if (errorString.includes('provider') && (errorString.includes('unavailable') || errorString.includes('not found'))) {
      return new AIChessError(
        AIChessErrorType.PROVIDER_UNAVAILABLE,
        'AI provider is currently unavailable. Trying fallback provider.',
        providerId,
        false,
        0,
        error instanceof Error ? error : new Error(String(error))
      );
    }

    // Unknown error
    return new AIChessError(
      AIChessErrorType.UNKNOWN,
      `Unexpected error: ${errorMessage}`,
      providerId,
      true,
      0, // NO DELAY - immediate retry/fallback
      error instanceof Error ? error : new Error(String(error))
    );
  }

  /**
   * Handle an error with appropriate user feedback and recovery strategy
   */
  static handleError(error: Error | unknown, providerId: string, context: string = ''): {
    shouldRetry: boolean;
    retryDelay: number;
    shouldFallback: boolean;
    userMessage: string;
  } {
    const classifiedError = this.classifyError(error, providerId);
    
    console.error(`[AIChessErrorHandler] ${context} Error in ${providerId}:`, {
      type: classifiedError.type,
      message: classifiedError.message,
      retryable: classifiedError.retryable,
      retryDelay: classifiedError.retryDelay
    });

    let userMessage = classifiedError.message;
    let shouldRetry = classifiedError.retryable;
    let shouldFallback = false;

    // Determine recovery strategy based on error type - ALL IMMEDIATE
    switch (classifiedError.type) {
      case AIChessErrorType.RATE_LIMIT:
        userMessage = `Rate limit reached for ${providerId}. Switching to backup provider immediately.`;
        shouldFallback = true; // Try fallback provider immediately
        break;

      case AIChessErrorType.API_KEY_INVALID:
      case AIChessErrorType.API_KEY_MISSING:
        userMessage = `API key issue with ${providerId}. Switching to backup provider.`;
        shouldRetry = false;
        shouldFallback = true;
        break;

      case AIChessErrorType.NETWORK_ERROR:
        userMessage = `Network error with ${providerId}. Switching to backup provider immediately.`;
        shouldFallback = true;
        break;

      case AIChessErrorType.PROVIDER_UNAVAILABLE:
        userMessage = `${providerId} is unavailable. Switching to backup provider.`;
        shouldRetry = false;
        shouldFallback = true;
        break;

      case AIChessErrorType.QUOTA_EXCEEDED:
        userMessage = `API quota exceeded for ${providerId}. Switching to backup provider.`;
        shouldRetry = false;
        shouldFallback = true;
        break;

      case AIChessErrorType.INVALID_MOVE:
        userMessage = `AI generated invalid move. Retrying immediately with adjusted parameters.`;
        break;

      case AIChessErrorType.TIMEOUT:
        userMessage = `${providerId} timed out. Switching to backup provider immediately.`;
        shouldFallback = true;
        break;

      default:
        userMessage = `Unexpected error with ${providerId}. Switching to backup provider immediately.`;
        shouldFallback = true;
        break;
    }

    // Show user notification
    this.showUserNotification(classifiedError, userMessage, context);

    return {
      shouldRetry,
      retryDelay: classifiedError.retryDelay,
      shouldFallback,
      userMessage
    };
  }

  /**
   * Show appropriate user notification based on error severity
   */
  private static showUserNotification(error: AIChessError, message: string, context: string): void {
    const toastOptions = {
      description: context ? `Context: ${context}` : undefined,
      duration: this.getToastDuration(error.type)
    };

    switch (error.type) {
      case AIChessErrorType.API_KEY_INVALID:
      case AIChessErrorType.API_KEY_MISSING:
      case AIChessErrorType.QUOTA_EXCEEDED:
        toast.error(message, toastOptions);
        break;

      case AIChessErrorType.RATE_LIMIT:
      case AIChessErrorType.PROVIDER_UNAVAILABLE:
        toast.warning(message, toastOptions);
        break;

      case AIChessErrorType.INVALID_MOVE:
      case AIChessErrorType.NETWORK_ERROR:
      case AIChessErrorType.TIMEOUT:
        toast.info(message, toastOptions);
        break;

      default:
        toast.error(message, toastOptions);
        break;
    }
  }

  /**
   * Get appropriate toast duration based on error type
   */
  private static getToastDuration(errorType: AIChessErrorType): number {
    switch (errorType) {
      case AIChessErrorType.API_KEY_INVALID:
      case AIChessErrorType.API_KEY_MISSING:
      case AIChessErrorType.QUOTA_EXCEEDED:
        return 8000; // 8 seconds for critical errors

      case AIChessErrorType.RATE_LIMIT:
        return 6000; // 6 seconds for rate limits

      case AIChessErrorType.INVALID_MOVE:
        return 3000; // 3 seconds for minor issues

      default:
        return 5000; // 5 seconds default
    }
  }

  /**
   * Create a recovery plan for multiple consecutive errors
   */
  static createRecoveryPlan(errors: AIChessError[], maxRetries: number = 3): {
    shouldContinue: boolean;
    nextAction: 'retry' | 'fallback' | 'abort';
    delay: number;
    message: string;
  } {
    if (errors.length === 0) {
      return {
        shouldContinue: true,
        nextAction: 'retry',
        delay: 0,
        message: 'No errors to recover from'
      };
    }

    const lastError = errors[errors.length - 1];
    const errorCounts = this.countErrorTypes(errors);

    // If too many errors, abort
    if (errors.length >= maxRetries) {
      return {
        shouldContinue: false,
        nextAction: 'abort',
        delay: 0,
        message: `Too many consecutive errors (${errors.length}). Please try again later.`
      };
    }

    // If multiple rate limit errors, use fallback
    if (errorCounts[AIChessErrorType.RATE_LIMIT] >= 2) {
      return {
        shouldContinue: true,
        nextAction: 'fallback',
        delay: 0,
        message: 'Multiple rate limit errors detected. Switching to backup provider.'
      };
    }

    // If API key errors, use fallback immediately
    if (errorCounts[AIChessErrorType.API_KEY_INVALID] > 0 || errorCounts[AIChessErrorType.API_KEY_MISSING] > 0) {
      return {
        shouldContinue: true,
        nextAction: 'fallback',
        delay: 0,
        message: 'API key issues detected. Using backup provider.'
      };
    }

    // Default to immediate retry/fallback - NO DELAYS
    return {
      shouldContinue: true,
      nextAction: lastError.retryable ? 'retry' : 'fallback',
      delay: 0, // NO DELAY - immediate action
      message: `Retrying immediately...`
    };
  }

  /**
   * Count error types in an array of errors
   */
  private static countErrorTypes(errors: AIChessError[]): Record<AIChessErrorType, number> {
    const counts = {} as Record<AIChessErrorType, number>;
    
    // Initialize all error types to 0
    Object.values(AIChessErrorType).forEach(type => {
      counts[type] = 0;
    });

    // Count occurrences
    errors.forEach(error => {
      counts[error.type]++;
    });

    return counts;
  }
}
