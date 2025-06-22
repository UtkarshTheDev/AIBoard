import { ChessBoard } from '@/components/chess/ChessBoard';
import { AIMatchDebugger } from '@/components/chess/AIMatchDebugger';

export default function Home() {
  return (
    <main className="container mx-auto py-8">
      <h1 className="text-3xl font-bold text-center mb-8">AI vs AI Chess Platform</h1>
      <ChessBoard />
      <AIMatchDebugger />
    </main>
  );
}
