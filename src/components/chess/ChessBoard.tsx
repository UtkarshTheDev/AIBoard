"use client"
import React, { useCallback, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { useChessStore, MoveInput } from '@/lib/store/chess-store';
import { useAIChessProviders } from '@/lib/contexts/AIChessProviderContext';

import { ChessTimer } from './ChessTimer';
import { MoveHistory } from './MoveHistory';
import { GameStatus } from './GameStatus';
import { StockfishAnalysis } from './StockfishAnalysis';
import { AIPlayerConfig } from './AIPlayerConfig';
import { AIModelManager } from './AIModelManager';
import { AIMatch } from './AIMatch';
import { CustomModelCard } from './CustomModelCard';
import { APIConfigCard } from './APIConfigCard';
import { AvailableModelsCard } from './AvailableModelsCard';
import { Button } from '@/components/ui/button';
import { PlayIcon, Settings } from 'lucide-react';
import { Square } from 'chess.js';

// Define types for square styles
interface SquareStyles {
  [square: string]: {
    background?: string;
    backgroundColor?: string;
    borderRadius?: string;
  };
}

export const ChessBoard = () => {
  const { 
    game, 
    currentPosition, 
    makeMove, 
    isGameOver,
    isTimerRunning,
    startTimer,
    isAIMatch,
    isAIGameStarted,
    startAIGame,
    stopAIGame
  } = useChessStore();

  const {
    providers,
    setGeminiApiKey,
    addCustomModel,
    updateModel,
    deleteModel
  } = useAIChessProviders();

  const [moveFrom, setMoveFrom] = useState<Square | null>(null);
  const [optionSquares, setOptionSquares] = useState<SquareStyles>({});
  const [rightClickedSquares, setRightClickedSquares] = useState<SquareStyles>({});

  // Get all possible moves for a piece
  const getMoveOptions = (square: Square) => {
    const moves = game.moves({
      square,
      verbose: true
    });
    
    if (moves.length === 0) {
      return;
    }

    const newSquares: SquareStyles = {};
    
    // Highlight the selected square
    newSquares[square] = {
      background: 'rgba(255, 255, 0, 0.4)',
      borderRadius: '50%'
    };
    
    // Highlight possible moves
    moves.forEach((move) => {
      const pieceOnTarget = game.get(move.to);
      newSquares[move.to] = {
        background:
          pieceOnTarget && pieceOnTarget.color !== game.get(square)?.color
            ? 'rgba(255, 0, 0, 0.4)'
            : 'rgba(0, 255, 0, 0.4)',
        borderRadius: '50%'
      };
    });
    
    return newSquares;
  };

  // Handle when a square is clicked
  const onSquareClick = (square: Square) => {
    if (isGameOver) return;
    
    // Start the timer if it's not running yet
    if (!isTimerRunning) {
      startTimer();
    }

    // Check if we already have a piece selected
    if (moveFrom) {
      // Try to make a move
      const move: MoveInput = {
        from: moveFrom,
        to: square,
        promotion: 'q' // Always promote to queen for simplicity
      };

      // Attempt to make the move
      try {
        const result = makeMove(move);
        
        // Reset selection
        setMoveFrom(null);
        setOptionSquares({});
        
        if (result) {
          return;
        }
      } catch (e) {
        // Invalid move
      }
    }

    // Either no piece was selected yet or the move was invalid
    const piece = game.get(square);
    
    // Don't select empty squares or opponent's pieces
    if (!piece || piece.color !== game.turn()) {
      setMoveFrom(null);
      setOptionSquares({});
      return;
    }

    // Select the piece and show move options
    setMoveFrom(square);
    setOptionSquares(getMoveOptions(square) || {});
  };

  // Handle when a piece is dropped (drag and drop)
  const onDrop = (sourceSquare: Square, targetSquare: Square) => {
    if (isGameOver) return false;
    
    // Start the timer if it's not running yet
    if (!isTimerRunning) {
      startTimer();
    }

    try {
      const move: MoveInput = {
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q' // Always promote to queen for simplicity
      };
      
      const result = makeMove(move);
      
      // Reset any highlighted squares
      setMoveFrom(null);
      setOptionSquares({});
      
      return result;
    } catch (e) {
      return false;
    }
  };

  // Handle right click to mark squares (useful for planning)
  const onSquareRightClick = (square: Square) => {
    const color = "rgba(0, 0, 255, 0.4)";
    setRightClickedSquares({
      ...rightClickedSquares,
      [square]:
        rightClickedSquares[square] && rightClickedSquares[square].backgroundColor === color
          ? {}
          : { backgroundColor: color }
    });
  };

  // AI match controller (no UI, just logic)
  const [showSettings, setShowSettings] = useState(false);

  // Note: API key updates are now handled centrally through useAIChessProviders

  // Handle model toggle
  const handleModelToggle = (providerId: string, modelId: string, enabled: boolean) => {
    updateModel(providerId, modelId, { enabled });
  };

  // Handle delete model
  const handleDeleteModel = (providerId: string, modelId: string) => {
    if (confirm('Are you sure you want to delete this model?')) {
      deleteModel(providerId, modelId);
    }
  };
  
  return (
    <>
      {/* AI Match controller (no UI) */}
      <AIMatch />
      
      <div className="flex flex-col gap-6 p-4 max-w-7xl mx-auto">
        {/* Main game section */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left column - Chessboard and controls */}
          <div className="flex flex-col gap-4 flex-1">
            <div className="w-full max-w-md mx-auto">
              <Chessboard
                position={currentPosition}
                boardWidth={400}
                areArrowsAllowed={true}
                onSquareClick={onSquareClick}
                onPieceDrop={onDrop}
                onSquareRightClick={onSquareRightClick}
                customSquareStyles={{
                  ...optionSquares,
                  ...rightClickedSquares
                }}
                customBoardStyle={{
                  borderRadius: '4px',
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
                }}
              />
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                onClick={() => isAIGameStarted ? stopAIGame() : startAIGame()}
                variant={isAIGameStarted ? "destructive" : "default"}
                size="lg"
              >
                <PlayIcon className="h-4 w-4 mr-2" />
                {isAIGameStarted ? "Stop Game" : "Start Game"}
              </Button>

              <Button
                onClick={() => setShowSettings(!showSettings)}
                variant="outline"
                size="lg"
              >
                <Settings className="w-4 h-4 mr-2" />
                {showSettings ? "Hide Settings" : "AI Settings"}
              </Button>
            </div>

            <div className="mt-4">
              <ChessTimer />
            </div>
          </div>

          {/* Right column - Game Status, History and Analysis */}
          <div className="flex flex-col gap-4 w-full lg:w-80">
            <GameStatus />
            <MoveHistory />
            <StockfishAnalysis />
          </div>
        </div>

        {/* Bottom section - AI Settings Bento Grid (when expanded) */}
        {showSettings && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            {/* Left side - Player Config + Custom Model */}
            <div className="flex flex-col gap-6 h-fit">
              <AIPlayerConfig />
              <CustomModelCard
                providers={providers}
                onAddModel={addCustomModel}
              />
            </div>

            {/* Right side - API Config + Available Models */}
            <div className="flex flex-col gap-6 h-fit">
              <APIConfigCard />
              <AvailableModelsCard
                providers={providers}
                onModelToggle={handleModelToggle}
                onDeleteModel={handleDeleteModel}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
};
