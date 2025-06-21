"use client"
import React, { useEffect, useState } from 'react';
import { useChessStore } from '@/lib/store/chess-store';
import { useApiStockfish } from '@/lib/hooks/useApiStockfish';
import { Button } from '@/components/ui/button';
import { SearchIcon, AlertCircleIcon } from 'lucide-react';

export const StockfishAnalysis = () => {
  const { currentPosition, historyIndex, updateEvaluation } = useChessStore();
  const { stockfishService, isStockfishReady, isCheckingStockfish } = useApiStockfish();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [bestMove, setBestMove] = useState('');
  const [evaluation, setEvaluation] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFullError, setShowFullError] = useState(false);

  const analyzePosition = async () => {
    if (!stockfishService || isAnalyzing || !isStockfishReady) return;
    
    setIsAnalyzing(true);
    setBestMove('');
    setEvaluation(null);
    setError(null);
    setShowFullError(false);
    
    try {
      await stockfishService.analyzePosition(currentPosition, (evalScore, move) => {
        if (move) {
          setBestMove(move);
          setIsAnalyzing(false);
        }
        
        if (evalScore !== undefined) {
          setEvaluation(evalScore);
          updateEvaluation(historyIndex, evalScore);
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
      setError(errorMessage);
      setIsAnalyzing(false);
    }
  };

  // Stop analysis when component unmounts
  useEffect(() => {
    return () => {
      stockfishService?.stop();
    };
  }, [stockfishService]);

  const toggleErrorDetails = () => {
    setShowFullError(!showFullError);
  };

  return (
    <div className="flex flex-col gap-3 p-4 border rounded-md">
      <h3 className="text-lg font-medium">Stockfish Analysis</h3>
      
      <Button 
        onClick={analyzePosition} 
        disabled={isAnalyzing || !isStockfishReady || isCheckingStockfish}
      >
        <SearchIcon className="w-4 h-4 mr-1" />
        {isAnalyzing ? 'Analyzing...' : 'Analyze Position'}
      </Button>
      
      {evaluation !== null && (
        <div className="mt-2">
          <div className="flex justify-between">
            <span className="font-medium">Evaluation:</span>
            <span className={evaluation > 0 ? 'text-green-600' : evaluation < 0 ? 'text-red-600' : ''}>
              {evaluation > 0 ? '+' : ''}{evaluation.toFixed(2)}
            </span>
          </div>
        </div>
      )}
      
      {bestMove && (
        <div className="mt-1">
          <div className="flex justify-between">
            <span className="font-medium">Best move:</span>
            <span className="font-mono">{bestMove}</span>
          </div>
        </div>
      )}
      
      {error && (
        <div className="mt-2 text-red-500 text-sm border border-red-200 rounded-md p-2">
          <div className="flex items-start gap-2">
            <AlertCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium">Error: {error.includes('\n') ? error.split('\n')[0] : error}</div>
              {error.includes('\n') && (
                <div>
                  {showFullError ? (
                    <div className="mt-2 whitespace-pre-wrap text-xs">
                      {error.split('\n').slice(1).join('\n')}
                    </div>
                  ) : (
                    <button 
                      onClick={toggleErrorDetails}
                      className="text-blue-500 hover:underline text-xs mt-1"
                    >
                      Show details
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {isCheckingStockfish && (
        <div className="text-yellow-600 text-sm mt-2">
          Checking Stockfish availability...
        </div>
      )}
      
      {!isStockfishReady && !isCheckingStockfish && !error && (
        <div className="text-red-600 text-sm mt-2">
          Stockfish is not available. Please check if it's installed correctly.
        </div>
      )}
    </div>
  );
}; 