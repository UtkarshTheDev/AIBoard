"use client"
import { create } from 'zustand';
import { Chess, Square } from 'chess.js';
import { toast } from 'sonner';

export type PlayerType = 'human' | 'ai';

export interface Player {
  type: PlayerType;
  name: string;
  providerId?: string;
  modelId?: string;
}

// For backward compatibility
export type PlayerSettings = Player;
export type MoveInput = {
  from: Square;
  to: Square;
  promotion?: string;
};

interface ChessState {
  // Game state
  game: Chess;
  currentPosition: string;
  history: string[];
  historyIndex: number;
  isGameOver: boolean;
  result: string | null;
  
  // Players
  whitePlayer: Player;
  blackPlayer: Player;
  
  // AI match settings
  isAIMatch: boolean;
  isAITurn: boolean;
  isAIThinking: boolean;
  isAIGameStarted: boolean;
  
  // Timer state
  timer: number;
  defaultTime: number;
  isTimerRunning: boolean;
  
  // Evaluation data
  evaluations: (number | null)[];
  
  // Actions
  newGame: () => void;
  makeMove: (move: MoveInput) => boolean;
  goToMove: (index: number) => void;
  undoMove: () => void;
  redoMove: () => void;
  updateEvaluation: (index: number, evaluation: number) => void;
  setWhitePlayer: (player: Player) => void;
  setBlackPlayer: (player: Player) => void;
  setIsAIMatch: (isAIMatch: boolean) => void;
  setIsAIThinking: (isThinking: boolean) => void;
  startAIGame: () => void;
  stopAIGame: () => void;
  
  // Timer functions
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  decrementTimer: () => void;
  
  // Legacy functions for backward compatibility
  resetGame: () => void;
  setPlayerSettings: (color: 'white' | 'black', settings: Player) => void;
  startAIMatch: () => void;
  stopAIMatch: () => void;
}

