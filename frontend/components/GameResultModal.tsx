"use client";

import { useEffect, useState } from "react";
import Confetti from "react-confetti";

interface GameResultModalProps {
  isOpen: boolean;
  didWin: boolean;
  amount: number;
  onClose: () => void;
  onPlayAgain: () => void;
}

export default function GameResultModal({
  isOpen,
  didWin,
  amount,
  onClose,
  onPlayAgain,
}: GameResultModalProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1920,
    height: typeof window !== "undefined" ? window.innerHeight : 1080,
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const updateSize = () => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      };
      updateSize();
      window.addEventListener("resize", updateSize);
      return () => window.removeEventListener("resize", updateSize);
    }
  }, []);

  useEffect(() => {
    if (isOpen && didWin) {
      console.log("🎊 Showing confetti!", { windowSize, isOpen, didWin });
      setShowConfetti(true);
      // Stop confetti after 5 seconds
      const timer = setTimeout(() => {
        setShowConfetti(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, didWin]);

  if (!isOpen) return null;

  return (
    <>
      {/* Confetti for winners */}
      {showConfetti && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          numberOfPieces={500}
          recycle={false}
          colors={["#7c3aed", "#a78bfa", "#c4b5fd", "#fbbf24", "#f59e0b"]}
        />
      )}

      {/* Modal Overlay */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn">
        <div
          className={`relative max-w-lg w-full mx-4 rounded-2xl p-8 text-center transform transition-all duration-500 ${
            didWin
              ? "bg-gradient-to-br from-purple-900/90 via-violet-800/90 to-fuchsia-900/90 animate-scaleIn"
              : "bg-gradient-to-br from-gray-800/90 via-gray-700/90 to-gray-900/90 animate-slideUp"
          }`}
        >
          {/* Winner Content */}
          {didWin ? (
            <>
              {/* Trophy Icon */}
              <div className="text-8xl mb-4 animate-bounce">🏆</div>

              <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 mb-4 animate-pulse">
                YOU WON!
              </h2>

              <div className="mb-6">
                <p className="text-gray-300 text-lg mb-2">You earned</p>
                <div className="text-6xl font-black text-white mb-2 animate-pulse">
                  +{amount.toFixed(2)} <span className="text-4xl">STX</span>
                </div>
                <p className="text-yellow-400 text-sm font-semibold">
                  🔥 90% Winner's Pot
                </p>
              </div>

              <p className="text-gray-300 mb-8 text-lg">
                Incredible! Your stack just got{" "}
                <span className="text-yellow-400 font-bold">HIGHER</span>! 🚀
              </p>

              <div className="flex gap-4 justify-center">
                <button
                  onClick={onPlayAgain}
                  className="px-8 py-4 bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-bold rounded-xl hover:scale-105 transform transition-all shadow-lg hover:shadow-yellow-500/50"
                >
                  🎯 Stack Higher Again!
                </button>
                <button
                  onClick={onClose}
                  className="px-8 py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transform transition-all"
                >
                  Close
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Loser Icon */}
              <div className="text-8xl mb-4 animate-pulse">😔</div>

              <h2 className="text-4xl font-black text-gray-200 mb-4">
                Not This Time...
              </h2>

              <div className="mb-6">
                <p className="text-gray-400 text-lg mb-2">But you got back</p>
                <div className="text-5xl font-black text-orange-400 mb-2">
                  +{amount.toFixed(2)} <span className="text-3xl">STX</span>
                </div>
                <p className="text-orange-400 text-sm font-semibold">
                  🔥 8% Restack Rebate
                </p>
              </div>

              <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-xl p-4 mb-6 border border-orange-500/30">
                <p className="text-gray-200 text-lg font-semibold mb-2">
                  💪 Don't Give Up!
                </p>
                <p className="text-gray-300 text-sm">
                  Every HighStacker knows:{" "}
                  <span className="text-orange-400 font-bold">
                    You only lose if you quit.
                  </span>
                  <br />
                  Your Restack Rebate keeps you in the game! 🔄
                </p>
              </div>

              <div className="flex gap-4 justify-center">
                <button
                  onClick={onPlayAgain}
                  className="px-8 py-4 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold rounded-xl hover:scale-105 transform transition-all shadow-lg hover:shadow-orange-500/50"
                >
                  🔥 Restack & Try Again!
                </button>
                <button
                  onClick={onClose}
                  className="px-8 py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transform transition-all"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
