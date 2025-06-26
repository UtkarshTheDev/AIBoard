// Stockfish Web Worker for client-side chess analysis
// This worker loads and manages the Stockfish WASM engine

let stockfish = null;
let isReady = false;
let currentAnalysis = null;

// Import Stockfish WASM - try multiple CDNs for reliability
let stockfishLoaded = false;

async function loadStockfish() {
  const cdnUrls = [
    'https://unpkg.com/stockfish.wasm@0.10.0/dist/stockfish.js',
    'https://cdn.jsdelivr.net/npm/stockfish.wasm@0.10.0/dist/stockfish.js'
  ];

  for (const url of cdnUrls) {
    try {
      console.log(`Attempting to load Stockfish from: ${url}`);
      importScripts(url);
      stockfishLoaded = true;
      console.log(`Successfully loaded Stockfish from: ${url}`);
      break;
    } catch (error) {
      console.warn(`Failed to load Stockfish from ${url}:`, error);
    }
  }

  if (!stockfishLoaded) {
    const errorMsg = 'Failed to load Stockfish from all CDN sources';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
}

// Initialize Stockfish when the worker starts
async function initializeStockfish() {
  try {
    // Load Stockfish WASM first
    if (!stockfishLoaded) {
      await loadStockfish();
    }

    // Initialize Stockfish
    if (typeof Stockfish !== 'undefined') {
      console.log('Initializing Stockfish engine...');
      stockfish = await Stockfish();

      // Set up message handler for Stockfish output
      stockfish.onmessage = function(line) {
        handleStockfishOutput(line);
      };

      // Initialize UCI protocol
      console.log('Sending UCI command...');
      stockfish.postMessage('uci');

      // Send ready message to main thread
      self.postMessage({
        type: 'ready',
        ready: true
      });

      isReady = true;
      console.log('Stockfish engine initialized successfully');
    } else {
      throw new Error('Stockfish WASM not available after loading');
    }
  } catch (error) {
    console.error('Failed to initialize Stockfish:', error);
    self.postMessage({
      type: 'error',
      error: 'Failed to initialize Stockfish: ' + error.message
    });
  }
}

// Handle output from Stockfish engine
function handleStockfishOutput(line) {
  if (!line || typeof line !== 'string') return;
  
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
        stockfish.postMessage('quit');
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

// Initialize Stockfish when worker loads
initializeStockfish();
