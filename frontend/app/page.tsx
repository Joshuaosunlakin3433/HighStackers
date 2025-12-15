"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import GameScene from "@/components/GameScene";
import WalletConnect from "@/components/WalletConnect";
import WelcomeModal from "@/components/WelcomeModal";
import SoundManager from "@/components/SoundManager";
import MultiplierOverlay from "@/components/MultiplierOverlay";
import GameResultModal from "@/components/GameResultModal";
import { TrendingUp, ExternalLink, Volume2, VolumeX } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import {
  isConnected as checkWalletConnection,
  getLocalStorage,
} from "@stacks/connect";
import {
  createLobby,
  joinLobby,
  getLobby,
  getLobbyCounter,
  getOpenLobbies,
  getRecentGames,
} from "@/lib/blockchain";

interface Lobby {
  id: number;
  maker: string;
  amount: number;
  multiplier: number;
  status: "open" | "in-progress" | "closed";
}

interface RecentGame {
  id: number;
  winner: string;
  amount: number;
}

export default function Home() {
  const [gameState, setGameState] = useState<"idle" | "action" | "win">("idle");
  const [amount, setAmount] = useState("");
  const multiplier = "2"; // Fixed at 2x for MVP - custom multipliers coming soon
  const [showInfoBanner, setShowInfoBanner] = useState(true);
  const [isMuted, setIsMuted] = useState(false); // Start unmuted - sound plays on load
  const [canvasReady, setCanvasReady] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentPot, setCurrentPot] = useState(0);
  const [showResultModal, setShowResultModal] = useState(false);
  const [gameResult, setGameResult] = useState<{
    didWin: boolean;
    amount: number;
  } | null>(null);

  // Fetch real lobbies and games from blockchain
  type FormattedLobby = {
    id: number;
    maker: string;
    makerAddress: string;
    amount: number;
    multiplier: number;
    status: "open";
  };

  const [lobbies, setLobbies] = useState<FormattedLobby[]>([]);
  const [isLoadingLobbies, setIsLoadingLobbies] = useState(false);
  const [isBackgroundRefresh, setIsBackgroundRefresh] = useState(false);

  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [isLoadingGames, setIsLoadingGames] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  const loadingQuotes = [
    "Scanning the blockchain for worthy opponents...",
    "Calculating your winning odds... Looking good!",
    "Shuffling the virtual deck...",
    "Connecting to the Stacks network...",
    "Loading high-stakes battles...",
    "Warming up the randomness engine...",
    "Checking for active Stackers...",
    "Remember: Losers get 8% back with Restack Rebate!",
    "Pro tip: Create a lobby and let others join you!",
    "The house barely wins... (only 2% platform fee)!",
  ];

  const [loadingQuote, setLoadingQuote] = useState(
    loadingQuotes[Math.floor(Math.random() * loadingQuotes.length)]
  );

  // Rotate loading quote every 3 seconds while loading
  useEffect(() => {
    if (isLoadingLobbies) {
      const interval = setInterval(() => {
        setLoadingQuote(
          loadingQuotes[Math.floor(Math.random() * loadingQuotes.length)]
        );
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isLoadingLobbies]);

  // Check wallet connection status and listen for changes
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window !== "undefined") {
        const connected = checkWalletConnection();
        setIsConnected(connected);

        // Check for recent game results when wallet connects
        if (connected) {
          await checkForRecentGameResult();
          // Also refresh lobbies when wallet connects
          refreshBlockchainData();
        }
      }
    };

    checkConnection();

    // Listen for wallet connection events
    window.addEventListener("wallet-connected", checkConnection);
    window.addEventListener("wallet-disconnected", checkConnection);
    window.addEventListener("storage", checkConnection);

    return () => {
      window.removeEventListener("wallet-connected", checkConnection);
      window.removeEventListener("wallet-disconnected", checkConnection);
      window.removeEventListener("storage", checkConnection);
    };
  }, []);

  // Hide info banner after 15 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowInfoBanner(false);
    }, 15000);
    return () => clearTimeout(timer);
  }, []);

  // Fetch blockchain data on mount and periodically
  const refreshBlockchainData = async (isBackground = false) => {
    // Show loading spinner for initial loads only
    if (!isBackground) {
      setIsLoadingLobbies(true);
      setIsLoadingGames(true);
    } else {
      setIsBackgroundRefresh(true);
    }

    try {
      // Fetch lobbies and games in parallel for faster load
      const [openLobbies, games] = await Promise.all([
        getOpenLobbies(),
        getRecentGames(),
      ]);

      // Format lobbies
      const formattedLobbies = openLobbies.map((lobby) => ({
        id: lobby.id,
        maker: `${lobby.maker.slice(0, 6)}...${lobby.maker.slice(-3)}`,
        makerAddress: lobby.maker,
        amount: lobby.amount,
        multiplier: lobby.targetMultiplier,
        status: "open" as const,
      }));

      // ALWAYS preserve existing data if new fetch is empty
      if (formattedLobbies.length > 0) {
        setLobbies(formattedLobbies);
      }

      if (games.length > 0) {
        setRecentGames(games);
      }

      setLastRefreshTime(new Date());
    } catch (error) {
      console.error("❌ Error fetching blockchain data:", error);
      // Keep existing data on error - don't clear anything
    } finally {
      setIsLoadingLobbies(false);
      setIsLoadingGames(false);
      setIsBackgroundRefresh(false);
    }
  };

  // Check if the connected user participated in a recent game
  const checkForRecentGameResult = async () => {
    try {
      const userData = getLocalStorage();
      if (!userData || !userData.addresses) return;

      const userAddress = userData.addresses.stx[0].address;
      if (!userAddress) return;

      console.log("🔍 Checking for recent game results for:", userAddress);

      // Get the current lobby counter
      const counter = await getLobbyCounter();
      if (counter === 0) return;

      // Check last 3 lobbies
      for (let i = counter; i >= Math.max(1, counter - 2); i--) {
        const lobby = await getLobby(i);
        console.log(`Checking lobby ${i}:`, {
          status: lobby?.status,
          winner: lobby?.winner,
        });

        if (!lobby || lobby.status !== 3 || !lobby.winner) continue;

        // Check if user was in this game (as maker or taker)
        const wasParticipant =
          lobby.maker.toLowerCase() === userAddress.toLowerCase() ||
          (lobby.taker?.toLowerCase() || "") === userAddress.toLowerCase();

        console.log(`Lobby ${i} - Was participant:`, wasParticipant, {
          maker: lobby.maker,
          taker: lobby.taker,
        });

        if (wasParticipant) {
          // Check if we already showed this result (use localStorage with wallet address)
          const shownKey = `game-result-shown-${userAddress}-${i}`;
          const alreadyShown = localStorage.getItem(shownKey);
          console.log(`Lobby ${i} - Already shown:`, alreadyShown);

          if (alreadyShown) continue;

          const didUserWin =
            lobby.winner.toLowerCase() === userAddress.toLowerCase();
          const amount = didUserWin
            ? lobby.amount * 2 * 0.9 // Winner: 90% of pot
            : lobby.amount * 0.08; // Loser: 8% rebate

          console.log(`🎮 Showing result for lobby ${i}:`, {
            didUserWin,
            amount,
          });

          // Show the modal
          setGameResult({ didWin: didUserWin, amount });
          setShowResultModal(true);

          // Mark as shown for this specific wallet
          localStorage.setItem(shownKey, "true");
          break; // Only show one result at a time
        }
      }
    } catch (error) {
      console.error("Error checking for recent game:", error);
    }
  };

  useEffect(() => {
    // Immediate fetch on mount
    refreshBlockchainData(false);

    // Poll every 10 seconds for fresh data
    const interval = setInterval(() => refreshBlockchainData(true), 10000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleDeployStack = async () => {
    // Validation checks
    if (!isConnected) {
      toast.error("Please connect your wallet first!");
      return;
    }

    if (!amount || parseFloat(amount) < 1) {
      toast.error("Minimum bet is 1 STX");
      return;
    }

    const betAmount = parseFloat(amount);
    const targetMultiplier = parseInt(multiplier);

    if (targetMultiplier < 2 || targetMultiplier > 10) {
      toast.error("Multiplier must be between 2x and 10x");
      return;
    }

    try {
      // Get userData from getLocalStorage as per docs
      const userData = getLocalStorage();

      if (!userData || !userData.addresses) {
        toast.error("Wallet not connected. Please reconnect.");
        return;
      }

      const userAddress = userData.addresses.stx[0].address;

      if (!userAddress) {
        toast.error("Could not get address. Please reconnect wallet!");
        return;
      }

      // Set pot amount for multiplier overlay
      setCurrentPot(betAmount * 2);
      setGameState("action");

      toast.loading("Creating lobby...", { id: "create-lobby" });

      try {
        const response = await createLobby(
          betAmount,
          targetMultiplier,
          userAddress
        );

        // Reset game state immediately
        setGameState("idle");

        // Immediate optimistic refresh
        setTimeout(() => refreshBlockchainData(false), 2000);
        // Follow-up check in case blockchain needs more time
        setTimeout(() => refreshBlockchainData(true), 6000);
        // Final check to catch any late updates
        setTimeout(() => refreshBlockchainData(true), 12000);

        if (response && (response as any).txId) {
          const txId = (response as any).txId.startsWith("0x")
            ? (response as any).txId
            : `0x${(response as any).txId}`;
          const explorerUrl = `https://explorer.hiro.so/txid/${txId}?chain=testnet`;

          toast.success(
            <div
              onClick={() => window.open(explorerUrl, "_blank")}
              className="cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div className="font-bold text-base mb-1">🎮 Lobby Created!</div>
              <div className="text-zinc-400 text-sm mb-2">
                Waiting for a challenger to join...
              </div>
              <div className="flex items-center gap-2 text-[#7F73FF] text-xs font-mono bg-zinc-900/50 px-3 py-1.5 rounded-lg mb-2">
                <span>📋</span>
                <span>
                  {txId.slice(0, 10)}...{txId.slice(-8)}
                </span>
                <span className="ml-auto text-zinc-500">Click to view →</span>
              </div>
              <div className="text-zinc-600 text-xs italic">
                🕒 Explorer may take 5-10s to index transaction
              </div>
            </div>,
            {
              id: "create-lobby",
              duration: 15000,
            }
          );

          // Refresh immediately and again after 3 seconds with Nakamoto
          refreshBlockchainData();
          setTimeout(() => {
            refreshBlockchainData();
          }, 3000);
        } else {
          console.warn(
            "Transaction submitted but no txId in response:",
            response
          );
          toast.success(
            "Lobby creation submitted! Waiting for confirmation...",
            {
              id: "create-lobby",
              duration: 5000,
            }
          );

          setTimeout(() => {
            refreshBlockchainData();
          }, 5000);
        }
      } catch (txError) {
        console.error("Transaction error:", txError);
        throw txError;
      }

      // Keep in action state while waiting for opponent
      // In production, you'd listen for blockchain events
    } catch (error: unknown) {
      console.error("❌ Error creating lobby:", error);
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast.error(`Failed to create lobby: ${message}`, {
        id: "create-lobby",
        duration: 6000,
      });
      setGameState("idle");
      setCurrentPot(0);
    }
  };

  const handleJoinLobby = async (
    lobbyId: number,
    lobbyAmount: number,
    lobbyMakerAddress: string
  ) => {
    if (!isConnected) {
      toast.error("Please connect your wallet first!");
      return;
    }

    try {
      // Get userData from getLocalStorage as per docs
      const userData = getLocalStorage();

      if (!userData || !userData.addresses) {
        toast.error("Wallet not connected. Please reconnect.");
        return;
      }

      const userAddress = userData.addresses.stx[0].address;

      if (!userAddress) {
        toast.error("Could not get address. Please reconnect wallet!");
        return;
      }

      // Prevent joining own lobby
      if (userAddress.toLowerCase() === lobbyMakerAddress.toLowerCase()) {
        toast.error("You can't join your own lobby! Wait for another player.", {
          duration: 4000,
          icon: "🚫",
        });
        return;
      }

      // Set pot amount for multiplier overlay
      setCurrentPot(lobbyAmount * 2);
      setGameState("action");

      toast.loading("Joining lobby...", { id: "join-lobby" });

      const response = await joinLobby(lobbyId, lobbyAmount, userAddress);

      // Immediate refresh to remove joined lobby
      setTimeout(() => refreshBlockchainData(false), 2000);
      // Follow-up checks for game result
      setTimeout(() => refreshBlockchainData(true), 6000);
      setTimeout(() => refreshBlockchainData(true), 12000);

      // Start multiplier animation immediately
      setGameState("action");

      if (response && (response as any).txId) {
        const txId = (response as any).txId.startsWith("0x")
          ? (response as any).txId
          : `0x${(response as any).txId}`;
        const explorerUrl = `https://explorer.hiro.so/txid/${txId}?chain=testnet`;

        toast.success(
          <div
            onClick={() => window.open(explorerUrl, "_blank")}
            className="cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="font-bold text-base mb-1">⚡ Game Started!</div>
            <div className="text-zinc-400 text-sm mb-2">
              Rolling multiplier... Good luck Stacker!
            </div>
            <div className="flex items-center gap-2 text-[#F7931A] text-xs font-mono bg-zinc-900/50 px-3 py-1.5 rounded-lg mb-2">
              <span>📋</span>
              <span>
                {txId.slice(0, 10)}...{txId.slice(-8)}
              </span>
              <span className="ml-auto text-zinc-500">Click to view →</span>
            </div>
            <div className="text-zinc-600 text-xs italic">
              🕒 Explorer may take 5-10s to index transaction
            </div>
          </div>,
          {
            id: "join-lobby",
            duration: 15000,
          }
        );

        // Wait for transaction to confirm, then fetch game result with retries
        const checkGameResult = async (attempt = 1, maxAttempts = 6) => {
          try {
            console.log(
              `🔍 Checking game result (attempt ${attempt}/${maxAttempts})...`
            );
            const resolvedLobby = await getLobby(lobbyId);
            console.log("Game resolved:", {
              winner: resolvedLobby?.winner,
              status: resolvedLobby?.status,
            });

            if (resolvedLobby && resolvedLobby.winner) {
              const winnerAddress =
                typeof resolvedLobby.winner === "string"
                  ? resolvedLobby.winner
                  : String(resolvedLobby.winner);

              const didUserWin =
                winnerAddress.toLowerCase() === userAddress.toLowerCase();
              const winnerAmount = lobbyAmount * 2 * 0.9; // 90% of pot

              setGameState("idle");

              if (didUserWin) {
                setGameResult({ didWin: true, amount: winnerAmount });
                setShowResultModal(true);
                // Immediate aggressive refresh after win
                setTimeout(() => refreshBlockchainData(false), 1000);
                setTimeout(() => refreshBlockchainData(false), 3000);
                setTimeout(() => refreshBlockchainData(true), 6000);
              } else {
                const rebateAmount = lobbyAmount * 2 * 0.08; // 8% restack rebate
                setGameResult({ didWin: false, amount: rebateAmount });
                setShowResultModal(true);
                // Immediate aggressive refresh after loss
                setTimeout(() => refreshBlockchainData(false), 1000);
                setTimeout(() => refreshBlockchainData(false), 3000);
                setTimeout(() => refreshBlockchainData(true), 6000);
              }
            } else if (attempt < maxAttempts) {
              // Retry after delay - only show toast after 2nd attempt
              if (attempt >= 2) {
                console.log("⏳ Winner not determined yet, retrying...");
                toast("Resolving game result...", {
                  duration: 4000,
                  icon: "⏳",
                });
              }
              setTimeout(() => checkGameResult(attempt + 1, maxAttempts), 5000);
            } else {
              // Max attempts reached - don't give up, keep checking
              console.log("⏱️ Still waiting, continuing checks...");
              toast(
                "Blockchain sync taking longer than usual, still checking...",
                {
                  duration: 6000,
                  icon: "⏱️",
                }
              );
              // Continue checking every 10 seconds
              setTimeout(() => checkGameResult(1, 3), 10000);
            }

            refreshBlockchainData();
          } catch (error) {
            console.error("❌ Error fetching game result:", error);
            if (attempt < maxAttempts) {
              setTimeout(() => checkGameResult(attempt + 1, maxAttempts), 5000);
            } else {
              setGameState("idle");
            }
          }
        };

        // Start checking after 8 seconds
        setTimeout(() => checkGameResult(), 8000);
      } else {
        setGameState("idle");
        toast.success("Join transaction submitted!", {
          id: "join-lobby",
          duration: 5000,
        });

        setTimeout(() => {
          refreshBlockchainData();
        }, 5000);
      }
    } catch (error: unknown) {
      console.error("❌ Error joining lobby:", error);
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast.error(`Failed to join lobby: ${message}`, {
        id: "join-lobby",
        duration: 6000,
      });
      setGameState("idle");
      setCurrentPot(0);
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Toast Notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "linear-gradient(135deg, #18181b 0%, #27272a 100%)",
            color: "#fff",
            border: "1px solid #7F73FF",
            padding: "16px 20px",
            borderRadius: "12px",
            fontSize: "14px",
            boxShadow: "0 8px 32px rgba(127, 115, 255, 0.2)",
            minWidth: "320px",
          },
          success: {
            iconTheme: {
              primary: "#7F73FF",
              secondary: "#fff",
            },
            style: {
              border: "1px solid #7F73FF",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "#fff",
            },
            style: {
              border: "1px solid #ef4444",
            },
          },
          loading: {
            iconTheme: {
              primary: "#F7931A",
              secondary: "#fff",
            },
          },
        }}
      />

      {/* Solid black overlay to prevent white flash */}
      <div
        className="absolute inset-0 bg-black z-[100] pointer-events-none transition-opacity duration-500"
        style={{ opacity: canvasReady ? 0 : 1 }}
      />

      {/* Welcome Modal */}
      <WelcomeModal />

      {/* Sound Manager - Always mounted, controlled by isMuted prop */}
      <SoundManager gameState={gameState} isMuted={isMuted} />

      {/* 3D Background Scene */}
      <div className="absolute inset-0 z-0">
        <GameScene gameState={gameState} onReady={() => setCanvasReady(true)} />
      </div>

      {/* Multiplier Overlay (center of screen) */}
      <MultiplierOverlay gameState={gameState} potAmount={currentPot} />

      {/* Footer - Fixed at bottom */}
      <footer className="absolute bottom-0 left-0 right-0 z-50 px-4 md:px-8 py-2 md:py-3 border-t border-zinc-800/50 backdrop-blur-sm bg-black/90">
        <div className="flex items-center justify-center gap-2 text-zinc-400 text-xs md:text-sm">
          <span className="hidden sm:inline">Low on STX?</span>
          <a
            href="https://app.bitflow.finance/trade"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[#F7931A] hover:text-[#E7831A] transition-colors font-semibold"
          >
            <span className="sm:hidden">Get STX on</span>
            <span className="hidden sm:inline">Get some on</span> Bitflow
            <ExternalLink className="w-3 h-3 md:w-4 md:h-4" />
          </a>
        </div>
      </footer>

      {/* UI Overlay */}
      <div className="relative z-10 w-full h-full flex flex-col pb-16">
        {/* Info Banner - Game Explanation */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 max-w-2xl mx-4 hidden md:block">
          <div className="backdrop-blur-md bg-[#7F73FF]/10 border border-[#7F73FF]/30 rounded-xl p-3 text-center">
            <p className="text-white text-sm">
              <span className="font-bold text-[#7F73FF]">LEFT:</span> Join open
              lobbies to challenge
              <span className="mx-2">|</span>
              <span className="font-bold text-[#F7931A]">RIGHT:</span> Create
              your own lobby
              <span className="mx-2">|</span>
              Winner gets 90%, Loser gets 8% back!
            </p>
          </div>
        </div>

        {/* Header */}
        <header className="flex items-center justify-between px-4 md:px-8 py-4 md:py-6 border-b border-zinc-800/50 backdrop-blur-sm bg-black/30">
          <div className="flex items-center gap-2 md:gap-3">
            <Image
              src="/icon.svg"
              alt="HighStackers Logo"
              width={40}
              height={40}
              className="w-8 h-8 md:w-10 md:h-10"
            />
            <h1 className="text-xl md:text-3xl font-bold bg-gradient-to-r from-[#7F73FF] to-white bg-clip-text text-transparent">
              HighStackers
            </h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            {/* Mute/Unmute Button */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 rounded-lg border border-zinc-700 bg-black/60 hover:bg-zinc-900 hover:border-[#7F73FF]/50 transition-all duration-200"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <VolumeX className="h-5 w-5 text-zinc-400" />
              ) : (
                <Volume2 className="h-5 w-5 text-[#7F73FF]" />
              )}
            </button>
            <WalletConnect />
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 md:p-6 overflow-y-auto">
          {/* Left Panel: Live Comms */}
          <div className="w-full lg:w-80 flex flex-col gap-3 order-2 lg:order-1">
            <div className="backdrop-blur-md bg-black/40 border border-[#7F73FF]/30 rounded-2xl p-5 shadow-xl flex-shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-[#7F73FF]" />
                <h2 className="text-xl font-bold text-white">Live Comms</h2>
                {isBackgroundRefresh && (
                  <div className="ml-auto">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#7F73FF]/50"></div>
                  </div>
                )}
              </div>
              <p className="text-zinc-400 text-xs mb-3">
                👇 Click any lobby below to join and challenge!
              </p>

              {/* Info banner */}
              <div className="mb-3 p-2 rounded-lg bg-[#7F73FF]/5 border border-[#7F73FF]/20">
                <p className="text-[10px] text-zinc-500 text-center">
                  ⏱️ Live blockchain data refreshes every 10s
                </p>
              </div>

              <div
                className="space-y-3 overflow-y-auto"
                style={{ maxHeight: "280px" }}
              >
                {isLoadingLobbies && lobbies.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7F73FF] mx-auto mb-3"></div>
                    <p className="text-zinc-400 text-sm mb-1 font-medium">
                      Loading lobbies...
                    </p>
                    <p className="text-zinc-600 text-xs italic animate-pulse">
                      {loadingQuote}
                    </p>
                  </div>
                ) : lobbies.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-zinc-500 text-sm mb-2">
                      No open lobbies yet
                    </p>
                    <p className="text-zinc-600 text-xs">
                      Create one on the right! →
                    </p>
                  </div>
                ) : (
                  lobbies.map((lobby) => (
                    <div
                      key={lobby.id}
                      className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-[#7F73FF]/70 hover:bg-zinc-900/80 transition-all cursor-pointer group"
                      onClick={() =>
                        handleJoinLobby(
                          lobby.id,
                          lobby.amount,
                          lobby.makerAddress
                        )
                      }
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[#7F73FF] font-mono text-xs group-hover:text-white transition-colors">
                          {lobby.maker}
                        </span>
                        <span className="px-2 py-1 rounded bg-[#7F73FF]/20 text-[#7F73FF] text-xs font-semibold">
                          {lobby.multiplier}x
                        </span>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="text-white font-bold text-lg">
                          {lobby.amount} STX
                        </span>
                        <span className="text-zinc-500 text-xs group-hover:text-[#F7931A] transition-colors">
                          Click to join →
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Restack Rebate Info */}
            <div className="backdrop-blur-md bg-gradient-to-br from-[#F7931A]/20 to-[#7F73FF]/20 border border-[#F7931A]/30 rounded-2xl p-3 flex-shrink-0">
              <p className="text-[#F7931A] font-bold text-sm mb-1">
                ⚡ Restack Rebate Active
              </p>
              <p className="text-white text-xs">
                Losers get 8% back. Stack again!
              </p>
            </div>

            {/* Recent Wins Feed */}
            <div className="backdrop-blur-md bg-black/60 border border-[#F7931A]/40 rounded-2xl p-4 flex flex-col flex-shrink-0">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#F7931A] animate-pulse"></span>
                🔥 Recent Wins
              </h3>

              {/* Info banner */}
              <div className="mb-3 p-2 rounded-lg bg-[#F7931A]/5 border border-[#F7931A]/20">
                <p className="text-[10px] text-zinc-500 text-center">
                  ⏱️ Results appear here after games complete
                </p>
              </div>

              <div
                className="space-y-2.5 overflow-y-auto"
                style={{ maxHeight: "180px", minHeight: "100px" }}
              >
                {isLoadingGames && recentGames.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#F7931A] mx-auto mb-2"></div>
                    <p className="text-zinc-500 text-xs">Loading wins...</p>
                  </div>
                ) : recentGames.length > 0 ? (
                  recentGames.map((game) => (
                    <div
                      key={game.id}
                      className="flex items-center justify-between text-xs py-2.5 px-3 rounded-lg bg-zinc-900/60 border border-zinc-800"
                    >
                      <span className="text-[#7F73FF] font-mono font-semibold truncate">
                        {game.winner}
                      </span>
                      <span className="text-[#F7931A] font-bold text-sm whitespace-nowrap ml-2">
                        +{game.amount.toFixed(2)} STX
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-zinc-500 text-xs text-center py-4">
                    No games yet. Be the first!
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Center: 3D Scene (transparent) */}
          <div className="flex-1 min-h-[300px] lg:min-h-0 order-1 lg:order-2" />

          {/* Right Panel: Command Deck */}
          <div className="w-full lg:w-80 flex flex-col gap-4 order-3">
            <div className="backdrop-blur-md bg-black/40 border border-[#F7931A]/30 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-2">
                Command Deck
              </h2>
              <p className="text-zinc-400 text-xs mb-4">
                ⚡ Create your own lobby and wait for a challenger
              </p>

              <div className="space-y-4">
                {/* Amount Input */}
                <div>
                  <label className="block text-zinc-400 text-sm mb-2">
                    Stack Amount (STX)
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Min. 1 STX"
                    className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#F7931A] focus:outline-none text-white placeholder-zinc-600 transition-colors"
                  />
                </div>

                {/* Coming Soon Features */}
                <div className="p-3 rounded-xl bg-gradient-to-r from-zinc-900/50 to-zinc-800/50 border border-zinc-700/50">
                  <p className="text-zinc-500 text-xs font-semibold mb-2 uppercase tracking-wider">
                    Coming Soon
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 text-xs rounded-full bg-[#7F73FF]/10 text-[#7F73FF] border border-[#7F73FF]/20">
                      Custom Multipliers
                    </span>
                    <span className="px-3 py-1 text-xs rounded-full bg-[#F7931A]/10 text-[#F7931A] border border-[#F7931A]/20">
                      sBTC Support
                    </span>
                    <span className="px-3 py-1 text-xs rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      USDCx Support
                    </span>
                  </div>
                </div>

                {/* Payout Preview */}
                <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <p className="text-zinc-400 text-xs mb-2">
                    Potential Payout (2x Multiplier)
                  </p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Winner (90%)</span>
                      <span className="text-[#7F73FF] font-bold">
                        {amount
                          ? (parseFloat(amount) * 2 * 0.9).toFixed(2)
                          : "0.00"}{" "}
                        STX
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Loser Rebate (8%)</span>
                      <span className="text-[#F7931A] font-semibold">
                        {amount
                          ? (parseFloat(amount) * 2 * 0.08).toFixed(2)
                          : "0.00"}{" "}
                        STX
                      </span>
                    </div>
                  </div>
                </div>

                {/* Deploy Button */}
                <button
                  onClick={handleDeployStack}
                  disabled={
                    !amount || parseFloat(amount) < 1 || gameState === "action"
                  }
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-[#7F73FF] to-[#F7931A] hover:from-[#6F63EF] hover:to-[#E7831A] disabled:from-zinc-800 disabled:to-zinc-800 disabled:cursor-not-allowed text-white font-bold text-lg transition-all duration-200 shadow-lg shadow-[#7F73FF]/20 hover:shadow-[#7F73FF]/40 disabled:shadow-none"
                >
                  {!isConnected
                    ? "Connect Wallet First"
                    : gameState === "action"
                    ? "Processing..."
                    : "Deploy Stack"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Game Result Modal */}
      {gameResult && (
        <GameResultModal
          isOpen={showResultModal}
          didWin={gameResult.didWin}
          amount={gameResult.amount}
          onClose={() => {
            setShowResultModal(false);
            setGameResult(null);
            // Final refresh when modal closes
            setTimeout(() => refreshBlockchainData(false), 500);
            setTimeout(() => refreshBlockchainData(true), 2000);
          }}
          onPlayAgain={() => {
            setShowResultModal(false);
            setGameResult(null);
            // Final refresh when playing again
            setTimeout(() => refreshBlockchainData(false), 500);
            setTimeout(() => refreshBlockchainData(true), 2000);
            // Scroll to create lobby section
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
    </div>
  );
}
