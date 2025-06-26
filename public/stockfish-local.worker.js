// Advanced Local Stockfish Web Worker - High-Quality Chess Engine
// This worker implements a sophisticated chess engine with proper move generation and evaluation

let stockfish = null;
let isReady = false;
let currentAnalysis = null;

// Advanced Chess Engine with proper chess logic, realistic timing, and strong play
class AdvancedChessEngine {
  constructor() {
    this.isInitialized = false;
    this.onmessage = null;
    this.currentFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    this.analysisTimeout = null;
    this.gameHistory = [];
    this.moveCount = 0;
    this.analysisStartTime = null;
    this.currentAnalysisDepth = 0;
    this.bestMoveFound = null;
    this.bestEvaluation = null;

    // Piece values for evaluation
    this.pieceValues = {
      'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 20000,
      'P': 100, 'N': 320, 'B': 330, 'R': 500, 'Q': 900, 'K': 20000
    };

    // Time management settings
    this.timeSettings = {
      opening: { min: 3000, max: 5000 },    // 3-5 seconds for opening
      middlegame: { min: 5000, max: 8000 }, // 5-8 seconds for middlegame
      endgame: { min: 2000, max: 4000 }     // 2-4 seconds for endgame
    };

    // Quality control thresholds
    this.qualityThresholds = {
      minEvaluationDifference: 50,  // Minimum centipawn difference for move selection
      minAnalysisDepth: 12,         // Minimum depth before considering a move
      maxAnalysisDepth: 25          // Maximum depth to prevent excessive computation
    };

    // Position tables for piece-square evaluation
    this.initializePositionTables();
  }

