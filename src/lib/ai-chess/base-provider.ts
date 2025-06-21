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
    this._models = models;
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
        custom: true
      };
    } else {
      // Add new model
      this._models.push({
        ...model,
        custom: true
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
    }
  }
  
  /**
   * Delete a custom model
   */
  deleteModel(id: string): void {
    const modelIndex = this._models.findIndex(model => model.id === id);
    
    if (modelIndex >= 0 && this._models[modelIndex].custom) {
      this._models.splice(modelIndex, 1);
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