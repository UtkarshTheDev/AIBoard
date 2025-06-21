import { create } from 'zustand';
import { Chess, Move, Square } from 'chess.js';
import { Piece } from 'react-chessboard/dist/chessboard/types';

export type MoveHistory = {
  fen: string;
  move: string;
  evaluation?: number;
};

// Define a type for move input that can be either a string or an object
export type MoveInput = string | {
  from: Square;
  to: Square;
  promotion?: 'n' | 'b' | 'r' | 'q';
};

interface ChessState {
  // Game state
  game: Chess;
  currentPosition: string;
  history: MoveHistory[];
  historyIndex: number;
  isGameOver: boolean;
  gameResult: string;
  
  // Timer state
  timer: number;
  defaultTime: number;
  isTimerRunning: boolean;
  
  // Functions
  makeMove: (move: MoveInput) => boolean;
  goToMove: (index: number) => void;
  resetGame: () => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  decrementTimer: () => void;
  updateEvaluation: (index: number, evaluation: number) => void;
}

export const useChessStore = create<ChessState>((set, get) => ({
  // Initial game state
  game: new Chess(),
  currentPosition: new Chess().fen(),
  history: [{ fen: new Chess().fen(), move: 'Initial position' }],
  historyIndex: 0,
  isGameOver: false,
  gameResult: '',
  
  // Initial timer state
  timer: 60,
  defaultTime: 60,
  isTimerRunning: false,
  
  // Game functions
  makeMove: (move) => {
    const { game, history, historyIndex } = get();
    
    try {
      const result = game.move(move);
      if (!result) return false;
      
      const newPosition = game.fen();
      const newHistory = history.slice(0, historyIndex + 1);
      
      newHistory.push({
        fen: newPosition,
        move: `${result.color === 'w' ? 'White' : 'Black'} ${result.san}`,
      });
      
      const isGameOver = game.isGameOver();
      let gameResult = '';
      
      if (isGameOver) {
        if (game.isCheckmate()) {
          gameResult = `Checkmate! ${game.turn() === 'w' ? 'Black' : 'White'} wins.`;
        } else if (game.isDraw()) {
          if (game.isStalemate()) {
            gameResult = 'Draw by stalemate.';
          } else if (game.isThreefoldRepetition()) {
            gameResult = 'Draw by threefold repetition.';
          } else if (game.isInsufficientMaterial()) {
            gameResult = 'Draw by insufficient material.';
          } else {
            gameResult = 'Draw.';
          }
        }
      }
      
      set({
        currentPosition: newPosition,
        history: newHistory,
        historyIndex: historyIndex + 1,
        isGameOver,
        gameResult,
        timer: get().defaultTime, // Reset timer after move
      });
      
      return true;
    } catch (error) {
      console.error('Invalid move:', error);
      return false;
    }
  },
  
  goToMove: (index) => {
    const { history } = get();
    if (index >= 0 && index < history.length) {
      const gameCopy = new Chess();
      gameCopy.load(history[index].fen);
      
      set({
        game: gameCopy,
        currentPosition: history[index].fen,
        historyIndex: index,
        isGameOver: gameCopy.isGameOver(),
        gameResult: '',
      });
    }
  },
  
  resetGame: () => {
    const newGame = new Chess();
    set({
      game: newGame,
      currentPosition: newGame.fen(),
      history: [{ fen: newGame.fen(), move: 'Initial position' }],
      historyIndex: 0,
      isGameOver: false,
      gameResult: '',
      timer: get().defaultTime,
      isTimerRunning: false,
    });
  },
  
  // Timer functions
  startTimer: () => set({ isTimerRunning: true }),
  pauseTimer: () => set({ isTimerRunning: false }),
  
  resetTimer: () => set({ timer: get().defaultTime }),
  
  decrementTimer: () => {
    const { timer, isTimerRunning, isGameOver } = get();
    if (isTimerRunning && !isGameOver && timer > 0) {
      set({ timer: timer - 1 });
    } else if (timer === 0 && isTimerRunning) {
      // Time's up logic
      set({
        isTimerRunning: false,
        isGameOver: true,
        gameResult: `Time's up! ${get().game.turn() === 'w' ? 'Black' : 'White'} wins.`,
      });
    }
  },
  
  // Stockfish evaluation update
  updateEvaluation: (index, evaluation) => {
    const { history } = get();
    const newHistory = [...history];
    if (newHistory[index]) {
      newHistory[index] = { ...newHistory[index], evaluation };
      set({ history: newHistory });
    }
  },
})); 