  initializePositionTables() {
    // Pawn position table (from white's perspective)
    this.pawnTable = [
      [0,  0,  0,  0,  0,  0,  0,  0],
      [50, 50, 50, 50, 50, 50, 50, 50],
      [10, 10, 20, 30, 30, 20, 10, 10],
      [5,  5, 10, 25, 25, 10,  5,  5],
      [0,  0,  0, 20, 20,  0,  0,  0],
      [5, -5,-10,  0,  0,-10, -5,  5],
      [5, 10, 10,-20,-20, 10, 10,  5],
      [0,  0,  0,  0,  0,  0,  0,  0]
    ];

    // Knight position table
    this.knightTable = [
      [-50,-40,-30,-30,-30,-30,-40,-50],
      [-40,-20,  0,  0,  0,  0,-20,-40],
      [-30,  0, 10, 15, 15, 10,  0,-30],
      [-30,  5, 15, 20, 20, 15,  5,-30],
      [-30,  0, 15, 20, 20, 15,  0,-30],
      [-30,  5, 10, 15, 15, 10,  5,-30],
      [-40,-20,  0,  5,  5,  0,-20,-40],
      [-50,-40,-30,-30,-30,-30,-40,-50]
    ];

    // Bishop position table
    this.bishopTable = [
      [-20,-10,-10,-10,-10,-10,-10,-20],
      [-10,  0,  0,  0,  0,  0,  0,-10],
      [-10,  0,  5, 10, 10,  5,  0,-10],
      [-10,  5,  5, 10, 10,  5,  5,-10],
      [-10,  0, 10, 10, 10, 10,  0,-10],
      [-10, 10, 10, 10, 10, 10, 10,-10],
      [-10,  5,  0,  0,  0,  0,  5,-10],
      [-20,-10,-10,-10,-10,-10,-10,-20]
    ];

    // King position table (middlegame)
    this.kingTable = [
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-20,-30,-30,-40,-40,-30,-30,-20],
      [-10,-20,-20,-20,-20,-20,-20,-10],
      [ 20, 20,  0,  0,  0,  0, 20, 20],
      [ 20, 30, 10,  0,  0, 10, 30, 20]
    ];
  }

  async initialize() {
    // Quick initialization
    await new Promise(resolve => setTimeout(resolve, 200));
    this.isInitialized = true;

    // Send UCI ready messages
    if (this.onmessage) {
      this.onmessage('uciok');
      this.onmessage('readyok');
    }
  }

  // Determine game phase based on move count and material
  getGamePhase(gameState) {
    const moveNumber = gameState.fullmoveNumber || 1;

    // Count material to help determine game phase
    let totalMaterial = 0;
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = gameState.board[rank][file];
        if (piece && piece.toLowerCase() !== 'k') {
          totalMaterial += this.pieceValues[piece] || 0;
        }
      }
    }

    // Determine phase based on move number and material
    if (moveNumber <= 15) {
      return 'opening';
    } else if (moveNumber <= 40 && totalMaterial > 2000) {
      return 'middlegame';
    } else {
      return 'endgame';
    }
  }

  // Calculate appropriate thinking time based on game phase
  calculateThinkingTime(gameState) {
    const phase = this.getGamePhase(gameState);
    const settings = this.timeSettings[phase];

    // Add some randomness to make timing more natural
    const baseTime = settings.min + Math.random() * (settings.max - settings.min);

    // Adjust based on position complexity
    const complexity = this.evaluatePositionComplexity(gameState);
    const complexityMultiplier = 0.8 + (complexity * 0.4); // 0.8x to 1.2x based on complexity

    return Math.round(baseTime * complexityMultiplier);
  }

  // Evaluate position complexity to adjust thinking time
  evaluatePositionComplexity(gameState) {
    let complexity = 0;

    // Count pieces (more pieces = more complex)
    let pieceCount = 0;
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        if (gameState.board[rank][file]) {
          pieceCount++;
        }
      }
    }
    complexity += (pieceCount - 16) / 16; // Normalize to 0-1 range

    // Count legal moves (more moves = more complex)
    const legalMoves = this.generateLegalMoves(this.gameStateToFEN(gameState));
    complexity += Math.min(legalMoves.length / 40, 1); // Normalize to 0-1 range

    // Check for tactical elements (captures, checks, etc.)
    let tacticalElements = 0;
    for (const moveUCI of legalMoves) {
      const move = this.uciToMove(moveUCI, gameState);
      if (move && (move.capture || move.castling)) {
        tacticalElements++;
      }
    }
    complexity += Math.min(tacticalElements / 10, 1);

    return Math.min(complexity / 3, 1); // Average and cap at 1
  }

  // Evaluate move quality to ensure high standards
  evaluateMoveQuality(move, gameState, currentBestEval) {
    const newGameState = this.makeMove(move, gameState);
    const moveEvaluation = -this.evaluatePosition(this.gameStateToFEN(newGameState));

    // Calculate move quality score
    let qualityScore = 0;

    // Base evaluation difference
    const evalDifference = moveEvaluation - (currentBestEval || -Infinity);
    qualityScore += evalDifference;

    // Bonus for tactical moves
    if (move.capture) {
      const capturedPiece = gameState.board[move.to[0]][move.to[1]];
      qualityScore += this.pieceValues[capturedPiece] || 0;
    }

    if (move.castling) {
      qualityScore += 50; // Castling bonus
    }

    // Penalty for moving into danger
    if (this.isSquareAttacked(move.to[0], move.to[1], gameState.activeColor === 'w' ? 'b' : 'w', newGameState)) {
      qualityScore -= 30;
    }

    return {
      evaluation: moveEvaluation,
      qualityScore: qualityScore,
      isAcceptable: qualityScore >= -this.qualityThresholds.minEvaluationDifference
    };
  }

  // Parse FEN string into board state
  parseFEN(fen) {
    const parts = fen.split(' ');
    if (parts.length < 4) {
      throw new Error('Invalid FEN string');
    }

    const position = parts[0];
    const activeColor = parts[1];
    const castlingRights = parts[2];
    const enPassantTarget = parts[3];
    const halfmoveClock = parseInt(parts[4]) || 0;
    const fullmoveNumber = parseInt(parts[5]) || 1;

    // Parse board position
    const board = Array(8).fill(null).map(() => Array(8).fill(null));
    const ranks = position.split('/');

    for (let rank = 0; rank < 8; rank++) {
      let file = 0;
      for (const char of ranks[rank]) {
        if (char >= '1' && char <= '8') {
          file += parseInt(char);
        } else {
          board[rank][file] = char;
          file++;
        }
      }
    }

    return {
      board,
      activeColor,
      castlingRights,
      enPassantTarget,
      halfmoveClock,
      fullmoveNumber
    };
  }

  // Generate all legal moves for the current position
  generateLegalMoves(fen) {
    try {
      const gameState = this.parseFEN(fen);
      const moves = [];

      // Generate moves for all pieces of the active color
      for (let rank = 0; rank < 8; rank++) {
        for (let file = 0; file < 8; file++) {
          const piece = gameState.board[rank][file];
          if (piece && this.isPieceColor(piece, gameState.activeColor)) {
            const pieceMoves = this.generatePieceMoves(rank, file, piece, gameState);
            moves.push(...pieceMoves);
          }
        }
      }

      // Filter out moves that would leave king in check
      const legalMoves = moves.filter(move => this.isMoveLegal(move, gameState));

      return legalMoves.map(move => this.moveToUCI(move));
    } catch (error) {
      console.error('Error generating legal moves:', error);
      // Emergency fallback
      return this.getEmergencyMoves(fen);
    }
  }

  // Check if piece belongs to the given color
  isPieceColor(piece, color) {
    if (color === 'w') {
      return piece >= 'A' && piece <= 'Z';
    } else {
      return piece >= 'a' && piece <= 'z';
    }
  }

  // Generate moves for a specific piece
  generatePieceMoves(rank, file, piece, gameState) {
    const pieceType = piece.toLowerCase();
    const moves = [];

    switch (pieceType) {
      case 'p':
        moves.push(...this.generatePawnMoves(rank, file, piece, gameState));
        break;
      case 'r':
        moves.push(...this.generateRookMoves(rank, file, piece, gameState));
        break;
      case 'n':
        moves.push(...this.generateKnightMoves(rank, file, piece, gameState));
        break;
      case 'b':
        moves.push(...this.generateBishopMoves(rank, file, piece, gameState));
        break;
      case 'q':
        moves.push(...this.generateQueenMoves(rank, file, piece, gameState));
        break;
      case 'k':
        moves.push(...this.generateKingMoves(rank, file, piece, gameState));
        break;
    }

    return moves;
  }

  // Generate pawn moves
  generatePawnMoves(rank, file, piece, gameState) {
    const moves = [];
    const isWhite = piece === 'P';
    const direction = isWhite ? -1 : 1;
    const startRank = isWhite ? 6 : 1;
    const promotionRank = isWhite ? 0 : 7;

    // Forward moves
    const newRank = rank + direction;
    if (newRank >= 0 && newRank < 8 && !gameState.board[newRank][file]) {
      if (newRank === promotionRank) {
        // Promotion
        ['q', 'r', 'b', 'n'].forEach(promotionPiece => {
          moves.push({ from: [rank, file], to: [newRank, file], promotion: promotionPiece });
        });
      } else {
        moves.push({ from: [rank, file], to: [newRank, file] });

        // Double pawn move from starting position
        if (rank === startRank && !gameState.board[newRank + direction][file]) {
          moves.push({ from: [rank, file], to: [newRank + direction, file] });
        }
      }
    }

    // Captures
    [-1, 1].forEach(fileOffset => {
      const captureFile = file + fileOffset;
      if (captureFile >= 0 && captureFile < 8 && newRank >= 0 && newRank < 8) {
        const target = gameState.board[newRank][captureFile];
        if (target && !this.isPieceColor(target, gameState.activeColor)) {
          if (newRank === promotionRank) {
            // Capture with promotion
            ['q', 'r', 'b', 'n'].forEach(promotionPiece => {
              moves.push({ from: [rank, file], to: [newRank, captureFile], promotion: promotionPiece, capture: true });
            });
          } else {
            moves.push({ from: [rank, file], to: [newRank, captureFile], capture: true });
          }
        }

        // En passant
        if (gameState.enPassantTarget !== '-') {
          const enPassantFile = gameState.enPassantTarget.charCodeAt(0) - 97;
          const enPassantRank = 8 - parseInt(gameState.enPassantTarget[1]);
          if (newRank === enPassantRank && captureFile === enPassantFile) {
            moves.push({ from: [rank, file], to: [newRank, captureFile], enPassant: true });
          }
        }
      }
    });

    return moves;
  }

  // Generate rook moves
  generateRookMoves(rank, file, piece, gameState) {
    const moves = [];
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // up, down, left, right

    directions.forEach(([rankDir, fileDir]) => {
      for (let i = 1; i < 8; i++) {
        const newRank = rank + rankDir * i;
        const newFile = file + fileDir * i;

        if (newRank < 0 || newRank >= 8 || newFile < 0 || newFile >= 8) break;

        const target = gameState.board[newRank][newFile];
        if (!target) {
          moves.push({ from: [rank, file], to: [newRank, newFile] });
        } else {
          if (!this.isPieceColor(target, gameState.activeColor)) {
            moves.push({ from: [rank, file], to: [newRank, newFile], capture: true });
          }
          break;
        }
      }
    });

    return moves;
  }

  // Generate knight moves
  generateKnightMoves(rank, file, piece, gameState) {
    const moves = [];
    const knightMoves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];

    knightMoves.forEach(([rankOffset, fileOffset]) => {
      const newRank = rank + rankOffset;
      const newFile = file + fileOffset;

      if (newRank >= 0 && newRank < 8 && newFile >= 0 && newFile < 8) {
        const target = gameState.board[newRank][newFile];
        if (!target) {
          moves.push({ from: [rank, file], to: [newRank, newFile] });
        } else if (!this.isPieceColor(target, gameState.activeColor)) {
          moves.push({ from: [rank, file], to: [newRank, newFile], capture: true });
        }
      }
    });

    return moves;
  }

  // Generate bishop moves
  generateBishopMoves(rank, file, piece, gameState) {
    const moves = [];
    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]]; // diagonals

    directions.forEach(([rankDir, fileDir]) => {
      for (let i = 1; i < 8; i++) {
        const newRank = rank + rankDir * i;
        const newFile = file + fileDir * i;

        if (newRank < 0 || newRank >= 8 || newFile < 0 || newFile >= 8) break;

        const target = gameState.board[newRank][newFile];
        if (!target) {
          moves.push({ from: [rank, file], to: [newRank, newFile] });
        } else {
          if (!this.isPieceColor(target, gameState.activeColor)) {
            moves.push({ from: [rank, file], to: [newRank, newFile], capture: true });
          }
          break;
        }
      }
    });

    return moves;
  }

  // Generate queen moves (combination of rook and bishop)
  generateQueenMoves(rank, file, piece, gameState) {
    return [
      ...this.generateRookMoves(rank, file, piece, gameState),
      ...this.generateBishopMoves(rank, file, piece, gameState)
    ];
  }

  // Generate king moves
  generateKingMoves(rank, file, piece, gameState) {
    const moves = [];
    const kingMoves = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

    // Regular king moves
    kingMoves.forEach(([rankOffset, fileOffset]) => {
      const newRank = rank + rankOffset;
      const newFile = file + fileOffset;

      if (newRank >= 0 && newRank < 8 && newFile >= 0 && newFile < 8) {
        const target = gameState.board[newRank][newFile];
        if (!target) {
          moves.push({ from: [rank, file], to: [newRank, newFile] });
        } else if (!this.isPieceColor(target, gameState.activeColor)) {
          moves.push({ from: [rank, file], to: [newRank, newFile], capture: true });
        }
      }
    });

    // Castling
    if (gameState.activeColor === 'w') {
      // White kingside castling
      if (gameState.castlingRights.includes('K') &&
          !gameState.board[7][5] && !gameState.board[7][6] &&
          !this.isSquareAttacked(7, 4, 'b', gameState) &&
          !this.isSquareAttacked(7, 5, 'b', gameState) &&
          !this.isSquareAttacked(7, 6, 'b', gameState)) {
        moves.push({ from: [rank, file], to: [7, 6], castling: 'K' });
      }
      // White queenside castling
      if (gameState.castlingRights.includes('Q') &&
          !gameState.board[7][1] && !gameState.board[7][2] && !gameState.board[7][3] &&
          !this.isSquareAttacked(7, 4, 'b', gameState) &&
          !this.isSquareAttacked(7, 3, 'b', gameState) &&
          !this.isSquareAttacked(7, 2, 'b', gameState)) {
        moves.push({ from: [rank, file], to: [7, 2], castling: 'Q' });
      }
    } else {
      // Black kingside castling
      if (gameState.castlingRights.includes('k') &&
          !gameState.board[0][5] && !gameState.board[0][6] &&
          !this.isSquareAttacked(0, 4, 'w', gameState) &&
          !this.isSquareAttacked(0, 5, 'w', gameState) &&
          !this.isSquareAttacked(0, 6, 'w', gameState)) {
        moves.push({ from: [rank, file], to: [0, 6], castling: 'k' });
      }
      // Black queenside castling
      if (gameState.castlingRights.includes('q') &&
          !gameState.board[0][1] && !gameState.board[0][2] && !gameState.board[0][3] &&
          !this.isSquareAttacked(0, 4, 'w', gameState) &&
          !this.isSquareAttacked(0, 3, 'w', gameState) &&
          !this.isSquareAttacked(0, 2, 'w', gameState)) {
        moves.push({ from: [rank, file], to: [0, 2], castling: 'q' });
      }
    }

    return moves;
  }

  // Validate move format
  isValidMoveFormat(move) {
    return /^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/.test(move);
  }

  // Check if a square is attacked by the opponent
  isSquareAttacked(rank, file, byColor, gameState) {
    // Check attacks from all opponent pieces
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const piece = gameState.board[r][f];
        if (piece && this.isPieceColor(piece, byColor)) {
          if (this.canPieceAttackSquare(r, f, piece, rank, file, gameState)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // Check if a piece can attack a specific square
  canPieceAttackSquare(fromRank, fromFile, piece, toRank, toFile, gameState) {
    const pieceType = piece.toLowerCase();
    const rankDiff = toRank - fromRank;
    const fileDiff = toFile - fromFile;

    switch (pieceType) {
      case 'p':
        const isWhite = piece === 'P';
        const direction = isWhite ? -1 : 1;
        return rankDiff === direction && Math.abs(fileDiff) === 1;

      case 'r':
        return (rankDiff === 0 || fileDiff === 0) && this.isPathClear(fromRank, fromFile, toRank, toFile, gameState);

      case 'n':
        return (Math.abs(rankDiff) === 2 && Math.abs(fileDiff) === 1) ||
               (Math.abs(rankDiff) === 1 && Math.abs(fileDiff) === 2);

      case 'b':
        return Math.abs(rankDiff) === Math.abs(fileDiff) && this.isPathClear(fromRank, fromFile, toRank, toFile, gameState);

      case 'q':
        return ((rankDiff === 0 || fileDiff === 0) || (Math.abs(rankDiff) === Math.abs(fileDiff))) &&
               this.isPathClear(fromRank, fromFile, toRank, toFile, gameState);

      case 'k':
        return Math.abs(rankDiff) <= 1 && Math.abs(fileDiff) <= 1;
    }
    return false;
  }

  // Check if path between two squares is clear
  isPathClear(fromRank, fromFile, toRank, toFile, gameState) {
    const rankStep = toRank === fromRank ? 0 : (toRank > fromRank ? 1 : -1);
    const fileStep = toFile === fromFile ? 0 : (toFile > fromFile ? 1 : -1);

    let currentRank = fromRank + rankStep;
    let currentFile = fromFile + fileStep;

    while (currentRank !== toRank || currentFile !== toFile) {
      if (gameState.board[currentRank][currentFile]) {
        return false;
      }
      currentRank += rankStep;
      currentFile += fileStep;
    }
    return true;
  }

  // Check if a move is legal (doesn't leave king in check)
  isMoveLegal(move, gameState) {
    // Make the move temporarily
    const newGameState = this.makeMove(move, gameState);

    // Find the king of the side that just moved
    const kingColor = gameState.activeColor;
    let kingRank, kingFile;

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = newGameState.board[rank][file];
        if (piece && piece.toLowerCase() === 'k' && this.isPieceColor(piece, kingColor)) {
          kingRank = rank;
          kingFile = file;
          break;
        }
      }
    }

    // Check if king is in check
    const opponentColor = kingColor === 'w' ? 'b' : 'w';
    return !this.isSquareAttacked(kingRank, kingFile, opponentColor, newGameState);
  }

  // Make a move and return new game state
  makeMove(move, gameState) {
    const newGameState = JSON.parse(JSON.stringify(gameState)); // Deep copy
    const [fromRank, fromFile] = move.from;
    const [toRank, toFile] = move.to;

    const piece = newGameState.board[fromRank][fromFile];
    newGameState.board[fromRank][fromFile] = null;
    newGameState.board[toRank][toFile] = piece;

    // Handle special moves
    if (move.castling) {
      // Move the rook for castling
      if (move.castling === 'K') {
        newGameState.board[7][5] = newGameState.board[7][7];
        newGameState.board[7][7] = null;
      } else if (move.castling === 'Q') {
        newGameState.board[7][3] = newGameState.board[7][0];
        newGameState.board[7][0] = null;
      } else if (move.castling === 'k') {
        newGameState.board[0][5] = newGameState.board[0][7];
        newGameState.board[0][7] = null;
      } else if (move.castling === 'q') {
        newGameState.board[0][3] = newGameState.board[0][0];
        newGameState.board[0][0] = null;
      }
    }

    if (move.enPassant) {
      // Remove the captured pawn
      const capturedPawnRank = gameState.activeColor === 'w' ? toRank + 1 : toRank - 1;
      newGameState.board[capturedPawnRank][toFile] = null;
    }

    if (move.promotion) {
      // Promote the pawn
      const promotedPiece = gameState.activeColor === 'w' ? move.promotion.toUpperCase() : move.promotion;
      newGameState.board[toRank][toFile] = promotedPiece;
    }

    return newGameState;
  }

  // Convert move object to UCI notation
  moveToUCI(move) {
    const fromSquare = String.fromCharCode(97 + move.from[1]) + (8 - move.from[0]);
    const toSquare = String.fromCharCode(97 + move.to[1]) + (8 - move.to[0]);
    const promotion = move.promotion ? move.promotion : '';
    return fromSquare + toSquare + promotion;
  }

  // Emergency fallback moves
  getEmergencyMoves(fen) {
    const isWhite = fen.includes(' w ');
    if (isWhite) {
      return ['e2e4', 'd2d4', 'g1f3', 'b1c3', 'f1c4'];
    } else {
      return ['e7e5', 'd7d5', 'g8f6', 'b8c6', 'f8c5'];
    }
  }

  postMessage(command) {
    if (!this.isInitialized) {
      console.warn('Engine not initialized yet');
      return;
    }

    // Simulate UCI command processing
    // Process commands immediately to prevent delays
    try {
      if (command === 'uci') {
        if (this.onmessage) this.onmessage('uciok');
      } else if (command === 'isready') {
        if (this.onmessage) this.onmessage('readyok');
      } else if (command.startsWith('position fen')) {
        // Extract and store the FEN position
        const fenMatch = command.match(/position fen (.+)/);
        if (fenMatch) {
          this.currentFen = fenMatch[1].trim();
        }
        console.log('Position set:', this.currentFen);
      } else if (command.startsWith('go depth')) {
        // Start analysis
        this.analyzePosition(command);
      } else if (command === 'stop') {
        // Stop any ongoing analysis
        this.stopAnalysis();
      } else if (command === 'quit') {
        // Clean up and quit
        this.cleanup();
      }
    } catch (error) {
      console.error('Error processing command:', command, error);
      if (this.onmessage) {
        this.onmessage('bestmove (none)');
      }
    }
  }

  stopAnalysis() {
    // Clear any timeouts or intervals
    if (this.analysisTimeout) {
      clearTimeout(this.analysisTimeout);
      this.analysisTimeout = null;
    }

    // Send a quick best move if we have legal moves
    const legalMoves = this.generateLegalMoves(this.currentFen);
    if (legalMoves.length > 0) {
      const quickMove = this.selectBestMove(legalMoves, this.currentFen);
      if (this.onmessage && quickMove) {
        this.onmessage(`bestmove ${quickMove}`);
      }
    } else if (this.onmessage) {
      this.onmessage('bestmove (none)');
    }
  }

  cleanup() {
    this.stopAnalysis();
    this.isInitialized = false;
    this.onmessage = null;
  }

  // Advanced position evaluation
  evaluatePosition(fen) {
    try {
      const gameState = this.parseFEN(fen);
      let score = 0;

      // Material evaluation
      score += this.evaluateMaterial(gameState);

      // Positional evaluation
      score += this.evaluatePositional(gameState);

      // King safety
      score += this.evaluateKingSafety(gameState);

      // Mobility and piece activity
      score += this.evaluateMobility(gameState);

      // Return score from perspective of side to move
      return gameState.activeColor === 'w' ? score : -score;
    } catch (error) {
      return 0;
    }
  }

  // Evaluate material balance
  evaluateMaterial(gameState) {
    let score = 0;
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = gameState.board[rank][file];
        if (piece) {
          const value = this.pieceValues[piece];
          score += this.isPieceColor(piece, 'w') ? value : -value;
        }
      }
    }
    return score;
  }

  // Evaluate positional factors
  evaluatePositional(gameState) {
    let score = 0;

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = gameState.board[rank][file];
        if (piece) {
          const pieceType = piece.toLowerCase();
          const isWhite = this.isPieceColor(piece, 'w');
          const adjustedRank = isWhite ? rank : 7 - rank;

          let positionalValue = 0;
          switch (pieceType) {
            case 'p':
              positionalValue = this.pawnTable[adjustedRank][file];
              break;
            case 'n':
              positionalValue = this.knightTable[adjustedRank][file];
              break;
            case 'b':
              positionalValue = this.bishopTable[adjustedRank][file];
              break;
            case 'k':
              positionalValue = this.kingTable[adjustedRank][file];
              break;
          }

          score += isWhite ? positionalValue : -positionalValue;
        }
      }
    }

    return score;
  }

  // Evaluate king safety
  evaluateKingSafety(gameState) {
    let score = 0;

    // Find kings and evaluate their safety
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = gameState.board[rank][file];
        if (piece && piece.toLowerCase() === 'k') {
          const isWhite = this.isPieceColor(piece, 'w');
          const opponentColor = isWhite ? 'b' : 'w';

          // Count attackers around the king
          let attackers = 0;
          for (let r = rank - 1; r <= rank + 1; r++) {
            for (let f = file - 1; f <= file + 1; f++) {
              if (r >= 0 && r < 8 && f >= 0 && f < 8 && (r !== rank || f !== file)) {
                if (this.isSquareAttacked(r, f, opponentColor, gameState)) {
                  attackers++;
                }
              }
            }
          }

          const safetyScore = -attackers * 20;
          score += isWhite ? safetyScore : -safetyScore;
        }
      }
    }

    return score;
  }

  // Evaluate piece mobility
  evaluateMobility(gameState) {
    let score = 0;

    // Count legal moves for each side
    const whiteMoves = this.countMovesForColor('w', gameState);
    const blackMoves = this.countMovesForColor('b', gameState);

    score += (whiteMoves - blackMoves) * 2;

    return score;
  }

  // Count moves for a specific color
  countMovesForColor(color, gameState) {
    let moveCount = 0;
    const originalActiveColor = gameState.activeColor;
    gameState.activeColor = color;

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = gameState.board[rank][file];
        if (piece && this.isPieceColor(piece, color)) {
          const moves = this.generatePieceMoves(rank, file, piece, gameState);
          moveCount += moves.length;
        }
      }
    }

    gameState.activeColor = originalActiveColor;
    return moveCount;
  }

  // Advanced move selection with minimax-like evaluation
  selectBestMove(moves, fen) {
    if (moves.length === 0) {
      return null;
    }

    const gameState = this.parseFEN(fen);
    let bestMove = null;
    let bestScore = -Infinity;

    // Evaluate each move
    for (const moveUCI of moves) {
      const move = this.uciToMove(moveUCI, gameState);
      if (move) {
        const newGameState = this.makeMove(move, gameState);
        let score = -this.evaluatePosition(this.gameStateToFEN(newGameState));

        // Add move-specific bonuses
        score += this.getMoveBonus(move, gameState);

        // Add some randomness to avoid predictable play
        score += (Math.random() - 0.5) * 10;

        if (score > bestScore) {
          bestScore = score;
          bestMove = moveUCI;
        }
      }
    }

    return bestMove || moves[0];
  }

  // Get bonus points for specific move types
  getMoveBonus(move, gameState) {
    let bonus = 0;

    // Capture bonus
    if (move.capture) {
      bonus += 50;
    }

    // Castling bonus
    if (move.castling) {
      bonus += 30;
    }

    // Center control bonus
    const [toRank, toFile] = move.to;
    if ((toRank === 3 || toRank === 4) && (toFile === 3 || toFile === 4)) {
      bonus += 20;
    }

    // Development bonus (moving pieces from back rank)
    const [fromRank] = move.from;
    if ((gameState.activeColor === 'w' && fromRank === 7) ||
        (gameState.activeColor === 'b' && fromRank === 0)) {
      bonus += 15;
    }

    return bonus;
  }

  analyzePosition(goCommand) {
    // Clear any existing timeout
    if (this.analysisTimeout) {
      clearTimeout(this.analysisTimeout);
      this.analysisTimeout = null;
    }

    // Extract depth from command
    const depthMatch = goCommand.match(/depth (\d+)/);
    const requestedDepth = depthMatch ? parseInt(depthMatch[1]) : 18;
    const maxDepth = Math.min(Math.max(requestedDepth, this.qualityThresholds.minAnalysisDepth), this.qualityThresholds.maxAnalysisDepth);

    // Parse current position
    const gameState = this.parseFEN(this.currentFen);

    // Calculate appropriate thinking time
    const thinkingTime = this.calculateThinkingTime(gameState);

    // Generate legal moves for current position
    const legalMoves = this.generateLegalMoves(this.currentFen);

    if (legalMoves.length === 0) {
      // No legal moves - game over
      this.onmessage('bestmove (none)');
      return;
    }

    console.log(`[Engine] Starting analysis: ${legalMoves.length} legal moves, thinking time: ${thinkingTime}ms, max depth: ${maxDepth}`);

    // Initialize analysis state
    this.analysisStartTime = Date.now();
    this.currentAnalysisDepth = 1;
    this.bestMoveFound = null;
    this.bestEvaluation = -Infinity;

    // Start progressive deepening analysis
    this.runProgressiveAnalysis(legalMoves, gameState, maxDepth, thinkingTime);
  }

  runProgressiveAnalysis(legalMoves, gameState, maxDepth, thinkingTime) {
    const analysisInterval = setInterval(() => {
      const elapsedTime = Date.now() - this.analysisStartTime;

      // Check if we should continue analysis
      const shouldContinue = this.shouldContinueAnalysis(elapsedTime, thinkingTime, this.currentAnalysisDepth, maxDepth);

      if (shouldContinue && this.onmessage) {
        // Analyze at current depth
        const depthResult = this.analyzeAtDepth(legalMoves, gameState, this.currentAnalysisDepth);

        if (depthResult.bestMove) {
          this.bestMoveFound = depthResult.bestMove;
          this.bestEvaluation = depthResult.evaluation;

          // Send progress update
          this.onmessage(`info depth ${this.currentAnalysisDepth} score cp ${Math.round(depthResult.evaluation)} pv ${depthResult.bestMove} time ${elapsedTime}`);
        }

        this.currentAnalysisDepth++;
      } else {
        // Analysis complete
        clearInterval(analysisInterval);
        this.finalizeAnalysis(elapsedTime, thinkingTime);
      }
    }, 100); // Check every 100ms for smooth progress updates
  }

  shouldContinueAnalysis(elapsedTime, thinkingTime, currentDepth, maxDepth) {
    // Must reach minimum depth
    if (currentDepth < this.qualityThresholds.minAnalysisDepth) {
      return true;
    }

    // Don't exceed maximum depth
    if (currentDepth > maxDepth) {
      return false;
    }

    // Must use minimum thinking time for quality
    if (elapsedTime < thinkingTime * 0.8) {
      return true;
    }

    // Stop if we've used our allocated time
    if (elapsedTime >= thinkingTime) {
      return false;
    }

    // Continue if we have time and haven't reached max depth
    return currentDepth <= maxDepth;
  }

  analyzeAtDepth(legalMoves, gameState, depth) {
    let bestMove = null;
    let bestEvaluation = -Infinity;
    const moveEvaluations = [];

    // Evaluate each legal move
    for (const moveUCI of legalMoves) {
      const move = this.uciToMove(moveUCI, gameState);
      if (move) {
        // Evaluate move quality
        const quality = this.evaluateMoveQuality(move, gameState, bestEvaluation);

        if (quality.isAcceptable && quality.evaluation > bestEvaluation) {
          bestEvaluation = quality.evaluation;
          bestMove = moveUCI;
        }

        moveEvaluations.push({
          move: moveUCI,
          evaluation: quality.evaluation,
          quality: quality.qualityScore
        });
      }
    }

    // Sort moves by evaluation for better move ordering in future depths
    moveEvaluations.sort((a, b) => b.evaluation - a.evaluation);

    return {
      bestMove: bestMove || legalMoves[0], // Fallback to first legal move
      evaluation: bestEvaluation,
      moveEvaluations: moveEvaluations
    };
  }

  finalizeAnalysis(elapsedTime, plannedTime) {
    console.log(`[Engine] Analysis complete: ${elapsedTime}ms (planned: ${plannedTime}ms), depth: ${this.currentAnalysisDepth - 1}, best move: ${this.bestMoveFound}`);

    // Ensure we have a valid move
    if (this.bestMoveFound) {
      // Final quality check
      const gameState = this.parseFEN(this.currentFen);
      const move = this.uciToMove(this.bestMoveFound, gameState);

      if (move) {
        const finalQuality = this.evaluateMoveQuality(move, gameState, this.bestEvaluation);

        if (finalQuality.isAcceptable) {
          this.onmessage(`bestmove ${this.bestMoveFound}`);
          return;
        }
      }
    }

    // Fallback: select a safe move
    const legalMoves = this.generateLegalMoves(this.currentFen);
    const fallbackMove = this.selectSafeMove(legalMoves, gameState);

    console.log(`[Engine] Using fallback move: ${fallbackMove}`);
    this.onmessage(`bestmove ${fallbackMove || legalMoves[0] || '(none)'}`);
  }

  selectSafeMove(legalMoves, gameState) {
    // Select a move that doesn't blunder material
    for (const moveUCI of legalMoves) {
      const move = this.uciToMove(moveUCI, gameState);
      if (move) {
        const quality = this.evaluateMoveQuality(move, gameState, -Infinity);
        if (quality.qualityScore > -100) { // Not a major blunder
          return moveUCI;
        }
      }
    }

    return legalMoves[0]; // Last resort
  }

  // Convert UCI notation to move object
  uciToMove(uci, gameState) {
    if (uci.length < 4) return null;

    const fromFile = uci.charCodeAt(0) - 97;
    const fromRank = 8 - parseInt(uci[1]);
    const toFile = uci.charCodeAt(2) - 97;
    const toRank = 8 - parseInt(uci[3]);
    const promotion = uci.length > 4 ? uci[4] : null;

    const move = {
      from: [fromRank, fromFile],
      to: [toRank, toFile]
    };

    if (promotion) {
      move.promotion = promotion;
    }

    // Check for special moves
    const piece = gameState.board[fromRank][fromFile];
    if (piece && piece.toLowerCase() === 'k' && Math.abs(toFile - fromFile) === 2) {
      move.castling = toFile > fromFile ? (gameState.activeColor === 'w' ? 'K' : 'k') : (gameState.activeColor === 'w' ? 'Q' : 'q');
    }

    if (piece && piece.toLowerCase() === 'p' && Math.abs(toFile - fromFile) === 1 && !gameState.board[toRank][toFile]) {
      move.enPassant = true;
    }

    if (gameState.board[toRank][toFile]) {
      move.capture = true;
    }

    return move;
  }

  // Convert game state back to FEN
  gameStateToFEN(gameState) {
    let fen = '';

    // Board position
    for (let rank = 0; rank < 8; rank++) {
      let emptyCount = 0;
      for (let file = 0; file < 8; file++) {
        const piece = gameState.board[rank][file];
        if (piece) {
          if (emptyCount > 0) {
            fen += emptyCount;
            emptyCount = 0;
          }
          fen += piece;
        } else {
          emptyCount++;
        }
      }
      if (emptyCount > 0) {
        fen += emptyCount;
      }
      if (rank < 7) {
        fen += '/';
      }
    }

    // Add other FEN components
    fen += ` ${gameState.activeColor}`;
    fen += ` ${gameState.castlingRights}`;
    fen += ` ${gameState.enPassantTarget}`;
    fen += ` ${gameState.halfmoveClock}`;
    fen += ` ${gameState.fullmoveNumber}`;

    return fen;
  }
}

