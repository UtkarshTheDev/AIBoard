"use client";
import React, { createContext, useContext } from 'react';
import { useAIChessProviders as useAIChessProvidersState } from '@/lib/hooks/useAIChessProviders';

type AIChessProvidersContextType = ReturnType<typeof useAIChessProvidersState>;

const AIChessProvidersContext = createContext<AIChessProvidersContextType | undefined>(undefined);

export const AIChessProvidersProvider = ({ children }: { children: React.ReactNode }) => {
  const value = useAIChessProvidersState();
  return (
    <AIChessProvidersContext.Provider value={value}>
      {children}
    </AIChessProvidersContext.Provider>
  );
};

export const useAIChessProviders = (): AIChessProvidersContextType => {
  const context = useContext(AIChessProvidersContext);
  if (context === undefined) {
    throw new Error('useAIChessProviders must be used within an AIChessProvidersProvider');
  }
  return context;
};
