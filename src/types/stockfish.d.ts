declare module 'stockfish.wasm' {
  interface StockfishEngine {
    postMessage(message: string): void;
    onmessage: ((line: string) => void) | null;
    terminate(): void;
  }

  function Stockfish(): Promise<StockfishEngine>;
  export = Stockfish;
}

// Global Stockfish for Web Worker
declare var Stockfish: () => Promise<{
  postMessage(message: string): void;
  onmessage: ((line: string) => void) | null;
  terminate(): void;
}>;