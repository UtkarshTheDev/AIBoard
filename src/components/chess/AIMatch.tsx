"use client"
import { useEffect, useState } from 'react';
import { MoveInput, useChessStore } from '@/lib/store/chess-store';
import { useAIChessProviders } from '@/lib/contexts/AIChessProviderContext';
import { AIChessErrorHandler, AIChessError } from '@/lib/ai-chess/error-handler';

// Constants for error handling
const MAX_RETRIES = 3;          // Maximum number of retries

export const AIMatch = () => {
  const {
    currentPosition,
    makeMove,
    isGameOver,
    isAIMatch,
    isAITurn,
    isAIThinking,
    setIsAIThinking,
    whitePlayer,
    blackPlayer,
    game,
    isAIGameStarted
  } = useChessStore();
  
  const { getAIMove } = useAIChessProviders();
  const [retryCount, setRetryCount] = useState(0);
  const [errorHistory, setErrorHistory] = useState<AIChessError[]>([]);
  
  // Track the current player's turn
  const [currentTurn, setCurrentTurn] = useState<'white' | 'black'>('white');
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  
  // No cleanup needed since we removed all timeouts for maximum speed
  
  // Reset retry count and error history when the turn changes
  useEffect(() => {
    setRetryCount(0);
    setErrorHistory([]);
  }, [isAITurn, currentPosition]);
  
  // Update current turn when position changes
  useEffect(() => {
    if (game) {
      setCurrentTurn(game.turn() === 'w' ? 'white' : 'black');
    }
  }, [game, currentPosition]);
  
  // Update current player ID when turn or players change
  useEffect(() => {
    const player = currentTurn === 'white' ? whitePlayer : blackPlayer;
    if (player.type === 'ai' && player.providerId && player.modelId) {
      setCurrentPlayerId(`${player.providerId}-${player.modelId}`);
    } else {
      setCurrentPlayerId(null);
    }
  }, [currentTurn, whitePlayer, blackPlayer]);
  
  // Handle AI moves
  useEffect(() => {
    // If it's not an AI match, or game is over, or AI is already thinking, or game not started, don't do anything
    if (!isAIMatch || isGameOver || isAIThinking || !isAITurn || !isAIGameStarted) return;

    const makeAIMove = async () => {
      try {
        // Determine which player's turn it is
        const currentTurn = game.turn() === 'w' ? 'white' : 'black';
        const currentPlayer = currentTurn === 'white' ? whitePlayer : blackPlayer;

        // If it's not an AI player's turn, don't do anything
        if (currentPlayer.type !== 'ai') return;

        // Set AI thinking state
        setIsAIThinking(true);

        console.log(`[AIMatch] AI making move: ${currentPlayer.name} (${currentPlayer.providerId}/${currentPlayer.modelId})`);
        console.log(`[AIMatch] Current position: ${currentPosition}`);

        try {
          if (!currentPlayer.providerId || !currentPlayer.modelId) {
            throw new Error("AI player not properly configured");
          }

          // Get current retry count for temperature calculation
          const currentRetryCount = retryCount;
          const moveStartTime = Date.now();

          // Get the AI move with proper timing
          await getAIMove(
            currentPlayer.providerId,
            currentPlayer.modelId,
            currentPosition,
            (bestMove) => {
              const thinkingTime = Date.now() - moveStartTime;
              console.log(`[AIMatch] AI move received: ${bestMove} (thinking time: ${thinkingTime}ms)`);

              // Make the move - chess.js accepts UCI format strings directly
              const moveResult = makeMove(bestMove);

              // Check if move was successful
              if (!moveResult) {
                console.error(`[AIMatch] Invalid move from AI: ${bestMove}`);

                // Create invalid move error
                const invalidMoveError = new Error(`Invalid move: ${bestMove}`);
                const providerId = currentPlayer.providerId || 'unknown';
                AIChessErrorHandler.handleError(
                  invalidMoveError,
                  providerId,
                  `Invalid move generation: ${bestMove}`
                );

                // Add error to history
                const classifiedError = AIChessErrorHandler.classifyError(invalidMoveError, providerId);
                setErrorHistory(prev => {
                  const newHistory = [...prev, classifiedError];

                  // Create recovery plan with updated history
                  const recoveryPlan = AIChessErrorHandler.createRecoveryPlan(newHistory, MAX_RETRIES);

                  if (recoveryPlan.shouldContinue && currentRetryCount < MAX_RETRIES) {
                    // IMMEDIATE retry for invalid moves - NO DELAY
                    setIsAIThinking(false);
                    setRetryCount(prev => prev + 1);
                  } else {
                    // Max retries reached for invalid moves
                    setIsAIThinking(false);
                    setRetryCount(0);
                    setErrorHistory([]);
                  }

                  return newHistory;
                });
              } else {
                // Reset retry count and error history on successful move
                setRetryCount(0);
                setErrorHistory([]);
                setIsAIThinking(false);
              }
            },
            {
              temperature: 0.2 + (currentRetryCount * 0.1), // Increase randomness with each retry
              timeLimit: 10000 // 10 seconds max per move
            }
          );
        } catch (error) {
          console.error('[AIMatch] Error making AI move:', error);

          // Use enhanced error handling
          const providerId = currentPlayer.providerId || 'unknown';
          AIChessErrorHandler.handleError(
            error,
            providerId,
            `AI move generation for ${currentPlayer.name}`
          );

          // Add error to history
          const classifiedError = AIChessErrorHandler.classifyError(error, providerId);
          setErrorHistory(prev => {
            const newHistory = [...prev, classifiedError];

            // Create recovery plan based on error history
            const recoveryPlan = AIChessErrorHandler.createRecoveryPlan(newHistory, MAX_RETRIES);

            if (!recoveryPlan.shouldContinue) {
              // Too many errors, abort
              setIsAIThinking(false);
              setRetryCount(0);
              setErrorHistory([]);
              return newHistory;
            }

            // Execute recovery plan - IMMEDIATE ACTION
            if (recoveryPlan.nextAction === 'retry') {
              // IMMEDIATE retry - NO DELAY
              setIsAIThinking(false);
              setRetryCount(prev => prev + 1);
            } else if (recoveryPlan.nextAction === 'fallback') {
              // IMMEDIATE fallback - NO DELAY
              setIsAIThinking(false);
              setRetryCount(prev => prev + 1);
            } else {
              // Abort
              setIsAIThinking(false);
              setRetryCount(0);
              setErrorHistory([]);
            }

            return newHistory;
          });
        }
      } catch (error) {
        console.error('[AIMatch] Error in makeAIMove:', error);
        setIsAIThinking(false);
      }
    };

    makeAIMove();
  }, [
    isAIMatch,
    isGameOver,
    isAITurn,
    isAIThinking,
    currentPosition,
    game,
    whitePlayer,
    blackPlayer,
    makeMove,
    getAIMove,
    setIsAIThinking,
    currentPlayerId,
    isAIGameStarted
    // Removed retryCount from dependencies to prevent infinite loop
  ]);
  
  // Don't render anything, this is just a controller component
  return null;
}; 