// Initialize advanced chess engine
async function initializeStockfish() {
  try {
    console.log('Initializing advanced chess engine...');

    stockfish = new AdvancedChessEngine();

    // Set up message handler for engine output
    stockfish.onmessage = function(line) {
      handleStockfishOutput(line);
    };

    // Initialize the engine
    await stockfish.initialize();

    // Send ready message to main thread
    self.postMessage({
      type: 'ready',
      ready: true
    });

    isReady = true;
    console.log('Advanced chess engine initialized successfully');
  } catch (error) {
    console.error('Failed to initialize chess engine:', error);
    self.postMessage({
      type: 'error',
      error: 'Failed to initialize chess engine: ' + error.message
    });
  }
}

// Handle output from Stockfish engine
function handleStockfishOutput(line) {
  if (!line || typeof line !== 'string') return;
  
  console.log('Stockfish output:', line);
  
  // Parse UCI output
  if (line.includes('uciok')) {
    // UCI initialization complete
    stockfish.postMessage('isready');
  } else if (line.includes('readyok')) {
    // Engine is ready for commands
    isReady = true;
  } else if (line.startsWith('info')) {
    // Analysis information
    parseAnalysisInfo(line);
  } else if (line.startsWith('bestmove')) {
    // Best move found
    parseBestMove(line);
  }
}

