import { AIChessProvider, AIChessModel, AIRequestOptions } from '@/types/ai-chess-provider';

/**
 * Base class for AI chess providers
 */
export abstract class BaseAIChessProvider implements AIChessProvider {
  readonly id: string;
  readonly name: string;
  protected _models: AIChessModel[];
  
  constructor(id: string, name: string, models: AIChessModel[]) {
    this.id = id;
    this.name = name;
    // Ensure all models have enabled flag set to true by default
    this._models = models.map(model => ({
      ...model,
      enabled: model.enabled !== false // Default to true if not explicitly set to false
    }));
  }
  
  /**
   * Get all models
   */
  get models(): AIChessModel[] {
    return this._models;
  }
  
  /**
   * Add a custom model
   */
  addModel(model: AIChessModel): void {
    // Check if model with this ID already exists
    const existingIndex = this._models.findIndex(m => m.id === model.id);
    
    if (existingIndex >= 0) {
      // Update existing model
      this._models[existingIndex] = {
        ...this._models[existingIndex],
        ...model,
        custom: true,
        enabled: model.enabled !== false // Default to true if not explicitly set to false
      };
    } else {
      // Add new model
      this._models.push({
        ...model,
        custom: true,
        enabled: model.enabled !== false // Default to true if not explicitly set to false
      });
    }
  }
  
  /**
   * Update a model
   */
  updateModel(id: string, updates: Partial<AIChessModel>): void {
    const modelIndex = this._models.findIndex(model => model.id === id);
    
    if (modelIndex >= 0) {
      this._models[modelIndex] = {
        ...this._models[modelIndex],
        ...updates
      };
      
      console.log(`[BaseProvider] Updated model ${id} in provider ${this.id}:`, this._models[modelIndex]);
    } else {
      console.warn(`[BaseProvider] Attempted to update non-existent model ${id} in provider ${this.id}`);
    }
  }
  
  /**
   * Delete a custom model
   */
  deleteModel(id: string): void {
    const modelIndex = this._models.findIndex(model => model.id === id);
    
    if (modelIndex >= 0 && this._models[modelIndex].custom) {
      this._models.splice(modelIndex, 1);
      console.log(`[BaseProvider] Deleted custom model ${id} from provider ${this.id}`);
    } else if (modelIndex >= 0) {
      console.warn(`[BaseProvider] Attempted to delete non-custom model ${id} from provider ${this.id}`);
    } else {
      console.warn(`[BaseProvider] Attempted to delete non-existent model ${id} from provider ${this.id}`);
    }
  }
  
  /**
   * Get enabled models
   */
  getEnabledModels(): AIChessModel[] {
    return this._models.filter(model => model.enabled !== false);
  }
  
  /**
   * Get the best move for a given position
   */
  abstract getBestMove(
    fen: string, 
    callback: (bestMove: string) => void,
    options?: AIRequestOptions
  ): Promise<void>;
  
  /**
   * Check if the provider is ready to use
   */
  abstract isReady(): Promise<boolean>;
  
  /**
   * Clean up any resources used by the provider
   * Providers should override this method if they need to clean up resources
   */
  public cleanup(): void {
    // Base implementation does nothing
    // Providers should override this method if they need to clean up resources
  }
} 