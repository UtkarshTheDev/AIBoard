"use client"
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusIcon } from 'lucide-react';
import { toast } from 'sonner';

interface CustomModelCardProps {
  providers: Array<{
    id: string;
    name: string;
    models: Array<{
      id: string;
      name: string;
      description?: string;
      strength?: string;
      enabled?: boolean;
      custom?: boolean;
    }>;
  }>;
  onAddModel: (providerId: string, model: any) => boolean;
}

export const CustomModelCard: React.FC<CustomModelCardProps> = ({ providers, onAddModel }) => {
  const [selectedProvider, setSelectedProvider] = useState('');
  const [newModel, setNewModel] = useState({
    id: '',
    name: '',
    description: '',
    strength: ''
  });

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
    
    const success = onAddModel(selectedProvider, {
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
      setSelectedProvider('');
    }
  };

  return (
    <Card className="flex-1 h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlusIcon className="h-5 w-5" />
          Add Custom Model
        </CardTitle>
        <CardDescription>
          Create your own custom AI model configuration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="provider-select">Provider</Label>
          <Select
            id="provider-select"
            value={selectedProvider}
            onValueChange={setSelectedProvider}
            className="w-full mt-1"
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
          <Label htmlFor="model-id">Model ID</Label>
          <Input
            id="model-id"
            value={newModel.id}
            onChange={(e) => handleNewModelChange('id', e.target.value)}
            placeholder="e.g., custom-gpt4"
            className="w-full mt-1"
          />
        </div>

        <div>
          <Label htmlFor="model-name">Model Name</Label>
          <Input
            id="model-name"
            value={newModel.name}
            onChange={(e) => handleNewModelChange('name', e.target.value)}
            placeholder="e.g., Custom GPT-4"
            className="w-full mt-1"
          />
        </div>

        <div>
          <Label htmlFor="model-description">Description (optional)</Label>
          <Input
            id="model-description"
            value={newModel.description}
            onChange={(e) => handleNewModelChange('description', e.target.value)}
            placeholder="e.g., My custom GPT-4 configuration"
            className="w-full mt-1"
          />
        </div>

        <div>
          <Label htmlFor="model-strength">Strength (optional)</Label>
          <Input
            id="model-strength"
            value={newModel.strength}
            onChange={(e) => handleNewModelChange('strength', e.target.value)}
            placeholder="e.g., Advanced"
            className="w-full mt-1"
          />
        </div>

        <Button onClick={handleAddModel} className="w-full">
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Model
        </Button>
      </CardContent>
    </Card>
  );
};
