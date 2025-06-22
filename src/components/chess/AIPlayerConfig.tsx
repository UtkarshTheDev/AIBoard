"use client"
import React, { useState, useEffect } from 'react';
import { useChessStore, Player } from '@/lib/store/chess-store';
import { useAIChessProviders } from '@/lib/hooks/useAIChessProviders';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrainCircuit, User, Users, Settings2 } from 'lucide-react';
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
  
  const [apiKeySet, setApiKeySet] = useState(false);
  
  // Check if API key is set on mount
  useEffect(() => {
    const storedApiKey = localStorage.getItem('gemini_api_key');
    if (storedApiKey) {
      setApiKeySet(true);
    }
  }, []);
  
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
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          Player Configuration
        </CardTitle>
        <CardDescription>
          Configure human and AI players for your chess game
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* API Key Status */}
        {!apiKeySet && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              ⚠️ Gemini API key not set. Please configure it in AI Settings to use AI players.
            </p>
          </div>
        )}

        {/* AI vs AI Match Toggle */}
        <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <Label htmlFor="ai-match" className="text-base font-medium">AI vs AI Match</Label>
              <p className="text-sm text-muted-foreground">Let two AI models play against each other</p>
            </div>
          </div>
          <Switch
            id="ai-match"
            checked={isAIMatch}
            onCheckedChange={handleAIMatchToggle}
            disabled={!apiKeySet}
          />
        </div>

        {/* Player Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* White Player */}
          <div className="space-y-4 p-4 border rounded-lg bg-card">
            <h4 className="font-medium flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-white border-2 border-gray-300"></div>
              White Player
            </h4>
          
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
          <div className="space-y-4 p-4 border rounded-lg bg-card">
            <h4 className="font-medium flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-black"></div>
              Black Player
            </h4>
          
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
      </CardContent>
    </Card>
  );
}; 