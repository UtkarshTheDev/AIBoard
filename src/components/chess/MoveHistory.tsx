import React from 'react';
import { useChessStore } from '@/lib/store/chess-store';
import { Button } from '@/components/ui/button';
import { ChevronLeftIcon, ChevronRightIcon, RotateCcwIcon } from 'lucide-react';

export const MoveHistory = () => {
  const { history, historyIndex, goToMove, resetGame } = useChessStore();

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Move History</h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={resetGame}
        >
          <RotateCcwIcon className="w-4 h-4 mr-1" />
          Reset Game
        </Button>
      </div>
      
      <div className="flex justify-between mb-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToMove(historyIndex - 1)}
          disabled={historyIndex <= 0}
        >
          <ChevronLeftIcon className="w-4 h-4 mr-1" />
          Previous
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToMove(historyIndex + 1)}
          disabled={historyIndex >= history.length - 1}
        >
          Next
          <ChevronRightIcon className="w-4 h-4 ml-1" />
        </Button>
      </div>
      
      <div className="border rounded-md p-2 max-h-[200px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-1 px-2 text-left">#</th>
              <th className="py-1 px-2 text-left">Move</th>
              <th className="py-1 px-2 text-right">Eval</th>
            </tr>
          </thead>
          <tbody>
            {history.map((move, index) => (
              <tr 
                key={index}
                className={`cursor-pointer hover:bg-gray-100 ${index === historyIndex ? 'bg-blue-100' : ''}`}
                onClick={() => goToMove(index)}
              >
                <td className="py-1 px-2">{index}</td>
                <td className="py-1 px-2">{move.move}</td>
                <td className="py-1 px-2 text-right">
                  {move.evaluation !== undefined ? move.evaluation.toFixed(2) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}; 