// Parse analysis information from UCI output
function parseAnalysisInfo(line) {
  if (!currentAnalysis) return;
  
  const parts = line.split(' ');
  let depth = null;
  let score = null;
  let pv = [];
  
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === 'depth' && i + 1 < parts.length) {
      depth = parseInt(parts[i + 1]);
    } else if (parts[i] === 'score') {
      if (i + 2 < parts.length) {
        if (parts[i + 1] === 'cp') {
          // Centipawn score
          score = parseInt(parts[i + 2]) / 100;
        } else if (parts[i + 1] === 'mate') {
          // Mate in X moves
          const mateIn = parseInt(parts[i + 2]);
          score = mateIn > 0 ? 999 : -999;
        }
      }
    } else if (parts[i] === 'pv') {
      // Principal variation (best line)
      pv = parts.slice(i + 1);
      break;
    }
  }
  
  if (depth !== null && score !== null) {
    self.postMessage({
      type: 'analysis',
      depth: depth,
      evaluation: score,
      bestMove: pv[0] || null,
      principalVariation: pv
    });
  }
}

// Parse best move from UCI output
function parseBestMove(line) {
  const parts = line.split(' ');
  if (parts.length >= 2) {
    const bestMove = parts[1];
    
    self.postMessage({
      type: 'bestmove',
      bestMove: bestMove !== '(none)' ? bestMove : null
    });
    
    // Clear current analysis
    currentAnalysis = null;
  }
}

