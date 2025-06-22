import { AIChessProvider, AIRequestOptions } from '@/types/ai-chess-provider';
import { AIChessProviderRegistry } from './provider-registry';

/**
 * Manages fallback providers for AI chess matches
 */
export class FallbackManager {
  private static instance: FallbackManager;
  private failureCount: Map<string, number> = new Map();
  private lastFailureTime: Map<string, number> = new Map();
  private isProviderDisabled: Map<string, boolean> = new Map();
  
  // Configuration
  private readonly MAX_FAILURES = 3;
  private readonly FAILURE_WINDOW_MS = 300000; // 5 minutes
  private readonly DISABLE_DURATION_MS = 600000; // 10 minutes
  
  private constructor() {}
  
  public static getInstance(): FallbackManager {
    if (!FallbackManager.instance) {
      FallbackManager.instance = new FallbackManager();
    }
    return FallbackManager.instance;
  }
  
  /**
   * Record a failure for a provider
   */
  recordFailure(providerId: string): void {
    const now = Date.now();
    const currentFailures = this.failureCount.get(providerId) || 0;
    const lastFailure = this.lastFailureTime.get(providerId) || 0;
    
    // Reset failure count if enough time has passed
    if (now - lastFailure > this.FAILURE_WINDOW_MS) {
      this.failureCount.set(providerId, 1);
    } else {
      this.failureCount.set(providerId, currentFailures + 1);
    }
    
    this.lastFailureTime.set(providerId, now);
    
    // Disable provider if too many failures
    const failures = this.failureCount.get(providerId) || 0;
    if (failures >= this.MAX_FAILURES) {
      this.isProviderDisabled.set(providerId, true);
      console.warn(`[FallbackManager] Provider ${providerId} disabled due to ${failures} failures`);
      
      // Re-enable after disable duration
      setTimeout(() => {
        this.isProviderDisabled.set(providerId, false);
        this.failureCount.set(providerId, 0);
        console.log(`[FallbackManager] Provider ${providerId} re-enabled`);
      }, this.DISABLE_DURATION_MS);
    }
  }
  
  /**
   * Record a success for a provider
   */
  recordSuccess(providerId: string): void {
    // Reset failure count on success
    this.failureCount.set(providerId, 0);
    this.isProviderDisabled.set(providerId, false);
  }
  
  /**
   * Check if a provider is available
   */
  isProviderAvailable(providerId: string): boolean {
    return !this.isProviderDisabled.get(providerId);
  }
  
  /**
   * Get the best available provider for a request
   */
  getBestAvailableProvider(preferredProviderId: string): {
    provider: AIChessProvider | null;
    providerId: string | null;
    isFallback: boolean;
  } {
    const registry = AIChessProviderRegistry.getInstance();
    
    // Try preferred provider first if available
    if (this.isProviderAvailable(preferredProviderId)) {
      const provider = registry.getProvider(preferredProviderId);
      if (provider) {
        return {
          provider,
          providerId: preferredProviderId,
          isFallback: false
        };
      }
    }
    
    // Find fallback provider
    const allProviders = registry.getAllProviders();
    
    // Prefer Stockfish as fallback since it's local and reliable
    const stockfishProvider = allProviders.find(p => p.id === 'stockfish');
    if (stockfishProvider && this.isProviderAvailable('stockfish')) {
      return {
        provider: stockfishProvider,
        providerId: 'stockfish',
        isFallback: true
      };
    }
    
    // Try any other available provider
    for (const provider of allProviders) {
      if (provider.id !== preferredProviderId && this.isProviderAvailable(provider.id)) {
        return {
          provider,
          providerId: provider.id,
          isFallback: true
        };
      }
    }
    
    return {
      provider: null,
      providerId: null,
      isFallback: false
    };
  }
  
  /**
   * Execute a request with automatic fallback
   */
  async executeWithFallback(
    preferredProviderId: string,
    modelId: string,
    fen: string,
    callback: (bestMove: string) => void,
    options?: AIRequestOptions
  ): Promise<void> {
    const { provider, providerId, isFallback } = this.getBestAvailableProvider(preferredProviderId);
    
    if (!provider || !providerId) {
      throw new Error('No available providers for AI move generation');
    }
    
    if (isFallback) {
      console.log(`[FallbackManager] Using fallback provider ${providerId} instead of ${preferredProviderId}`);
    }
    
    try {
      // Adjust model ID for fallback provider if needed
      let adjustedModelId = modelId;
      if (isFallback && providerId === 'stockfish') {
        // Map to appropriate Stockfish level
        adjustedModelId = this.mapToStockfishLevel(modelId);
      }
      
      await provider.getBestMove(fen, callback, { ...options, modelId: adjustedModelId });
      
      // Record success
      this.recordSuccess(providerId);
      
    } catch (error) {
      // Record failure
      this.recordFailure(providerId);
      
      // If this was already a fallback, don't try another fallback
      if (isFallback) {
        throw error;
      }
      
      // Try fallback
      console.warn(`[FallbackManager] Primary provider ${providerId} failed, trying fallback`);
      const fallback = this.getBestAvailableProvider(providerId);
      
      if (fallback.provider && fallback.providerId) {
        console.log(`[FallbackManager] Using fallback provider ${fallback.providerId}`);
        
        let fallbackModelId = modelId;
        if (fallback.providerId === 'stockfish') {
          fallbackModelId = this.mapToStockfishLevel(modelId);
        }
        
        await fallback.provider.getBestMove(fen, callback, { ...options, modelId: fallbackModelId });
        this.recordSuccess(fallback.providerId);
      } else {
        throw error;
      }
    }
  }
  
  /**
   * Map Gemini model to appropriate Stockfish level
   */
  private mapToStockfishLevel(modelId: string): string {
    // Map based on model strength
    if (modelId.includes('2.5-pro') || modelId.includes('advanced')) {
      return 'stockfish-level-20';
    } else if (modelId.includes('1.5-pro') || modelId.includes('pro')) {
      return 'stockfish-level-10';
    } else if (modelId.includes('flash') || modelId.includes('fast')) {
      return 'stockfish-level-5';
    } else {
      return 'stockfish-level-10'; // Default
    }
  }
  
  /**
   * Get provider status for debugging
   */
  getProviderStatus(): Record<string, {
    failures: number;
    lastFailure: number;
    disabled: boolean;
  }> {
    const status: Record<string, any> = {};
    
    const registry = AIChessProviderRegistry.getInstance();
    const allProviders = registry.getAllProviders();
    
    for (const provider of allProviders) {
      status[provider.id] = {
        failures: this.failureCount.get(provider.id) || 0,
        lastFailure: this.lastFailureTime.get(provider.id) || 0,
        disabled: this.isProviderDisabled.get(provider.id) || false
      };
    }
    
    return status;
  }
  
  /**
   * Reset all provider states
   */
  reset(): void {
    this.failureCount.clear();
    this.lastFailureTime.clear();
    this.isProviderDisabled.clear();
    console.log('[FallbackManager] All provider states reset');
  }
}
