"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";

interface MultiplierOverlayProps {
  gameState: "idle" | "action" | "win";
  potAmount?: number;
}

export default function MultiplierOverlay({
  gameState,
  potAmount = 0,
}: MultiplierOverlayProps) {
  const [multiplier, setMultiplier] = useState(1.0);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevGameStateRef = useRef(gameState);

  // Use layoutEffect for synchronous updates before paint
  useLayoutEffect(() => {
    if (prevGameStateRef.current !== gameState) {
      prevGameStateRef.current = gameState;

      if (gameState === "action") {
        setMultiplier(1.0);
        setIsAnimating(true);
      } else {
        setMultiplier(1.0);
        setIsAnimating(false);
      }
    }
  }, [gameState]);

  useEffect(() => {
    // Start interval for action state
    if (gameState === "action") {
      const interval = setInterval(() => {
        setMultiplier((prev) => {
          const increment = Math.random() * 0.15 + 0.05;
          const next = prev + increment;
          return next > 10 ? 10 : next;
        });
      }, 200);

      return () => clearInterval(interval);
    }
  }, [gameState]);

  const getPotentialWin = () => {
    if (potAmount === 0) return "0.00";
    return (potAmount * multiplier * 0.9).toFixed(2); // 90% to winner
  };

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
      {gameState === "idle" && (
        <div className="text-center">
          <div className="text-6xl font-bold text-zinc-600 mb-2">
            1.00<span className="text-4xl">x</span>
          </div>
          <p className="text-zinc-500 text-sm">Waiting for action...</p>
        </div>
      )}

      {gameState === "action" && (
        <div className="text-center">
          <div
            className={`text-8xl font-bold bg-gradient-to-r from-[#7F73FF] to-[#F7931A] bg-clip-text text-transparent transition-all duration-200 ${
              isAnimating ? "animate-pulse scale-110" : ""
            }`}
          >
            {multiplier.toFixed(2)}
            <span className="text-5xl">x</span>
          </div>

          {potAmount > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-black/60 border border-[#F7931A]/30 backdrop-blur-sm">
              <p className="text-zinc-400 text-sm mb-1">Potential Win</p>
              <p className="text-[#F7931A] text-3xl font-bold">
                {getPotentialWin()} STX
              </p>
            </div>
          )}

          <div className="mt-6 flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#F7931A] animate-ping"></div>
            <p className="text-[#F7931A] text-sm font-semibold uppercase tracking-wider">
              Rising...
            </p>
          </div>
        </div>
      )}

      {gameState === "win" && (
        <div className="text-center">
          <div className="text-9xl font-bold text-[#F7931A] mb-4 animate-bounce">
            {multiplier.toFixed(2)}
            <span className="text-6xl">x</span>
          </div>

          <div className="p-6 rounded-2xl bg-gradient-to-r from-[#7F73FF]/20 to-[#F7931A]/20 border border-[#F7931A] backdrop-blur-sm">
            <p className="text-white text-2xl font-bold mb-2">🎉 WINNER!</p>
            {potAmount > 0 && (
              <p className="text-[#F7931A] text-4xl font-bold">
                +{getPotentialWin()} STX
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
