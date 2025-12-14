"use client";

import { useState, useEffect } from "react";
import { X, Zap } from "lucide-react";

export default function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(() => {
    // Check sessionStorage on initial render
    if (typeof window !== "undefined") {
      return !sessionStorage.getItem("highstackers-welcome-seen");
    }
    return false;
  });

  const handleClose = () => {
    sessionStorage.setItem("highstackers-welcome-seen", "true");
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl mx-4 p-8 rounded-2xl border border-[#7F73FF]/30 bg-black/90 shadow-2xl shadow-[#7F73FF]/20">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#7F73FF] to-[#F7931A] flex items-center justify-center">
            <Zap className="w-7 h-7 text-black" />
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-[#7F73FF] to-white bg-clip-text text-transparent">
            Welcome to HighStackers
          </h2>
        </div>

        {/* Content */}
        <div className="space-y-6 text-zinc-300">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">
              🎯 How It Works
            </h3>
            <p className="text-sm leading-relaxed">
              HighStackers is a PvP betting arena built on Stacks. Two players
              enter, one wins big. It&apos;s simple, fast, and even losers get
              something back!
            </p>
          </div>

          <div>
            <h3 className="text-xl font-bold text-white mb-2">
              🎮 How to Play
            </h3>
            <ol className="space-y-2 text-sm list-decimal list-inside">
              <li>
                <span className="font-semibold text-[#7F73FF]">
                  Create a Lobby:
                </span>{" "}
                Set your bet amount (min 1 STX) and choose a multiplier (2x-10x)
              </li>
              <li>
                <span className="font-semibold text-[#7F73FF]">
                  Wait for Challenger:
                </span>{" "}
                Your lobby appears in the &quot;Live Comms&quot; panel
              </li>
              <li>
                <span className="font-semibold text-[#F7931A]">
                  Join a Lobby:
                </span>{" "}
                See an open lobby? Click to challenge! Game resolves instantly
              </li>
              <li>
                <span className="font-semibold text-white">
                  Winner Takes 90%:
                </span>{" "}
                The winner gets 90% of the total pot
              </li>
            </ol>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-r from-[#F7931A]/20 to-[#7F73FF]/20 border border-[#F7931A]/30">
            <h3 className="text-lg font-bold text-[#F7931A] mb-1">
              ⚡ Restack Rebate - You Never Lose Everything!
            </h3>
            <p className="text-sm">
              Even if you lose, you get{" "}
              <span className="font-bold text-white">8% back</span> as a
              "Restack Rebate&quot;. Use it to jump right back into the action!
            </p>
          </div>

          <div className="text-xs text-zinc-500 border-t border-zinc-800 pt-4">
            <p>
              <span className="font-semibold text-zinc-400">Platform Fee:</span>{" "}
              2% goes to platform maintenance. Randomness is generated on-chain
              (VRF coming in production).
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={handleClose}
          className="w-full mt-6 py-4 rounded-xl bg-gradient-to-r from-[#7F73FF] to-[#F7931A] hover:from-[#6F63EF] hover:to-[#E7831A] text-white font-bold text-lg transition-all duration-200 shadow-lg shadow-[#7F73FF]/20 hover:shadow-[#7F73FF]/40"
        >
          Let&apos;s Stack! 🚀
        </button>
      </div>
    </div>
  );
}
