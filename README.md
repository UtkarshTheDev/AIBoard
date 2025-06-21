# AI vs AI Chess Platform

A Next.js-based chess platform for AI vs AI gameplay, with Stockfish analysis integration.

## Features

- Interactive chessboard using react-chessboard
- Chess game logic using chess.js
- Move history tracking and navigation
- Timer functionality with pause/resume
- Stockfish integration for position analysis and best move suggestions
- Game status detection (check, checkmate, draw)
- Ready for Gemini API integration

## Tech Stack

- Next.js with App Router
- TypeScript
- chess.js for game logic
- react-chessboard for UI
- Stockfish for analysis (server-side)
- Zustand for state management
- Shadcn/UI for components

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- npm, yarn, or bun

### Installation

1. Clone the repository
2. Install dependencies:

```bash
bun install
```

3. Download Stockfish:
   - Go to [Stockfish Downloads](https://stockfishchess.org/download/)
   - Download the appropriate version for your operating system
   - Create a `bin` folder in the project root
   - Place the Stockfish executable in the `bin` folder
   - For Windows, name it `stockfish.exe`
   - For macOS/Linux, name it `stockfish` and make it executable with `chmod +x bin/stockfish`

4. Run the development server:

```bash
bun run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## How to Use

1. Click "Make AI Move" to have Stockfish suggest a move
2. Use the timer controls to start, pause, or reset the timer
3. Navigate through move history using Previous/Next buttons
4. Analyze positions with Stockfish
5. Reset the game at any time

## Stockfish Integration

The application uses Stockfish in two ways:

1. **Server-side API**: The main integration runs Stockfish as a child process on the server via a Next.js API route. This is more reliable and works across all platforms.

2. **Client-side Fallback**: For development purposes, there's also a client-side integration that runs Stockfish in the browser. This is less reliable and may not work in all browsers.

## Integrating with Gemini API

To integrate with Gemini API for move generation:

1. Create your own API service in `src/lib/gemini-service.ts`
2. Update the `getAIMove` function in `ChessBoard.tsx` to use your Gemini API service
3. Implement logic to alternate between Stockfish and Gemini for moves

## Deployment Considerations

When deploying to platforms like Vercel, you'll need to use a different hosting solution for the Stockfish API since Vercel doesn't support running binaries. Options include:

- Deploy the Stockfish API to a separate service like Render, Railway, or DigitalOcean
- Use a serverless function that supports binary execution
- Use a WebAssembly version of Stockfish for client-side only deployments

## License

MIT