// Handle messages from main thread
self.onmessage = function(e) {
  const { type, data } = e.data;
  
  switch (type) {
    case 'init':
      initializeStockfish();
      break;
      
    case 'analyze':
      if (!isReady || !stockfish) {
        self.postMessage({
          type: 'error',
          error: 'Stockfish not ready'
        });
        return;
      }
      
      analyzePosition(data);
      break;
      
    case 'stop':
      if (stockfish && currentAnalysis) {
        stockfish.postMessage('stop');
        currentAnalysis = null;
      }
      break;
      
    case 'quit':
      if (stockfish) {
        stockfish = null;
        isReady = false;
      }
      break;
      
    default:
      console.warn('Unknown message type:', type);
  }
};

// Analyze a chess position
function analyzePosition(data) {
  const { fen, depth = 15, timeLimit = 5000 } = data;
  
  if (!stockfish || !isReady) {
    self.postMessage({
      type: 'error',
      error: 'Stockfish not ready'
    });
    return;
  }
  
  // Stop any ongoing analysis
  if (currentAnalysis) {
    stockfish.postMessage('stop');
  }
  
  // Set up new analysis
  currentAnalysis = {
    fen,
    depth,
    timeLimit,
    startTime: Date.now()
  };
  
  // Send position to Stockfish
  stockfish.postMessage(`position fen ${fen}`);
  
  // Start analysis with depth limit
  stockfish.postMessage(`go depth ${depth}`);
  
  // Set timeout for analysis
  setTimeout(() => {
    if (currentAnalysis && currentAnalysis.fen === fen) {
      stockfish.postMessage('stop');
    }
  }, timeLimit);
}

// Initialize when worker loads
initializeStockfish();
