import React from 'react';
import { useChessStore } from '@/lib/store/chess-store';

export const GameStatus = () => {
  const { isGameOver, result, game } = useChessStore();
  
  const getTurnIndicator = () => {
    if (isGameOver) return null;
    
    return (
      <div className="flex items-center gap-2">
        <span>Current turn:</span>
        <div 
          className={`w-4 h-4 rounded-full ${game.turn() === 'w' ? 'bg-white border border-gray-300' : 'bg-black'}`}
        />
        <span>{game.turn() === 'w' ? 'White' : 'Black'}</span>
      </div>
    );
  };
  
  const getGameStatus = () => {
    if (!isGameOver) {
      if (game.inCheck()) {
        return <div className="text-red-500 font-bold">Check!</div>;
      }
      return null;
    }
    
    return <div className="text-blue-600 font-bold">{result}</div>;
  };
  
  return (
    <div className="flex flex-col gap-2 p-4 border rounded-md">
      <h3 className="text-lg font-medium">Game Status</h3>
      {getTurnIndicator()}
      {getGameStatus()}
    </div>
  );
}; 