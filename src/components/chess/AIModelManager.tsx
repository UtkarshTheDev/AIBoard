"use client"
import React, { useState, useEffect } from 'react';
import { useAIChessProviders } from '@/lib/hooks/useAIChessProviders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { PlusIcon, Trash2Icon, SaveIcon } from 'lucide-react';

export const AIModelManager = () => {
  // Get providers and models
  const { 
    providers, 
    isLoading, 
    setGeminiApiKey, 
    addCustomModel, 
    updateModel,
    deleteModel
  } = useAIChessProviders();
  
  // State for API key
  const [apiKey, setApiKey] = useState('');
  
  // State for new model form
  const [selectedProvider, setSelectedProvider] = useState('');
  const [newModel, setNewModel] = useState({
    id: '',
    name: '',
    description: '',
    strength: ''
  });
  
  // Load stored API key on mount
  useEffect(() => {
    const storedApiKey = localStorage.getItem('gemini_api_key');
    if (storedApiKey) {
      setApiKey(storedApiKey);
      setGeminiApiKey(storedApiKey);
    }
  }, [setGeminiApiKey]);
  
  // Handle API key update
  const handleApiKeyUpdate = () => {
    try {
      setGeminiApiKey(apiKey);
      localStorage.setItem('gemini_api_key', apiKey);
      toast.success('API key updated successfully');
    } catch (error) {
      toast.error('Failed to update API key');
    }
  };
  
  // Handle model toggle
  const handleModelToggle = (providerId: string, modelId: string, enabled: boolean) => {
    updateModel(providerId, modelId, { enabled });
  };
  
  // Handle new model input change
  const handleNewModelChange = (field: string, value: string) => {
    setNewModel(prev => ({ ...prev, [field]: value }));
  };
  
  // Handle add new model
  const handleAddModel = () => {
    if (!selectedProvider) {
      toast.error('Please select a provider');
      return;
    }
    
    if (!newModel.id || !newModel.name) {
      toast.error('Model ID and name are required');
      return;
    }
    
    // Generate a unique ID if not provided
    const modelId = newModel.id || `custom-${Date.now()}`;
    
    const success = addCustomModel(selectedProvider, {
      ...newModel,
      id: modelId,
      custom: true,
      enabled: true
    });
    
    if (success) {
      toast.success('Model added successfully');
      
      // Reset form
      setNewModel({
        id: '',
        name: '',
        description: '',
        strength: ''
      });
    }
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
    <div className="space-y-6 font-sans">
      {/* API Key Section */}
      <div className="p-4 border border-border rounded-md bg-card text-card-foreground">
        <h3 className="text-lg font-medium mb-4 text-foreground">API Keys</h3>

        <div className="space-y-4">
          <div>
            <Label htmlFor="gemini-api-key" className="text-foreground">Google AI API Key (for Gemini)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="gemini-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Google AI API key"
                className="flex-1 bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
              <Button onClick={handleApiKeyUpdate} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <SaveIcon className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Get your API key from <a href="https://ai.google.dev/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google AI Studio</a>
            </p>
          </div>
        </div>
      </div>

      {/* Models Section */}
      <div className="p-4 border border-border rounded-md bg-card text-card-foreground">
        <h3 className="text-lg font-medium mb-4 text-foreground">Available Models</h3>

        {providers.length === 0 ? (
          <div className="text-muted-foreground">No AI providers available</div>
        ) : (
          <div className="space-y-6">
            {providers.map(provider => (
              <div key={provider.id} className="space-y-3">
                <h4 className="font-medium text-foreground">{provider.name}</h4>

                <div className="space-y-2">
                  {provider.models.map(model => (
                    <div
                      key={model.id}
                      className={`flex items-center justify-between p-2 rounded border ${
                        model.enabled
                          ? 'bg-accent/50 border-accent text-accent-foreground'
                          : 'bg-muted/50 border-muted text-muted-foreground'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="font-medium">{model.name}</div>
                        {model.description && (
                          <div className="text-sm text-muted-foreground">{model.description}</div>
                        )}
                        {model.strength && (
                          <div className="text-xs text-muted-foreground">Strength: {model.strength}</div>
                        )}
                        {model.custom && (
                          <div className="text-xs text-primary">Custom model</div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={model.enabled !== false}
                            onCheckedChange={(checked) => handleModelToggle(provider.id, model.id, checked)}
                          />
                          <span className="text-sm">
                            {model.enabled !== false ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>

                        {model.custom && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteModel(provider.id, model.id)}
                            className="hover:bg-destructive/10"
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
      </div>

      {/* Add Custom Model Section */}
      <div className="p-4 border border-border rounded-md bg-card text-card-foreground">
        <h3 className="text-lg font-medium mb-4 text-foreground">Add Custom Model</h3>

        <div className="space-y-4">
          <div>
            <Label htmlFor="provider-select" className="text-foreground">Provider</Label>
            <Select
              id="provider-select"
              value={selectedProvider}
              onValueChange={setSelectedProvider}
              className="w-full mt-1 bg-input border-border text-foreground"
            >
              <option value="">Select a provider</option>
              {providers.map(provider => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="model-id" className="text-foreground">Model ID</Label>
            <Input
              id="model-id"
              value={newModel.id}
              onChange={(e) => handleNewModelChange('id', e.target.value)}
              placeholder="e.g., custom-gpt4"
              className="w-full mt-1 bg-input border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div>
            <Label htmlFor="model-name" className="text-foreground">Model Name</Label>
            <Input
              id="model-name"
              value={newModel.name}
              onChange={(e) => handleNewModelChange('name', e.target.value)}
              placeholder="e.g., Custom GPT-4"
              className="w-full mt-1 bg-input border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div>
            <Label htmlFor="model-description" className="text-foreground">Description (optional)</Label>
            <Input
              id="model-description"
              value={newModel.description}
              onChange={(e) => handleNewModelChange('description', e.target.value)}
              placeholder="e.g., My custom GPT-4 configuration"
              className="w-full mt-1 bg-input border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div>
            <Label htmlFor="model-strength" className="text-foreground">Strength (optional)</Label>
            <Input
              id="model-strength"
              value={newModel.strength}
              onChange={(e) => handleNewModelChange('strength', e.target.value)}
              placeholder="e.g., Advanced"
              className="w-full mt-1 bg-input border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <Button onClick={handleAddModel} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Model
          </Button>
        </div>
      </div>
    </div>
  );
};