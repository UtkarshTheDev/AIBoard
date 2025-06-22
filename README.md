# AI Chess Board

A chess application that allows you to play against AI models like Gemini and Stockfish.

## Recent Fixes

### Rate Limiting and AI Control Improvements

- Fixed rate limiting issues with better global rate limit tracking
- Removed artificial thinking delay for faster AI moves
- Added explicit "Start AI Game" button for better control
- Updated to use free tier Gemini models (2.0 Flash, 2.0 Flash Thinking, 2.5 Flash)
- Added comprehensive logging for API responses
- Reduced cooldown times between requests for better gameplay
- Improved error handling and user feedback

### Usage

1. Set your Gemini API key in the AI Players Configuration panel
2. Configure white and black players (human or AI)
3. Enable AI vs AI match if desired
4. Click the "Start AI Game" button to begin the AI match
5. Watch the AI players make moves or make your own moves against an AI

## Features

- Play against various AI models
- AI vs AI matches with explicit start/stop control
- Move analysis with Stockfish
- Timer functionality
- Move history and navigation

## Development

This is a Next.js project using:
- TypeScript
- Chess.js for game logic
- React Chessboard for the UI
- Gemini API for AI moves
- Stockfish for analysis

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## API Keys

You need to get your own API key from [Google AI Studio](https://ai.google.dev/) to use Gemini models.
