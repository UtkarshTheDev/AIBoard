"use client"
import { useState, useEffect } from 'react';
import { AIChessProvider, AIRequestOptions } from '@/types/ai-chess-provider';
import { AIChessProviderRegistry } from '@/lib/ai-chess/provider-registry';
import { useApiStockfish } from './useApiStockfish';
import { toast } from 'sonner';

export const useAIChessProviders = () => {
  const [providers, setProviders] = useState<AIChessProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { stockfishService } = useApiStockfish();
  
  // Initialize providers
  useEffect(() => {
    const registry = AIChessProviderRegistry.getInstance();
    setProviders(registry.getAllProviders());
    setIsLoading(false);
    
    // Make stockfish service available globally for the provider
    if (typeof window !== 'undefined' && stockfishService) {
      window.__stockfishService = stockfishService;
    }
    
    // Clean up on unmount
    return () => {
      registry.cleanup();
      if (typeof window !== 'undefined') {
        delete window.__stockfishService;
      }
    };
  }, [stockfishService]);
  
  // Set Gemini API key
  const setGeminiApiKey = (apiKey: string) => {
    const registry = AIChessProviderRegistry.getInstance();
    const geminiProvider = registry.getProvider('gemini');
    
    if (geminiProvider && 'setApiKey' in geminiProvider) {
      (geminiProvider as any).setApiKey(apiKey);
    }
  };
  
  // Get AI move from a provider
  const getAIMove = async (
    providerId: string, 
    modelId: string, 
    fen: string, 
    callback: (bestMove: string) => void,
    options?: AIRequestOptions
  ) => {
    const registry = AIChessProviderRegistry.getInstance();
    const provider = registry.getProvider(providerId);
    
    if (!provider) {
      toast.error(`Provider ${providerId} not found`);
      throw new Error(`Provider ${providerId} not found`);
    }
    
    try {
      await provider.getBestMove(fen, callback, { ...options, modelId });
    } catch (error) {
      console.error(`Error getting move from ${providerId}:`, error);
      throw error;
    }
  };
  
  // Get all available models
  const getAllModels = () => {
    const registry = AIChessProviderRegistry.getInstance();
    return registry.getAllModels();
  };
  
  // Add a custom model
  const addCustomModel = (providerId: string, model: any) => {
    const registry = AIChessProviderRegistry.getInstance();
    const provider = registry.getProvider(providerId);
    
    if (!provider) {
      toast.error(`Provider ${providerId} not found`);
      return false;
    }
    
    try {
      provider.addModel(model);
      setProviders([...registry.getAllProviders()]);
      return true;
    } catch (error) {
      console.error(`Error adding model to ${providerId}:`, error);
      toast.error(`Failed to add model: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  };
  
  // Update a model
  const updateModel = (providerId: string, modelId: string, updates: any) => {
    const registry = AIChessProviderRegistry.getInstance();
    const provider = registry.getProvider(providerId);
    
    if (!provider) {
      toast.error(`Provider ${providerId} not found`);
      return false;
    }
    
    try {
      provider.updateModel(modelId, updates);
      setProviders([...registry.getAllProviders()]);
      return true;
    } catch (error) {
      console.error(`Error updating model ${modelId}:`, error);
      toast.error(`Failed to update model: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  };
  
  // Delete a model
  const deleteModel = (providerId: string, modelId: string) => {
    const registry = AIChessProviderRegistry.getInstance();
    const provider = registry.getProvider(providerId);
    
    if (!provider) {
      toast.error(`Provider ${providerId} not found`);
      return false;
    }
    
    try {
      provider.deleteModel(modelId);
      setProviders([...registry.getAllProviders()]);
      return true;
    } catch (error) {
      console.error(`Error deleting model ${modelId}:`, error);
      toast.error(`Failed to delete model: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  };
  
  return {
    providers,
    isLoading,
    setGeminiApiKey,
    getAIMove,
    getAllModels,
    addCustomModel,
    updateModel,
    deleteModel
  };
}; 