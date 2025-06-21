"use client"
import React, { useEffect, useState, useRef } from 'react';
import { MoveInput, useChessStore } from '@/lib/store/chess-store';
import { useAIChessProviders } from '@/lib/hooks/useAIChessProviders';
import { toast } from 'sonner';

// Constants for timing
const MIN_THINKING_TIME = 800;  // Minimum thinking time in ms
const MAX_THINKING_TIME = 2500; // Maximum thinking time in ms
const RETRY_DELAY = 5000;       // Delay before retrying after an error
const MAX_RETRIES = 2;          // Maximum number of retries

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
    game
  } = useChessStore();
  
  const { getAIMove } = useAIChessProviders();
  const [retryCount, setRetryCount] = useState(0);
  const moveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (moveTimeoutRef.current) clearTimeout(moveTimeoutRef.current);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);
  
  // Reset retry count when the turn changes
  useEffect(() => {
    setRetryCount(0);
  }, [isAITurn, currentPosition]);
  
  // Handle AI moves
  useEffect(() => {
    // If it's not an AI match, or game is over, or AI is already thinking, don't do anything
    if (!isAIMatch || isGameOver || isAIThinking || !isAITurn) return;
    
    const makeAIMove = async () => {
      try {
        // Determine which player's turn it is
        const currentTurn = game.turn() === 'w' ? 'white' : 'black';
        const currentPlayer = currentTurn === 'white' ? whitePlayer : blackPlayer;
        
        // If it's not an AI player's turn, don't do anything
        if (currentPlayer.type !== 'ai') return;
        
        // Set AI thinking state
        setIsAIThinking(true);
        
        // Calculate a random thinking time to make it feel more natural
        const thinkingTime = Math.floor(
          Math.random() * (MAX_THINKING_TIME - MIN_THINKING_TIME) + MIN_THINKING_TIME
        );
        
        // Clear any existing timeout
        if (moveTimeoutRef.current) clearTimeout(moveTimeoutRef.current);
        
        // Set a timeout to make the AI "think"
        moveTimeoutRef.current = setTimeout(async () => {
          try {
            // Get the AI move
            await getAIMove(
              currentPlayer.providerId!, 
              currentPlayer.modelId!, 
              currentPosition,
              (bestMove) => {
                // Make the move
                const moveResult = makeMove(bestMove as unknown as MoveInput);
                
                // Check if move was successful
                if (!moveResult) {
                  console.error(`Invalid move from AI: ${bestMove}`);
                  if (typeof window !== 'undefined') {
                    toast.error(`AI made an invalid move: ${bestMove}`, {
                      description: "The AI will try a different move."
                    });
                  }
                  
                  // Reset thinking state to allow another attempt
                  setIsAIThinking(false);
                  
                  // Increment retry count
                  setRetryCount(prev => prev + 1);
                } else {
                  // Reset retry count on successful move
                  setRetryCount(0);
                  setIsAIThinking(false);
                }
              },
              { 
                temperature: 0.2 + (retryCount * 0.1), // Increase randomness with each retry
                timeLimit: 10000 // 10 seconds max per move
              }
            );
          } catch (error) {
            console.error('Error making AI move:', error);
            
            // Handle rate limit errors differently
            if (error instanceof Error && error.message.includes('Rate limit')) {
              toast.error("Rate limit reached", {
                description: "Waiting 30 seconds before trying again."
              });
              
              // Set a longer timeout for rate limit errors
              if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
              retryTimeoutRef.current = setTimeout(() => {
                setIsAIThinking(false);
              }, 30000);
            } else {
              // For other errors, retry after a delay if under max retries
              if (retryCount < MAX_RETRIES) {
                toast.error(`AI error: ${error instanceof Error ? error.message : String(error)}`, {
                  description: `Retrying in ${RETRY_DELAY/1000} seconds...`
                });
                
                // Set timeout to retry
                if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = setTimeout(() => {
                  setIsAIThinking(false);
                  setRetryCount(prev => prev + 1);
                }, RETRY_DELAY);
              } else {
                // Max retries reached
                toast.error("Failed to make AI move after multiple attempts", {
                  description: "Please try again later or choose a different model."
                });
                setIsAIThinking(false);
                setRetryCount(0);
              }
            }
          }
        }, thinkingTime);
        
      } catch (error) {
        console.error('Error in makeAIMove:', error);
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
    retryCount
  ]);
  
  // Don't render anything, this is just a controller component
  return null;
}; 