export const useChessStore = create<ChessState>((set, get) => ({
  // Initialize game state
  game: new Chess(),
  currentPosition: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  history: ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'],
  historyIndex: 0,
  isGameOver: false,
  result: null,
  
  // Initialize players
  whitePlayer: { type: 'human', name: 'Human' },
  blackPlayer: { type: 'human', name: 'Human' },
  
  // AI match settings
  isAIMatch: false,
  isAITurn: false,
  isAIThinking: false,
  isAIGameStarted: false,
  
  // Timer state
  timer: 60,
  defaultTime: 60,
  isTimerRunning: false,
  
  // Initialize evaluations
  evaluations: [null],
  
  // Start a new game
  newGame: () => {
    const game = new Chess();
    const fen = game.fen();
    
    set({
      game,
      currentPosition: fen,
      history: [fen],
      historyIndex: 0,
      isGameOver: false,
      result: null,
      evaluations: [null],
      isAIThinking: false,
      timer: get().defaultTime,
      isTimerRunning: false
    });
    
    // Check if it's an AI's turn at the start of the game
    const state = get();
    if (state.isAIMatch && state.whitePlayer.type === 'ai') {
      set({ isAITurn: true });
    } else {
      set({ isAITurn: false });
    }
  },
  
  // Make a move
  makeMove: (move) => {
    const { game, history, historyIndex, whitePlayer, blackPlayer, isAIMatch } = get();
    
    try {
      // Try to make the move
      const moveResult = game.move(move);
      
      // Get the new position
      const newPosition = game.fen();
      
      // Check if the game is over
      const isGameOver = game.isGameOver();
      
      // Determine the result if the game is over
      let result = null;
      if (isGameOver) {
        if (game.isCheckmate()) {
          result = game.turn() === 'w' ? 'Black wins by checkmate' : 'White wins by checkmate';
        } else if (game.isDraw()) {
          if (game.isStalemate()) {
            result = 'Draw by stalemate';
          } else if (game.isThreefoldRepetition()) {
            result = 'Draw by threefold repetition';
          } else if (game.isInsufficientMaterial()) {
            result = 'Draw by insufficient material';
          } else {
            result = 'Draw';
          }
        }
      }
      
      // Update history if we're at the latest move
      let newHistory = [...history];
      let newEvaluations = [...get().evaluations];
      
      if (historyIndex === history.length - 1) {
        // We're at the latest move, so add the new position to history
        newHistory.push(newPosition);
        newEvaluations.push(null);
      } else {
        // We're in the middle of history, so truncate and add the new position
        newHistory = newHistory.slice(0, historyIndex + 1);
        newHistory.push(newPosition);
        
        newEvaluations = newEvaluations.slice(0, historyIndex + 1);
        newEvaluations.push(null);
      }
      
      // Determine if it's an AI's turn after this move
      const currentTurn = game.turn() === 'w' ? 'white' : 'black';
      const currentPlayer = currentTurn === 'white' ? whitePlayer : blackPlayer;
      const isAITurn = isAIMatch && currentPlayer.type === 'ai' && !isGameOver;
      
      // Update the state
      set({
        game,
        currentPosition: newPosition,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        isGameOver,
        result,
        evaluations: newEvaluations,
        isAITurn,
        timer: get().defaultTime // Reset timer after move
      });
      
      // Show toast notification for checkmate or draw
      if (isGameOver && typeof window !== 'undefined') {
        toast.info(result || 'Game over');
      }
      
      return true;
    } catch (error) {
      console.error('Invalid move:', move, error);
      return false;
    }
  },
  
  // Go to a specific move in history
  goToMove: (index) => {
    const { history } = get();
    
    if (index >= 0 && index < history.length) {
      // Create a new game instance and set it to the position at the given index
      const game = new Chess();
      game.load(history[index]);
      
      // Update the state
      set({
        game,
        currentPosition: history[index],
        historyIndex: index,
        isAITurn: false, // Disable AI when navigating through history
        isAIThinking: false // Reset AI thinking state
      });
    }
  },
  
  // Undo a move
  undoMove: () => {
    const { historyIndex } = get();
    
    if (historyIndex > 0) {
      get().goToMove(historyIndex - 1);
    }
  },
  
  // Redo a move
  redoMove: () => {
    const { historyIndex, history } = get();
    
    if (historyIndex < history.length - 1) {
      get().goToMove(historyIndex + 1);
    }
  },
  
  // Update evaluation for a move
  updateEvaluation: (index, evaluation) => {
    const { evaluations } = get();
    
    if (index >= 0 && index < evaluations.length) {
      const newEvaluations = [...evaluations];
      newEvaluations[index] = evaluation;
      
      set({ evaluations: newEvaluations });
    }
  },
  
  // Set white player
  setWhitePlayer: (player) => {
    set({ whitePlayer: player });
  },
  
  // Set black player
  setBlackPlayer: (player) => {
    set({ blackPlayer: player });
  },
  
  // Set AI match
  setIsAIMatch: (isAIMatch) => {
    const { game, whitePlayer, blackPlayer } = get();
    
    // Determine if it's an AI's turn
    const currentTurn = game.turn() === 'w' ? 'white' : 'black';
    const currentPlayer = currentTurn === 'white' ? whitePlayer : blackPlayer;
    const isAITurn = isAIMatch && currentPlayer.type === 'ai' && !game.isGameOver();
    
    set({ 
      isAIMatch,
      isAITurn,
      isAIThinking: false // Reset AI thinking state
    });
  },
  
  // Set AI thinking state
  setIsAIThinking: (isThinking) => {
    set({ isAIThinking: isThinking });
  },
  
  // Timer functions
  startTimer: () => {
    set({ isTimerRunning: true });
  },
  
  pauseTimer: () => {
    set({ isTimerRunning: false });
  },
  
  resetTimer: () => {
    set({ timer: get().defaultTime, isTimerRunning: false });
  },
  
  decrementTimer: () => {
    const { timer, isTimerRunning } = get();
    
    if (isTimerRunning && timer > 0) {
      set({ timer: timer - 1 });
    } else if (isTimerRunning && timer === 0) {
      set({
        isTimerRunning: false,
        isGameOver: true,
        result: `Time's up! ${get().game.turn() === 'w' ? 'Black' : 'White'} wins.`,
      });
    }
  },
  
  // Legacy functions for backward compatibility
  resetGame: () => {
    get().newGame();
  },
  
  setPlayerSettings: (color, settings) => {
    if (color === 'white') {
      get().setWhitePlayer(settings);
    } else {
      get().setBlackPlayer(settings);
    }
  },
  
  startAIMatch: () => {
    get().setIsAIMatch(true);
  },
  
  stopAIMatch: () => {
    get().setIsAIMatch(false);
  },
  
  startAIGame: () => {
    set({ isAIGameStarted: true });
  },
  
  stopAIGame: () => {
    set({ isAIGameStarted: false });
  }
})); 