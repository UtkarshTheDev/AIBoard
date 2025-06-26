"use client"

import { useEffect, useState } from 'react';
import { getStockfishService } from '../stockfish-service';

export function useApiStockfish() {
  const [isReady, setIsReady] = useState(false);
  const [service] = useState(getStockfishService());
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Check if Stockfish service is available
    const checkStockfish = async () => {
      setIsChecking(true);
      try {
        const ready = await service.isReady();
        if (mounted) {
          setIsReady(ready);
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

    // Recheck periodically if not ready
    const interval = setInterval(() => {
      if (!isReady && mounted) {
        checkStockfish();
      }
    }, 2000);

    return () => {
      mounted = false;
      clearInterval(interval);
      // Stop any ongoing analysis when component unmounts
      service.stop();
    };
  }, [service, isReady]);

  return { 
    isStockfishReady: isReady,
    isCheckingStockfish: isChecking,
    stockfishService: service
  };
} 