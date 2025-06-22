"use client"
import React, { useEffect, useState, useRef } from 'react';
import { MoveInput, useChessStore } from '@/lib/store/chess-store';
import { useAIChessProviders } from '@/lib/hooks/useAIChessProviders';
import { AIChessErrorHandler, AIChessError } from '@/lib/ai-chess/error-handler';
import { toast } from 'sonner';

// Constants for timing and error handling
const RETRY_DELAY = 3000;       // Delay before retrying after an error (reduced)
const MAX_RETRIES = 3;          // Maximum number of retries (increased)
const RATE_LIMIT_RETRY_DELAY = 10000; // Delay for rate limit errors (reduced)
const INVALID_MOVE_RETRY_DELAY = 1000; // Quick retry for invalid moves

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
    startAIGame,
    isAIGameStarted
  } = useChessStore();
  
  const { getAIMove } = useAIChessProviders();
  const [retryCount, setRetryCount] = useState(0);
  const [errorHistory, setErrorHistory] = useState<AIChessError[]>([]);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track the current player's turn
  const [currentTurn, setCurrentTurn] = useState<'white' | 'black'>('white');
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  
  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);
  
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
        
        try {
          if (!currentPlayer.providerId || !currentPlayer.modelId) {
            throw new Error("AI player not properly configured");
          }
          
          // Get the AI move directly without delay
          await getAIMove(
            currentPlayer.providerId, 
            currentPlayer.modelId, 
            currentPosition,
            (bestMove) => {
              console.log(`[AIMatch] AI move received: ${bestMove}`);
              // Make the move
              const moveResult = makeMove(bestMove as unknown as MoveInput);
              
              // Check if move was successful
              if (!moveResult) {
                console.error(`[AIMatch] Invalid move from AI: ${bestMove}`);

                // Create invalid move error
                const invalidMoveError = new Error(`Invalid move: ${bestMove}`);
                const providerId = currentPlayer.providerId || 'unknown';
                const errorHandling = AIChessErrorHandler.handleError(
                  invalidMoveError,
                  providerId,
                  `Invalid move generation: ${bestMove}`
                );

                // Add error to history
                const classifiedError = AIChessErrorHandler.classifyError(invalidMoveError, providerId);
                setErrorHistory(prev => [...prev, classifiedError]);

                // Create recovery plan
                const recoveryPlan = AIChessErrorHandler.createRecoveryPlan([...errorHistory, classifiedError], MAX_RETRIES);

                if (recoveryPlan.shouldContinue && retryCount < MAX_RETRIES) {
                  // Quick retry for invalid moves
                  if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
                  retryTimeoutRef.current = setTimeout(() => {
                    setIsAIThinking(false);
                    setRetryCount(prev => prev + 1);
                  }, INVALID_MOVE_RETRY_DELAY);
                } else {
                  // Max retries reached for invalid moves
                  setIsAIThinking(false);
                  setRetryCount(0);
                  setErrorHistory([]);
                }
              } else {
                // Reset retry count and error history on successful move
                setRetryCount(0);
                setErrorHistory([]);
                setIsAIThinking(false);
              }
            },
            { 
              temperature: 0.2 + (retryCount * 0.1), // Increase randomness with each retry
              timeLimit: 10000 // 10 seconds max per move
            }
          );
        } catch (error) {
          console.error('[AIMatch] Error making AI move:', error);

          // Use enhanced error handling
          const providerId = currentPlayer.providerId || 'unknown';
          const errorHandling = AIChessErrorHandler.handleError(
            error,
            providerId,
            `AI move generation for ${currentPlayer.name}`
          );

          // Add error to history
          const classifiedError = AIChessErrorHandler.classifyError(error, providerId);
          setErrorHistory(prev => [...prev, classifiedError]);

          // Create recovery plan based on error history
          const recoveryPlan = AIChessErrorHandler.createRecoveryPlan([...errorHistory, classifiedError], MAX_RETRIES);

          if (!recoveryPlan.shouldContinue) {
            // Too many errors, abort
            setIsAIThinking(false);
            setRetryCount(0);
            setErrorHistory([]);
            return;
          }

          // Execute recovery plan
          if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);

          if (recoveryPlan.nextAction === 'retry') {
            retryTimeoutRef.current = setTimeout(() => {
              setIsAIThinking(false);
              setRetryCount(prev => prev + 1);
            }, recoveryPlan.delay);
          } else if (recoveryPlan.nextAction === 'fallback') {
            // The fallback will be handled automatically by the FallbackManager
            // Just retry immediately to trigger the fallback
            retryTimeoutRef.current = setTimeout(() => {
              setIsAIThinking(false);
              setRetryCount(prev => prev + 1);
            }, Math.min(recoveryPlan.delay, 2000)); // Max 2 second delay for fallback
          } else {
            // Abort
            setIsAIThinking(false);
            setRetryCount(0);
            setErrorHistory([]);
          }
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
    retryCount,
    currentPlayerId,
    isAIGameStarted // Add dependency on isAIGameStarted
  ]);
  
  // Don't render anything, this is just a controller component
  return null;
}; 