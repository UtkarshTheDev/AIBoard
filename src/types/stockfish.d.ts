declare module 'stockfish.js' {
  interface StockfishWorker {
    postMessage(message: string): void;
    onmessage: (event: MessageEvent) => void;
  }
 
  function Stockfish(): StockfishWorker;
  export = Stockfish;
} 