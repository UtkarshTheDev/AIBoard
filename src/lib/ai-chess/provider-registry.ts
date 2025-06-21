import { AIChessProvider } from '@/types/ai-chess-provider';
import { GeminiProvider } from './gemini-provider';
import { StockfishProvider } from './stockfish-provider';

/**
 * Registry for AI chess providers
 */
export class AIChessProviderRegistry {
  private static instance: AIChessProviderRegistry;
  private providers: Map<string, AIChessProvider> = new Map();
  
  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    // Register default providers
    this.registerProvider(new GeminiProvider());
    this.registerProvider(new StockfishProvider());
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): AIChessProviderRegistry {
    if (!AIChessProviderRegistry.instance) {
      AIChessProviderRegistry.instance = new AIChessProviderRegistry();
    }
    return AIChessProviderRegistry.instance;
  }
  
  /**
   * Register a provider
   */
  public registerProvider(provider: AIChessProvider): void {
    this.providers.set(provider.id, provider);
  }
  
  /**
   * Unregister a provider
   */
  unregister(providerId: string): boolean {
    return this.providers.delete(providerId);
  }
  
  /**
   * Get a provider by ID
   */
  public getProvider(id: string): AIChessProvider | undefined {
    return this.providers.get(id);
  }
  
  /**
   * Get all registered providers
   */
  public getAllProviders(): AIChessProvider[] {
    return Array.from(this.providers.values());
  }
  
  /**
   * Get all available models from all providers
   */
  public getAllModels() {
    const allModels: { providerId: string; model: any }[] = [];
    
    this.providers.forEach((provider, providerId) => {
      provider.getEnabledModels().forEach(model => {
        allModels.push({
          providerId,
          model
        });
      });
    });
    
    return allModels;
  }
  
  /**
   * Clean up all providers
   * This should be called when the application is shutting down
   */
  public cleanup(): void {
    this.providers.forEach(provider => {
      try {
        provider.cleanup();
      } catch (error) {
        console.error(`Error cleaning up provider ${provider.id}:`, error);
      }
    });
  }
} 