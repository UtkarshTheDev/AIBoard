// Local Stockfish Web Worker - No CDN Dependencies
// This worker uses a local Stockfish implementation to avoid CDN issues

let stockfish = null;
let isReady = false;
let currentAnalysis = null;

// Simple Stockfish engine simulation for development
// In production, you would replace this with actual Stockfish WASM
class LocalStockfishEngine {
  constructor() {
    this.isInitialized = false;
    this.onmessage = null;
  }

  async initialize() {
    // Simulate initialization delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.isInitialized = true;
    
    // Send UCI ready messages
    if (this.onmessage) {
      this.onmessage('uciok');
      this.onmessage('readyok');
    }
  }

  postMessage(command) {
    if (!this.isInitialized) {
      console.warn('Engine not initialized yet');
      return;
    }

    // Simulate UCI command processing
    setTimeout(() => {
      if (command === 'uci') {
        if (this.onmessage) this.onmessage('uciok');
      } else if (command === 'isready') {
        if (this.onmessage) this.onmessage('readyok');
      } else if (command.startsWith('position fen')) {
        // Position set, ready for analysis
        console.log('Position set:', command);
      } else if (command.startsWith('go depth')) {
        // Start analysis
        this.analyzePosition(command);
      } else if (command === 'stop') {
        // Stop analysis
        if (this.onmessage) this.onmessage('bestmove e2e4');
      }
    }, 100);
  }

  analyzePosition(goCommand) {
    // Extract depth from command
    const depthMatch = goCommand.match(/depth (\d+)/);
    const depth = depthMatch ? parseInt(depthMatch[1]) : 15;
    
    // Simulate analysis with progressive depth
    let currentDepth = 1;
    const analysisInterval = setInterval(() => {
      if (currentDepth <= depth && this.onmessage) {
        // Send analysis info
        const evaluation = Math.random() * 2 - 1; // Random evaluation between -1 and 1
        const centipawns = Math.round(evaluation * 100);
        
        this.onmessage(`info depth ${currentDepth} score cp ${centipawns} pv e2e4 e7e5`);
        
        currentDepth++;
        
        if (currentDepth > depth) {
          clearInterval(analysisInterval);
          // Send best move
          const moves = ['e2e4', 'e2e3', 'd2d4', 'g1f3', 'b1c3'];
          const bestMove = moves[Math.floor(Math.random() * moves.length)];
          this.onmessage(`bestmove ${bestMove}`);
        }
      }
    }, 200);
  }
}

// Initialize local Stockfish engine
async function initializeStockfish() {
  try {
    console.log('Initializing local Stockfish engine...');
    
    stockfish = new LocalStockfishEngine();
    
    // Set up message handler for Stockfish output
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
    console.log('Local Stockfish engine initialized successfully');
  } catch (error) {
    console.error('Failed to initialize local Stockfish:', error);
    self.postMessage({
      type: 'error',
      error: 'Failed to initialize local Stockfish: ' + error.message
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
