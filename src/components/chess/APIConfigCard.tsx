"use client"
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KeyIcon, SaveIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAIChessProviders } from '@/lib/hooks/useAIChessProviders';

interface APIConfigCardProps {
  onApiKeyUpdate?: (apiKey: string) => void;
}

export const APIConfigCard: React.FC<APIConfigCardProps> = ({
  onApiKeyUpdate
}) => {
  const { geminiApiKey, setGeminiApiKey } = useAIChessProviders();
  const [localApiKey, setLocalApiKey] = useState('');

  // Sync local state with global state
  useEffect(() => {
    setLocalApiKey(geminiApiKey);
  }, [geminiApiKey]);

  // Handle API key update
  const handleSave = () => {
    try {
      // Update through the centralized hook
      setGeminiApiKey(localApiKey);

      // Call the optional callback for backward compatibility
      if (onApiKeyUpdate) {
        onApiKeyUpdate(localApiKey);
      }

      toast.success('API key updated successfully');
    } catch (error) {
      toast.error('Failed to update API key');
    }
  };
  return (
    <Card className="h-fit">
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
            <Button onClick={handleSave}>
              <SaveIcon className="h-4 w-4 mr-1" />
              Save
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Get your API key from{' '}
            <a 
              href="https://ai.google.dev/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-primary hover:underline"
            >
              Google AI Studio
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
