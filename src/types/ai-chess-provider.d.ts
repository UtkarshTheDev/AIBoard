/**
 * AI Chess Provider Types
 */

/**
 * AI Chess Model
 */
export interface AIChessModel {
  id: string;
  name: string;
  description?: string;
  strength?: string;
  custom?: boolean;
  enabled?: boolean;
}

/**
 * AI Request Options
 */
export interface AIRequestOptions {
  modelId?: string;
  temperature?: number;
  timeLimit?: number;
  depth?: number;
  [key: string]: any;
}

/**
 * AI Chess Provider Interface
 */
export interface AIChessProvider {
  readonly id: string;
  readonly name: string;
  readonly models: AIChessModel[];
  
  /**
   * Get the best move for a given position
   */
  getBestMove(
    fen: string, 
    callback: (bestMove: string) => void,
    options?: AIRequestOptions
  ): Promise<void>;
  
  /**
   * Check if the provider is ready to use
   */
  isReady(): Promise<boolean>;
  
  /**
   * Add a custom model
   */
  addModel(model: AIChessModel): void;
  
  /**
   * Update a model
   */
  updateModel(id: string, updates: Partial<AIChessModel>): void;
  
  /**
   * Delete a custom model
   */
  deleteModel(id: string): void;
  
  /**
   * Get enabled models
   */
  getEnabledModels(): AIChessModel[];
  
  /**
   * Clean up any resources used by the provider
   */
  cleanup(): void;
} 