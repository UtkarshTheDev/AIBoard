"use client"
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAIChessProviders } from '@/lib/hooks/useAIChessProviders';
import { MoveValidator } from '@/lib/ai-chess/move-validator';
import { AIChessErrorHandler, AIChessErrorType } from '@/lib/ai-chess/error-handler';
import { FallbackManager } from '@/lib/ai-chess/fallback-manager';
import { toast } from 'sonner';

/**
 * Component to test and validate AI chess system fixes
 */
export const AIChessValidator = () => {
  const { getAIMove, providers } = useAIChessProviders();
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // Test positions for validation
  const testPositions = [
    {
      name: "Starting Position",
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      expectedMoves: ["e2e4", "d2d4", "g1f3", "b1c3"]
    },
    {
      name: "Middle Game",
      fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 4",
      expectedMoves: ["d3d4", "f3g5", "c4d5"]
    },
    {
      name: "Endgame",
      fen: "8/8/8/8/8/8/6k1/4K2R w K - 0 1",
      expectedMoves: ["h1h8", "e1f2", "e1d2"]
    }
  ];

  const runValidationTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    const results: any[] = [];

    try {
      // Test 1: Move Validator
      console.log('Testing Move Validator...');
      const moveValidatorTest = testMoveValidator();
      results.push({
        test: "Move Validator",
        status: moveValidatorTest.success ? "PASS" : "FAIL",
        details: moveValidatorTest.details
      });

      // Test 2: Error Handler
      console.log('Testing Error Handler...');
      const errorHandlerTest = testErrorHandler();
      results.push({
        test: "Error Handler",
        status: errorHandlerTest.success ? "PASS" : "FAIL",
        details: errorHandlerTest.details
      });

      // Test 3: Fallback Manager
      console.log('Testing Fallback Manager...');
      const fallbackTest = testFallbackManager();
      results.push({
        test: "Fallback Manager",
        status: fallbackTest.success ? "PASS" : "FAIL",
        details: fallbackTest.details
      });

      // Test 4: AI Move Generation (if providers available)
      if (providers.length > 0) {
        console.log('Testing AI Move Generation...');
        for (const position of testPositions.slice(0, 2)) { // Test first 2 positions
          try {
            const moveTest = await testAIMoveGeneration(position);
            results.push({
              test: `AI Move - ${position.name}`,
              status: moveTest.success ? "PASS" : "FAIL",
              details: moveTest.details
            });
          } catch (error) {
            results.push({
              test: `AI Move - ${position.name}`,
              status: "FAIL",
              details: `Error: ${error instanceof Error ? error.message : String(error)}`
            });
          }
        }
      }

      setTestResults(results);
      
      const passCount = results.filter(r => r.status === "PASS").length;
      const totalCount = results.length;
      
      if (passCount === totalCount) {
        toast.success(`All tests passed! (${passCount}/${totalCount})`);
      } else {
        toast.warning(`${passCount}/${totalCount} tests passed`);
      }

    } catch (error) {
      console.error('Validation test error:', error);
      toast.error('Validation tests failed');
    } finally {
      setIsRunning(false);
    }
  };

  const testMoveValidator = () => {
    try {
      const testCases = [
        { move: "e2e4", expected: true },
        { move: "e2e5", expected: false },
        { move: "invalid", expected: false },
        { move: "a1a8", expected: false }, // Invalid for starting position
      ];

      const startingFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
      let passed = 0;
      let total = testCases.length;

      for (const testCase of testCases) {
        const isValid = MoveValidator.isLegalMove(startingFen, testCase.move);
        if (isValid === testCase.expected) {
          passed++;
        }
      }

      // Test move extraction
      const extractionTests = [
        { text: "e2e4", expected: "e2e4" },
        { text: "The best move is e2e4 in this position", expected: "e2e4" },
        { text: "I recommend d2d4", expected: "d2d4" },
        { text: "No valid move here", expected: null }
      ];

      for (const test of extractionTests) {
        const result = MoveValidator.findBestValidMove(startingFen, test.text);
        if ((result === null && test.expected === null) || result === test.expected) {
          passed++;
        }
        total++;
      }

      return {
        success: passed === total,
        details: `${passed}/${total} move validation tests passed`
      };
    } catch (error) {
      return {
        success: false,
        details: `Move validator test failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  };

  const testErrorHandler = () => {
    try {
      const errorTests = [
        { error: new Error("Rate limit exceeded"), expectedType: AIChessErrorType.RATE_LIMIT },
        { error: new Error("Invalid API key"), expectedType: AIChessErrorType.API_KEY_INVALID },
        { error: new Error("Network error"), expectedType: AIChessErrorType.NETWORK_ERROR },
        { error: new Error("Invalid move: e2e5"), expectedType: AIChessErrorType.INVALID_MOVE },
      ];

      let passed = 0;
      for (const test of errorTests) {
        const classified = AIChessErrorHandler.classifyError(test.error, 'test-provider');
        if (classified.type === test.expectedType) {
          passed++;
        }
      }

      return {
        success: passed === errorTests.length,
        details: `${passed}/${errorTests.length} error classification tests passed`
      };
    } catch (error) {
      return {
        success: false,
        details: `Error handler test failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  };

  const testFallbackManager = () => {
    try {
      const fallbackManager = FallbackManager.getInstance();
      
      // Test provider availability
      const isGeminiAvailable = fallbackManager.isProviderAvailable('gemini');
      const isStockfishAvailable = fallbackManager.isProviderAvailable('stockfish');
      
      // Test getting best available provider
      const bestProvider = fallbackManager.getBestAvailableProvider('gemini');
      
      const tests = [
        isGeminiAvailable !== undefined,
        isStockfishAvailable !== undefined,
        bestProvider.provider !== undefined
      ];

      const passed = tests.filter(Boolean).length;

      return {
        success: passed === tests.length,
        details: `${passed}/${tests.length} fallback manager tests passed`
      };
    } catch (error) {
      return {
        success: false,
        details: `Fallback manager test failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  };

  const testAIMoveGeneration = async (position: { name: string; fen: string; expectedMoves: string[] }) => {
    return new Promise<{ success: boolean; details: string }>((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          details: "AI move generation timed out"
        });
      }, 15000); // 15 second timeout

      getAIMove(
        'gemini',
        'gemini-2.0-flash-exp',
        position.fen,
        (move) => {
          clearTimeout(timeout);
          
          const isValidFormat = MoveValidator.isValidUCIFormat(move);
          const isLegalMove = MoveValidator.isLegalMove(position.fen, move);
          
          resolve({
            success: isValidFormat && isLegalMove,
            details: `Generated move: ${move}, Valid format: ${isValidFormat}, Legal: ${isLegalMove}`
          });
        },
        { temperature: 0.1 }
      ).catch((error) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          details: `AI move generation failed: ${error instanceof Error ? error.message : String(error)}`
        });
      });
    });
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>AI Chess System Validator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={runValidationTests} 
            disabled={isRunning}
            className="flex-1"
          >
            {isRunning ? 'Running Tests...' : 'Run Validation Tests'}
          </Button>
        </div>

        {testResults.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold">Test Results:</h3>
            {testResults.map((result, index) => (
              <div 
                key={index} 
                className={`p-3 rounded border ${
                  result.status === 'PASS' 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{result.test}</span>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    result.status === 'PASS' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {result.status}
                  </span>
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {result.details}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
