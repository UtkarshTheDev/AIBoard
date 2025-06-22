"use client"
import React from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrainIcon, Trash2Icon } from 'lucide-react';

interface Model {
  id: string;
  name: string;
  description?: string;
  strength?: string;
  enabled?: boolean;
  custom?: boolean;
}

interface Provider {
  id: string;
  name: string;
  models: Model[];
}

interface AvailableModelsCardProps {
  providers: Provider[];
  onModelToggle: (providerId: string, modelId: string, enabled: boolean) => void;
  onDeleteModel: (providerId: string, modelId: string) => void;
}

export const AvailableModelsCard: React.FC<AvailableModelsCardProps> = ({ 
  providers, 
  onModelToggle, 
  onDeleteModel 
}) => {
  return (
    <Card className="flex-1 h-full">
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
          <div className="text-muted-foreground text-center py-8">
            No AI providers available
          </div>
        ) : (
          <div className="space-y-6">
            {providers.map(provider => (
              <div key={provider.id} className="space-y-3">
                <h4 className="font-medium text-lg border-b pb-2">
                  {provider.name}
                </h4>

                <div className="space-y-3">
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
                          <div className="text-sm text-muted-foreground truncate">
                            {model.description}
                          </div>
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
                            onCheckedChange={(checked) => 
                              onModelToggle(provider.id, model.id, checked)
                            }
                          />
                          <span className="text-sm whitespace-nowrap">
                            {model.enabled !== false ? 'On' : 'Off'}
                          </span>
                        </div>

                        {model.custom && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDeleteModel(provider.id, model.id)}
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
  );
};
