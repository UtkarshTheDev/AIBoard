"use client"
import React, { useState, useEffect } from 'react';
import { useAIChessProviders } from '@/lib/contexts/AIChessProviderContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CustomModelCard } from './CustomModelCard';
import { toast } from 'sonner';
import { Trash2Icon, SaveIcon, KeyIcon, BrainIcon } from 'lucide-react';

export const AIModelManager = () => {
  // Get providers and models
  const {
    providers,
    isLoading,
    geminiApiKey,
    setGeminiApiKey,
    addCustomModel,
    updateModel,
    deleteModel
  } = useAIChessProviders();

  // State for local API key input
  const [localApiKey, setLocalApiKey] = useState('');

  // Sync local state with global state
  useEffect(() => {
    setLocalApiKey(geminiApiKey);
  }, [geminiApiKey]);
  
  // Handle API key update
  const handleApiKeyUpdate = () => {
    try {
      setGeminiApiKey(localApiKey);
      toast.success('API key updated successfully');
    } catch {
      toast.error('Failed to update API key');
    }
  };
  
  // Handle model toggle
  const handleModelToggle = (providerId: string, modelId: string, enabled: boolean) => {
    updateModel(providerId, modelId, { enabled });
  };
  
  // Handle delete model
  const handleDeleteModel = (providerId: string, modelId: string) => {
    if (confirm('Are you sure you want to delete this model?')) {
      const success = deleteModel(providerId, modelId);
      
      if (success) {
        toast.success('Model deleted successfully');
      }
    }
  };
  
  if (isLoading) {
    return <div className="p-4 font-sans text-foreground">Loading AI providers...</div>;
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* API Key Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyIcon className="h-5 w-5" />
            API Configuration
          </CardTitle>
          <CardDescription>
            Configure your AI provider API keys
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="gemini-api-key">Google AI API Key (for Gemini)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="gemini-api-key"
                type="password"
                value={localApiKey}
                onChange={(e) => setLocalApiKey(e.target.value)}
                placeholder={geminiApiKey ? "API key is set" : "Enter your Google AI API key"}
                className="flex-1"
              />
              <Button onClick={handleApiKeyUpdate}>
                <SaveIcon className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Get your API key from <a href="https://ai.google.dev/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google AI Studio</a>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Custom Model Card */}
      <CustomModelCard
        providers={providers}
        onAddModel={addCustomModel}
      />

      {/* Available Models Card */}
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BrainIcon className="h-5 w-5" />
            Available Models
          </CardTitle>
          <CardDescription>
            Manage and configure your AI models
          </CardDescription>
        </CardHeader>
        <CardContent>
          {providers.length === 0 ? (
            <div className="text-muted-foreground text-center py-8">No AI providers available</div>
          ) : (
            <div className="space-y-6">
              {providers.map(provider => (
                <div key={provider.id} className="space-y-3">
                  <h4 className="font-medium text-lg border-b pb-2">{provider.name}</h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {provider.models.map(model => (
                      <div
                        key={model.id}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                          model.enabled
                            ? 'bg-accent/50 border-accent'
                            : 'bg-muted/50 border-muted'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{model.name}</div>
                          {model.description && (
                            <div className="text-sm text-muted-foreground truncate">{model.description}</div>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            {model.strength && (
                              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                {model.strength}
                              </span>
                            )}
                            {model.custom && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                Custom
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-3">
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={model.enabled !== false}
                              onCheckedChange={(checked) => handleModelToggle(provider.id, model.id, checked)}
                            />
                            <span className="text-sm whitespace-nowrap">
                              {model.enabled !== false ? 'On' : 'Off'}
                            </span>
                          </div>

                          {model.custom && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteModel(provider.id, model.id)}
                              className="hover:bg-destructive/10 flex-shrink-0"
                            >
                              <Trash2Icon className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};