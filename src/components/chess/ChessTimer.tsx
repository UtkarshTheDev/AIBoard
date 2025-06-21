"use client"
import React, { useEffect } from 'react';
import { useChessStore } from '@/lib/store/chess-store';
import { Button } from '@/components/ui/button';
import { PlayIcon, PauseIcon, TimerResetIcon } from 'lucide-react';

export const ChessTimer = () => {
  const { 
    timer, 
    isTimerRunning, 
    startTimer, 
    pauseTimer, 
    resetTimer, 
    decrementTimer,
    isGameOver
  } = useChessStore();

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isTimerRunning && !isGameOver) {
      interval = setInterval(() => {
        decrementTimer();
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, isGameOver, decrementTimer]);

  // Format timer as MM:SS
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-2xl font-bold">{formatTime(timer)}</div>
      <div className="flex gap-2">
        {!isTimerRunning ? (
          <Button 
            size="sm" 
            onClick={startTimer}
            disabled={isGameOver}
          >
            <PlayIcon className="w-4 h-4 mr-1" />
            Start
          </Button>
        ) : (
          <Button 
            size="sm" 
            onClick={pauseTimer}
            variant="outline"
          >
            <PauseIcon className="w-4 h-4 mr-1" />
            Pause
          </Button>
        )}
        <Button 
          size="sm" 
          onClick={resetTimer}
          variant="outline"
        >
          <TimerResetIcon className="w-4 h-4 mr-1" />
          Reset
        </Button>
      </div>
    </div>
  );
}; 