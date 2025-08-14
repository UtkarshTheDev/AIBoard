import React from 'react';
import { Chess } from 'chess.js';
import { useChessStore } from '@/lib/store/chess-store';
import { Button } from '@/components/ui/button';
import { ChevronLeftIcon, ChevronRightIcon, RotateCcwIcon } from 'lucide-react';

export const MoveHistory = () => {
  const { history, historyIndex, goToMove, resetGame, evaluations } = useChessStore();

  return (
    <div className="flex flex-col gap-4 w-full font-sans">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-foreground">Move History</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={resetGame}
          className="bg-card text-card-foreground border-border hover:bg-accent hover:text-accent-foreground"
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
          className="bg-card text-card-foreground border-border hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeftIcon className="w-4 h-4 mr-1" />
          Previous
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => goToMove(historyIndex + 1)}
          disabled={historyIndex >= history.length - 1}
          className="bg-card text-card-foreground border-border hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRightIcon className="w-4 h-4 ml-1" />
        </Button>
      </div>

      <div className="border border-border rounded-md p-2 max-h-[200px] overflow-y-auto bg-card">
        <table className="w-full text-sm text-card-foreground">
          <thead>
            <tr className="border-b border-border">
              <th className="py-1 px-2 text-left text-foreground">#</th>
              <th className="py-1 px-2 text-left text-foreground">Move</th>
              <th className="py-1 px-2 text-right text-foreground">Eval</th>
            </tr>
          </thead>
          <tbody>
            {history.map((fen, index) => {
              // Get move notation
              let moveNotation = 'Start';
              if (index > 0) {
                // Create a temporary game to get the move history
                const tempGame = new Chess();
                tempGame.load(history[0]); // Load starting position

                // Get all moves that lead to the current position
                const moveHistory = [];
                for (let i = 1; i <= index; i++) {
                  const moves = tempGame.moves({ verbose: true });
                  // Find the move that results in history[i]
                  const targetMove = moves.find(move => {
                    const testGame = new Chess(tempGame.fen());
                    testGame.move(move);
                    return testGame.fen() === history[i];
                  });

                  if (targetMove) {
                    moveHistory.push(targetMove.san);
                    tempGame.move(targetMove);
                  } else {
                    moveHistory.push(`Move ${i}`);
                    break;
                  }
                }

                moveNotation = moveHistory[index - 1] || `Move ${index}`;
              }

              const evaluation = evaluations[index];

              return (
                <tr
                  key={index}
                  className={`cursor-pointer hover:bg-accent/50 hover:text-accent-foreground transition-colors ${
                    index === historyIndex ? 'bg-primary/20 text-primary-foreground' : 'text-card-foreground'
                  }`}
                  onClick={() => goToMove(index)}
                >
                  <td className="py-1 px-2 font-mono">{index}</td>
                  <td className="py-1 px-2 font-mono">{moveNotation}</td>
                  <td className="py-1 px-2 text-right font-mono">
                    {evaluation !== null && evaluation !== undefined ? evaluation.toFixed(2) : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};