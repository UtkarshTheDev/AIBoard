"use client"
import React, { useState, useEffect } from 'react';
import { useAIChessProviders } from '@/lib/hooks/useAIChessProviders';
import { AIChessProviderRegistry } from '@/lib/ai-chess/provider-registry';
import { FallbackManager } from '@/lib/ai-chess/fallback-manager';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Debug component for monitoring AI chess system health
 */
export const AIMatchDebugger = () => {
  const { getProviderStatus, resetProviderStates } = useAIChessProviders();
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [isVisible, setIsVisible] = useState(false);

  // Update debug info every 2 seconds
  useEffect(() => {
    if (!isVisible) return;

    const updateDebugInfo = () => {
      const registry = AIChessProviderRegistry.getInstance();
      const fallbackManager = FallbackManager.getInstance();
      
      // Get Gemini provider status
      const geminiProvider = registry.getProvider('gemini') as any;
      const geminiStatus = geminiProvider?.getQueueStatus?.() || {};
      
      // Get provider status from fallback manager
      const providerStatus = getProviderStatus();
      
      setDebugInfo({
        timestamp: new Date().toISOString(),
        geminiQueue: geminiStatus,
        providerStatus,
        fallbackManager: {
          available: !!fallbackManager
        }
      });
    };

    updateDebugInfo();
    const interval = setInterval(updateDebugInfo, 2000);

    return () => clearInterval(interval);
  }, [isVisible, getProviderStatus]);

  if (!isVisible) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50"
      >
        Debug AI
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-96 overflow-auto">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex justify-between items-center">
            AI System Debug
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsVisible(false)}
            >
              ×
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-3">
          {/* Gemini Queue Status */}
          <div>
            <h4 className="font-semibold text-green-600">Gemini Queue Status</h4>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <span>Queue Length:</span>
              <span className="font-mono">{debugInfo.geminiQueue?.queueLength || 0}</span>
              
              <span>Processing:</span>
              <span className="font-mono">{debugInfo.geminiQueue?.isProcessing ? 'Yes' : 'No'}</span>
              
              <span>Active Requests:</span>
              <span className="font-mono">{debugInfo.geminiQueue?.activeRequests || 0}</span>
              
              <span>Request Count:</span>
              <span className="font-mono">{debugInfo.geminiQueue?.requestCount || 0}/30</span>
              
              <span>Burst Count:</span>
              <span className="font-mono">{debugInfo.geminiQueue?.burstCount || 0}/5</span>
              
              <span>Backoff Delay:</span>
              <span className="font-mono">{debugInfo.geminiQueue?.currentBackoffDelay || 0}ms</span>
              
              <span>Failures:</span>
              <span className="font-mono">{debugInfo.geminiQueue?.consecutiveFailures || 0}</span>
            </div>
          </div>

          {/* Provider Status */}
          <div>
            <h4 className="font-semibold text-blue-600">Provider Status</h4>
            {Object.entries(debugInfo.providerStatus || {}).map(([providerId, status]: [string, any]) => (
              <div key={providerId} className="mb-2">
                <div className="font-medium">{providerId}</div>
                <div className="grid grid-cols-2 gap-1 text-xs ml-2">
                  <span>Failures:</span>
                  <span className="font-mono">{status.failures}</span>
                  
                  <span>Disabled:</span>
                  <span className={`font-mono ${status.disabled ? 'text-red-500' : 'text-green-500'}`}>
                    {status.disabled ? 'Yes' : 'No'}
                  </span>
                  
                  {status.lastFailure > 0 && (
                    <>
                      <span>Last Failure:</span>
                      <span className="font-mono">
                        {Math.round((Date.now() - status.lastFailure) / 1000)}s ago
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={resetProviderStates}
              className="w-full"
            >
              Reset Provider States
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                const registry = AIChessProviderRegistry.getInstance();
                const geminiProvider = registry.getProvider('gemini') as any;
                if (geminiProvider?.clearQueue) {
                  geminiProvider.clearQueue();
                }
              }}
              className="w-full"
            >
              Clear Gemini Queue
            </Button>
          </div>

          {/* Timestamp */}
          <div className="text-xs text-gray-500 border-t pt-2">
            Last updated: {debugInfo.timestamp ? new Date(debugInfo.timestamp).toLocaleTimeString() : 'Never'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
