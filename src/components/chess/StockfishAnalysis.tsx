"use client"
import React, { useEffect, useState } from 'react';
import { useChessStore } from '@/lib/store/chess-store';
import { useStockfish } from '@/lib/hooks/useStockfish';
import { Button } from '@/components/ui/button';
import { SearchIcon, AlertCircleIcon, StopCircleIcon } from 'lucide-react';

export const StockfishAnalysis = () => {
  const { currentPosition, historyIndex, updateEvaluation } = useChessStore();
  const {
    isReady: isStockfishReady,
    isAnalyzing,
    currentAnalysis,
    error,
    analyzePosition,
    stopAnalysis,
    clearError
  } = useStockfish();
  const [showFullError, setShowFullError] = useState(false);
  const [autoAnalyze, setAutoAnalyze] = useState(false);
  const [analysisDepth, setAnalysisDepth] = useState(15);
  const [analysisTime, setAnalysisTime] = useState(5000);

  const handleAnalyzePosition = async () => {
    if (isAnalyzing || !isStockfishReady) return;

    setShowFullError(false);
    clearError();

    try {
      await analyzePosition(currentPosition, {
        depth: analysisDepth,
        timeLimit: analysisTime
      });
    } catch (error) {
      console.error('Analysis failed:', error);
    }
  };

  // Auto-analyze when position changes
  useEffect(() => {
    if (autoAnalyze && isStockfishReady && !isAnalyzing && currentPosition) {
      const timeoutId = setTimeout(() => {
        handleAnalyzePosition();
      }, 500); // Debounce analysis

      return () => clearTimeout(timeoutId);
    }
  }, [currentPosition, autoAnalyze, isStockfishReady, isAnalyzing]);

  // Update evaluation when analysis completes
  useEffect(() => {
    if (currentAnalysis && currentAnalysis.evaluation !== undefined) {
      updateEvaluation(historyIndex, currentAnalysis.evaluation);
    }
  }, [currentAnalysis, historyIndex, updateEvaluation]);

  const toggleErrorDetails = () => {
    setShowFullError(!showFullError);
  };

  const handleStopAnalysis = () => {
    stopAnalysis();
  };

  const testStockfish = async () => {
    // Test with starting position
    const startingFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    try {
      await analyzePosition(startingFen, {
        depth: 10,
        timeLimit: 3000
      });
    } catch (error) {
      console.error('Stockfish test failed:', error);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4 border rounded-md">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Stockfish Analysis</h3>
        <div className="flex items-center gap-2">
          <label className="text-sm">
            <input
              type="checkbox"
              checked={autoAnalyze}
              onChange={(e) => setAutoAnalyze(e.target.checked)}
              className="mr-1"
            />
            Auto-analyze
          </label>
        </div>
      </div>

      {/* Configuration Controls */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Depth</label>
          <select
            value={analysisDepth}
            onChange={(e) => setAnalysisDepth(Number(e.target.value))}
            className="w-full p-1 border rounded text-sm"
            disabled={isAnalyzing}
          >
            <option value={10}>10 (Fast)</option>
            <option value={15}>15 (Balanced)</option>
            <option value={20}>20 (Deep)</option>
            <option value={25}>25 (Very Deep)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Time (ms)</label>
          <select
            value={analysisTime}
            onChange={(e) => setAnalysisTime(Number(e.target.value))}
            className="w-full p-1 border rounded text-sm"
            disabled={isAnalyzing}
          >
            <option value={3000}>3s (Fast)</option>
            <option value={5000}>5s (Balanced)</option>
            <option value={10000}>10s (Thorough)</option>
            <option value={15000}>15s (Very Thorough)</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleAnalyzePosition}
          disabled={isAnalyzing || !isStockfishReady}
          className="flex-1"
        >
          <SearchIcon className="w-4 h-4 mr-1" />
          {isAnalyzing ? 'Analyzing...' : 'Analyze Position'}
        </Button>

        {isAnalyzing && (
          <Button
            onClick={handleStopAnalysis}
            variant="outline"
            size="sm"
          >
            <StopCircleIcon className="w-4 h-4" />
          </Button>
        )}
      </div>

      {!isStockfishReady && (
        <div className="text-sm text-yellow-600">
          Initializing Stockfish engine...
          <Button
            onClick={testStockfish}
            variant="outline"
            size="sm"
            className="ml-2"
          >
            Test Engine
          </Button>
        </div>
      )}

      {currentAnalysis && (
        <div className="mt-2 space-y-2">
          <div className="flex justify-between">
            <span className="font-medium">Evaluation:</span>
            <span className={currentAnalysis.evaluation > 0 ? 'text-green-600' : currentAnalysis.evaluation < 0 ? 'text-red-600' : ''}>
              {currentAnalysis.evaluation > 0 ? '+' : ''}{currentAnalysis.evaluation.toFixed(2)}
            </span>
          </div>

          {currentAnalysis.depth && (
            <div className="flex justify-between">
              <span className="font-medium">Depth:</span>
              <span>{currentAnalysis.depth}</span>
            </div>
          )}
        </div>
      )}

      {currentAnalysis?.bestMove && (
        <div className="mt-1">
          <div className="flex justify-between">
            <span className="font-medium">Best move:</span>
            <span className="font-mono">{currentAnalysis.bestMove}</span>
          </div>
        </div>
      )}
      
      {error && (
        <div className="mt-2 text-red-500 text-sm border border-red-200 rounded-md p-2">
          <div className="flex items-start gap-2">
            <AlertCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
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
              <button
                onClick={clearError}
                className="text-blue-500 hover:underline text-xs mt-1 ml-2"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {!isStockfishReady && !error && (
        <div className="text-yellow-600 text-sm mt-2">
          Stockfish engine is initializing. Please wait...
        </div>
      )}
    </div>
  );
}; 