"use client"
import React, { useState, useEffect } from 'react';
import { useChessStore, Player } from '@/lib/store/chess-store';
import { useAIChessProviders } from '@/lib/hooks/useAIChessProviders';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { BrainCircuit, User, Key } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export const AIPlayerConfig = () => {
  const { 
    whitePlayer, 
    blackPlayer, 
    setPlayerSettings, 
    isAIMatch,
    startAIMatch,
    stopAIMatch,
    resetGame
  } = useChessStore();
  
  const { 
    providers, 
    isLoading, 
    setGeminiApiKey, 
    getAllModels 
  } = useAIChessProviders();
  
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySet, setApiKeySet] = useState(false);
  
  // Load stored API key on mount
  useEffect(() => {
    const storedApiKey = localStorage.getItem('gemini_api_key');
    if (storedApiKey) {
      setApiKeyInput(storedApiKey);
      setGeminiApiKey(storedApiKey);
      setApiKeySet(true);
      console.log('[AIPlayerConfig] Loaded API key from localStorage');
    }
  }, [setGeminiApiKey]);
  
  // Get all available models
  const allModels = getAllModels();
  
  // Handle player type change
  const handlePlayerTypeChange = (color: 'white' | 'black', type: 'human' | 'ai') => {
    const currentSettings = color === 'white' ? whitePlayer : blackPlayer;
    
    if (type === 'human') {
      setPlayerSettings(color, { 
        ...currentSettings, 
        type, 
        name: 'Human' 
      });
    } else {
      // Check if API key is set for Gemini
      if (!apiKeySet) {
        toast.error("Please set your Gemini API key first");
        return;
      }
      
      // Default to first available provider and model if switching to AI
      const defaultProvider = providers[0];
      const defaultModel = defaultProvider?.models[0];
      
      setPlayerSettings(color, { 
        ...currentSettings, 
        type, 
        name: defaultModel ? defaultModel.name : 'AI',
        providerId: defaultProvider?.id,
        modelId: defaultModel?.id
      });
    }
  };
  
  // Handle provider change
  const handleProviderChange = (color: 'white' | 'black', providerId: string) => {
    const currentSettings = color === 'white' ? whitePlayer : blackPlayer;
    const provider = providers.find(p => p.id === providerId);
    const defaultModel = provider?.models[0];
    
    setPlayerSettings(color, { 
      ...currentSettings, 
      providerId,
      modelId: defaultModel?.id,
      name: defaultModel ? defaultModel.name : 'AI'
    });
  };
  
  // Handle model change
  const handleModelChange = (color: 'white' | 'black', modelId: string) => {
    const currentSettings = color === 'white' ? whitePlayer : blackPlayer;
    const provider = providers.find(p => p.id === currentSettings.providerId);
    const model = provider?.models.find(m => m.id === modelId);
    
    setPlayerSettings(color, { 
      ...currentSettings, 
      modelId,
      name: model ? model.name : 'AI'
    });
  };
  
  // Handle API key update
  const handleApiKeyUpdate = () => {
    if (!apiKeyInput.trim()) {
      toast.error("Please enter a valid API key");
      return;
    }
    
    try {
      setGeminiApiKey(apiKeyInput);
      localStorage.setItem('gemini_api_key', apiKeyInput);
      setApiKeySet(true);
      toast.success("API key set successfully");
    } catch (error) {
      console.error("[AIPlayerConfig] Error setting API key:", error);
      toast.error("Failed to set API key");
    }
  };
  
  // Handle AI match toggle
  const handleAIMatchToggle = (enabled: boolean) => {
    // Check if API key is set for Gemini when enabling AI match
    if (enabled && !apiKeySet) {
      toast.error("Please set your Gemini API key first");
      return;
    }
    
    if (enabled) {
      startAIMatch();
    } else {
      stopAIMatch();
    }
    resetGame();
  };
  
  return (
    <div className="flex flex-col gap-4 p-4 border rounded-md">
      <h3 className="text-lg font-medium">AI Players Configuration</h3>
      
      {/* Gemini API Key */}
      <div className="space-y-2">
        <Label htmlFor="gemini-api-key">Gemini API Key</Label>
        <div className="flex gap-2">
          <Input
            id="gemini-api-key"
            type={showApiKey ? "text" : "password"}
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="Enter your Gemini API key"
          />
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setShowApiKey(!showApiKey)}
          >
            <Key className="h-4 w-4" />
          </Button>
          <Button onClick={handleApiKeyUpdate}>
            Save
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          Required for using Gemini models. Get your API key from{" "}
          <a 
            href="https://ai.google.dev/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            Google AI Studio
          </a>
        </p>
        {apiKeySet && <p className="text-xs text-green-500">API key is set ✓</p>}
      </div>
      
      {/* AI vs AI Match Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="ai-match">AI vs AI Match</Label>
          <p className="text-xs text-gray-500">Let two AI models play against each other</p>
        </div>
        <Switch 
          id="ai-match"
          checked={isAIMatch}
          onCheckedChange={handleAIMatchToggle}
          disabled={!apiKeySet}
        />
      </div>
      
      {/* Player Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        {/* White Player */}
        <div className="space-y-3 p-3 border rounded-md">
          <h4 className="font-medium">White Player</h4>
          
          <div className="flex items-center gap-4">
            <Label htmlFor="white-player-type">Type</Label>
            <div className="flex items-center gap-2">
              <Button
                variant={whitePlayer.type === 'human' ? "default" : "outline"}
                size="sm"
                onClick={() => handlePlayerTypeChange('white', 'human')}
              >
                <User className="w-4 h-4 mr-1" />
                Human
              </Button>
              <Button
                variant={whitePlayer.type === 'ai' ? "default" : "outline"}
                size="sm"
                onClick={() => handlePlayerTypeChange('white', 'ai')}
              >
                <BrainCircuit className="w-4 h-4 mr-1" />
                AI
              </Button>
            </div>
          </div>
          
          {whitePlayer.type === 'ai' && (
            <>
              <div className="space-y-1">
                <Label htmlFor="white-provider">AI Provider</Label>
                <select
                  id="white-provider"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={whitePlayer.providerId}
                  onChange={(e) => handleProviderChange('white', e.target.value)}
                  disabled={isLoading}
                >
                  {providers.map(provider => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="white-model">AI Model</Label>
                <select
                  id="white-model"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={whitePlayer.modelId}
                  onChange={(e) => handleModelChange('white', e.target.value)}
                  disabled={isLoading || !whitePlayer.providerId}
                >
                  {providers
                    .find(p => p.id === whitePlayer.providerId)
                    ?.models.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                </select>
              </div>
            </>
          )}
        </div>
        
        {/* Black Player */}
        <div className="space-y-3 p-3 border rounded-md">
          <h4 className="font-medium">Black Player</h4>
          
          <div className="flex items-center gap-4">
            <Label htmlFor="black-player-type">Type</Label>
            <div className="flex items-center gap-2">
              <Button
                variant={blackPlayer.type === 'human' ? "default" : "outline"}
                size="sm"
                onClick={() => handlePlayerTypeChange('black', 'human')}
              >
                <User className="w-4 h-4 mr-1" />
                Human
              </Button>
              <Button
                variant={blackPlayer.type === 'ai' ? "default" : "outline"}
                size="sm"
                onClick={() => handlePlayerTypeChange('black', 'ai')}
              >
                <BrainCircuit className="w-4 h-4 mr-1" />
                AI
              </Button>
            </div>
          </div>
          
          {blackPlayer.type === 'ai' && (
            <>
              <div className="space-y-1">
                <Label htmlFor="black-provider">AI Provider</Label>
                <select
                  id="black-provider"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={blackPlayer.providerId}
                  onChange={(e) => handleProviderChange('black', e.target.value)}
                  disabled={isLoading}
                >
                  {providers.map(provider => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="black-model">AI Model</Label>
                <select
                  id="black-model"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={blackPlayer.modelId}
                  onChange={(e) => handleModelChange('black', e.target.value)}
                  disabled={isLoading || !blackPlayer.providerId}
                >
                  {providers
                    .find(p => p.id === blackPlayer.providerId)
                    ?.models.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                </select>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}; 