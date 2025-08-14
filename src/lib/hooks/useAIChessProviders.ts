"use client"
import { useState, useEffect } from 'react';
import { AIChessProvider, AIRequestOptions, AIChessModel } from '@/types/ai-chess-provider';
import { AIChessProviderRegistry } from '@/lib/ai-chess/provider-registry';
import { FallbackManager } from '@/lib/ai-chess/fallback-manager';

import { toast } from 'sonner';

// Track active requests globally to prevent duplicate calls
const activeRequests = new Map<string, Promise<void>>();

export const useAIChessProviders = () => {
  const [providers, setProviders] = useState<AIChessProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [geminiApiKey, setGeminiApiKeyState] = useState<string>('');
  const [isGeminiApiKeySet, setIsGeminiApiKeySet] = useState<boolean>(false);

  // Initialize providers and load API key
  useEffect(() => {
    const registry = AIChessProviderRegistry.getInstance();
    setProviders(registry.getAllProviders());
    setIsLoading(false);

    // Load stored API key on mount
    const storedApiKey = localStorage.getItem('gemini_api_key');
    if (storedApiKey) {
      setGeminiApiKeyState(storedApiKey);
      setIsGeminiApiKeySet(true);
    }

    // Clean up on unmount
    return () => {
      registry.cleanup();
    };
  }, []);
  
  // Set Gemini API key with state management
  const setGeminiApiKey = (apiKey: string) => {
    const registry = AIChessProviderRegistry.getInstance();
    const geminiProvider = registry.getProvider('gemini');

    if (geminiProvider && 'setApiKey' in geminiProvider) {
      (geminiProvider as { setApiKey: (key: string) => void }).setApiKey(apiKey);

      // Update local state
      setGeminiApiKeyState(apiKey);
      setIsGeminiApiKeySet(!!apiKey);

      // Store in localStorage
      if (apiKey) {
        localStorage.setItem('gemini_api_key', apiKey);
      } else {
        localStorage.removeItem('gemini_api_key');
      }

      console.log('[useAIChessProviders] Set Gemini API key and updated state');
    } else {
      console.error('[useAIChessProviders] Gemini provider not found or does not support setApiKey');
    }
  };
  
  // Get AI move from a provider with automatic fallback
  const getAIMove = async (
    providerId: string,
    modelId: string,
    fen: string,
    callback: (bestMove: string) => void,
    options?: AIRequestOptions
  ) => {
    // Create a unique request ID to avoid duplicate calls
    const requestId = `${providerId}-${modelId}-${fen}-${Date.now()}`;

    // Check if this exact request is already in progress
    if (activeRequests.has(requestId)) {
      console.log(`[useAIChessProviders] Request ${requestId} already in progress, reusing promise`);
      return activeRequests.get(requestId);
    }

    try {
      console.log(`[useAIChessProviders] Getting move from ${providerId} (${modelId}) for position: ${fen.substring(0, 20)}...`);

      // Create a promise for this request using fallback manager
      const fallbackManager = FallbackManager.getInstance();
      const requestPromise = fallbackManager.executeWithFallback(
        providerId,
        modelId,
        fen,
        callback,
        options
      );

      // Store the promise in the activeRequests map
      activeRequests.set(requestId, requestPromise);

      // Wait for the request to complete
      await requestPromise;

      // Remove the request from the activeRequests map
      activeRequests.delete(requestId);

      console.log(`[useAIChessProviders] Successfully got move from ${providerId} (${modelId})`);
    } catch (error) {
      // Remove the request from the activeRequests map
      activeRequests.delete(requestId);

      console.error(`[useAIChessProviders] Error getting move from ${providerId}:`, error);
      throw error;
    }
  };
  
  // Get all available models
  const getAllModels = () => {
    const registry = AIChessProviderRegistry.getInstance();
    return registry.getAllModels();
  };
  
  // Add a custom model
  const addCustomModel = (providerId: string, model: AIChessModel) => {
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
  const updateModel = (providerId: string, modelId: string, updates: Partial<AIChessModel>) => {
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
  
  // Get provider status for debugging
  const getProviderStatus = () => {
    const fallbackManager = FallbackManager.getInstance();
    return fallbackManager.getProviderStatus();
  };

  // Reset provider states
  const resetProviderStates = () => {
    const fallbackManager = FallbackManager.getInstance();
    fallbackManager.reset();
    toast.success('Provider states reset');
  };

  return {
    providers,
    isLoading,
    geminiApiKey,
    isGeminiApiKeySet,
    setGeminiApiKey,
    getAIMove,
    getAllModels,
    addCustomModel,
    updateModel,
    deleteModel,
    getProviderStatus,
    resetProviderStates
  };
}; 