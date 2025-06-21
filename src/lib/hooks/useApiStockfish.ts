"use client"

import { useEffect, useState } from 'react';
import { getApiStockfishService } from '../api-stockfish-service';

export function useApiStockfish() {
  const [isReady, setIsReady] = useState(false);
  const [service] = useState(getApiStockfishService());
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    // Check if Stockfish API is available
    const checkStockfish = async () => {
      setIsChecking(true);
      try {
        const response = await fetch('/api/stockfish');
        if (!response.ok) {
          throw new Error('Stockfish API not available');
        }
        
        const data = await response.json();
        if (mounted) {
          setIsReady(data.stockfishAvailable === true);
        }
      } catch (error) {
        console.error('Error checking Stockfish availability:', error);
        if (mounted) {
          setIsReady(false);
        }
      } finally {
        if (mounted) {
          setIsChecking(false);
        }
      }
    };
    
    checkStockfish();
    
    return () => {
      mounted = false;
      // Stop any ongoing analysis when component unmounts
      service.stop();
    };
  }, [service]);

  return { 
    isStockfishReady: isReady,
    isCheckingStockfish: isChecking,
    stockfishService: service
  };
} 