import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';

// Path to the Stockfish binary
// Note: You'll need to manually add the stockfish binary to this location
const STOCKFISH_PATH = process.platform === 'win32' 
  ? path.join(process.cwd(), 'bin', 'stockfish.exe')
  : path.join(process.cwd(), 'bin', 'stockfish');

interface StockfishResponse {
  evaluation?: number;
  bestMove?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Check if the Stockfish binary exists
    try {
      await fs.access(STOCKFISH_PATH);
    } catch (error) {
      const errorMessage = `
Stockfish binary not found at ${STOCKFISH_PATH}.

Please follow these steps to install Stockfish:

1. Download Stockfish from https://stockfishchess.org/download/
2. Create a 'bin' folder in the project root directory
3. Place the Stockfish executable in the 'bin' folder
   - For Windows: Name it 'stockfish.exe'
   - For macOS/Linux: Name it 'stockfish' and make it executable with 'chmod +x bin/stockfish'

Alternatively, run 'npm run download-stockfish' or 'bun run download-stockfish' to automatically download and install Stockfish.
      `.trim();
      
      return NextResponse.json({
        error: errorMessage
      }, { status: 500 });
    }

    // Parse request body
    const { fen, depth = 15, timeLimit = 3000 } = await request.json();

    if (!fen) {
      return NextResponse.json({ error: 'FEN position is required' }, { status: 400 });
    }

    // Run Stockfish analysis
    const result = await analyzePosition(fen, depth, timeLimit);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Stockfish analysis error:', error);
    return NextResponse.json({ error: 'Failed to analyze position' }, { status: 500 });
  }
}

async function analyzePosition(fen: string, depth: number, timeLimit: number): Promise<StockfishResponse> {
  return new Promise((resolve) => {
    let stockfish;
    try {
      stockfish = spawn(STOCKFISH_PATH);
    } catch (error) {
      console.error('Failed to spawn Stockfish process:', error);
      return resolve({ error: 'Failed to start Stockfish process' });
    }
    
    let evaluation: number | undefined;
    let bestMove: string | undefined;
    let timeout: NodeJS.Timeout;
    let isResolved = false;
    
    // Helper function to safely resolve only once
    const safeResolve = (result: StockfishResponse) => {
      if (!isResolved) {
        isResolved = true;
        resolve(result);
      }
    };
    
    // Helper function to safely clean up
    const cleanup = () => {
      clearTimeout(timeout);
      try {
        if (stockfish && !stockfish.killed) {
          stockfish.stdin.end();
          stockfish.kill();
        }
      } catch (e) {
        console.error('Error during Stockfish cleanup:', e);
      }
    };
    
    // Set a timeout to prevent hanging
    timeout = setTimeout(() => {
      cleanup();
      safeResolve({ 
        evaluation, 
        bestMove, 
        error: bestMove ? undefined : 'Analysis timed out' 
      });
    }, timeLimit);
    
    stockfish.stdout.on('data', (data) => {
      try {
        const output = data.toString();
        
        // Parse evaluation score
        if (output.includes('score cp ')) {
          const match = output.match(/score cp (-?\d+)/);
          if (match && match[1]) {
            evaluation = parseInt(match[1], 10) / 100; // Convert centipawns to pawns
          }
        }
        
        // Parse mate score
        if (output.includes('score mate ')) {
          const match = output.match(/score mate (-?\d+)/);
          if (match && match[1]) {
            const mateInMoves = parseInt(match[1], 10);
            // Convert mate score to a high evaluation value
            evaluation = mateInMoves > 0 ? 999 : -999;
          }
        }
        
        // Parse best move
        if (output.startsWith('bestmove')) {
          const moveMatch = output.match(/bestmove (\w+)/);
          if (moveMatch && moveMatch[1]) {
            bestMove = moveMatch[1];
            
            cleanup();
            safeResolve({ evaluation, bestMove });
          }
        }
      } catch (error) {
        console.error('Error parsing Stockfish output:', error);
      }
    });
    
    stockfish.stderr.on('data', (data) => {
      console.error(`Stockfish error: ${data}`);
    });
    
    stockfish.on('error', (error) => {
      console.error('Stockfish process error:', error);
      cleanup();
      safeResolve({ error: 'Failed to start Stockfish process' });
    });
    
    stockfish.on('close', (code) => {
      if (code !== 0 && !bestMove && !isResolved) {
        cleanup();
        safeResolve({ error: `Stockfish process exited with code ${code}` });
      }
    });
    
    // Handle unexpected errors
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception in Stockfish process:', error);
      cleanup();
      safeResolve({ error: 'Unexpected error during analysis' });
    });
    
    // Send commands to Stockfish
    try {
      stockfish.stdin.write('uci\n');
      stockfish.stdin.write('isready\n');
      stockfish.stdin.write(`position fen ${fen}\n`);
      stockfish.stdin.write(`go depth ${depth}\n`);
    } catch (error) {
      console.error('Error sending commands to Stockfish:', error);
      cleanup();
      safeResolve({ error: 'Failed to communicate with Stockfish' });
    }
  });
}

// Also handle GET requests for testing
export async function GET() {
  try {
    const stockfishAvailable = await fs.access(STOCKFISH_PATH).then(() => true).catch(() => false);
    
    return NextResponse.json(
      { 
        message: 'Stockfish API is running',
        usage: 'Send a POST request with { "fen": "your_fen_string", "depth": 15 }',
        stockfishAvailable,
        path: STOCKFISH_PATH
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        message: 'Stockfish API is running, but encountered an error checking stockfish availability',
        error: String(error)
      },
      { status: 500 }
    );
  }
} 