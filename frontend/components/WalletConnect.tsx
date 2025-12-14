"use client";

import {
  connect,
  disconnect,
  isConnected,
  getLocalStorage,
  request,
} from "@stacks/connect";
import { useState, useEffect } from "react";

export default function WalletConnect() {
  const [authenticated, setAuthenticated] = useState(false);
  const [stxAddress, setStxAddress] = useState<string | null>(null);

  // Initialize wallet state on client-side only
  useEffect(() => {
    if (typeof window !== "undefined") {
      const checkConnection = () => {
        try {
          const connected = isConnected();
          setAuthenticated(connected);

          if (connected) {
            const userData = getLocalStorage();
            const stxAddr = userData?.addresses?.stx?.[0]?.address;
            if (stxAddr) {
              setStxAddress(stxAddr);
              console.log("Wallet already connected:", stxAddr);
            }
          }
        } catch (error) {
          console.error("Failed to initialize wallet state:", error);
        }
      };

      checkConnection();

      // Listen for storage changes
      const handleStorageChange = () => {
        console.log("Storage changed, rechecking connection...");
        checkConnection();
      };

      window.addEventListener("storage", handleStorageChange);
      window.addEventListener("wallet-connected", checkConnection);

      return () => {
        window.removeEventListener("storage", handleStorageChange);
        window.removeEventListener("wallet-connected", checkConnection);
      };
    }
  }, []);

  const connectWallet = async () => {
    try {
      // Connect wallet
      await connect();
      console.log("Connect completed");

      // Wait a moment then get from localStorage
      setTimeout(() => {
        const userData = getLocalStorage();
        console.log("Full userData from getLocalStorage:", userData);

        if (userData?.addresses?.stx?.[0]?.address) {
          const address = userData.addresses.stx[0].address;
          console.log("Got STX address:", address);

          setAuthenticated(true);
          setStxAddress(address);

          // Dispatch custom event so parent can update
          window.dispatchEvent(new Event("wallet-connected"));
        } else {
          console.error("No STX addresses found");
          console.log("userData structure:", JSON.stringify(userData, null, 2));
        }
      }, 500);
    } catch (error) {
      console.error("Connection error:", error);
    }
  };

  const disconnectWallet = () => {
    disconnect();
    setAuthenticated(false);
    setStxAddress(null);
    // Dispatch custom event
    window.dispatchEvent(new Event("wallet-disconnected"));
    console.log("User disconnected");
  };

  if (authenticated && stxAddress) {
    const shortAddress = `${stxAddress.slice(0, 6)}...${stxAddress.slice(-4)}`;

    return (
      <div className="flex items-center gap-3">
        <div className="px-4 py-2 rounded-lg bg-[#7F73FF]/10 border border-[#7F73FF]/30">
          <span className="text-[#7F73FF] font-mono text-sm">
            {shortAddress}
          </span>
        </div>
        <button
          onClick={disconnectWallet}
          className="px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors text-zinc-400 text-sm"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connectWallet}
      className="px-6 py-3 rounded-lg bg-[#7F73FF] hover:bg-[#6F63EF] transition-all duration-200 text-white font-semibold shadow-lg shadow-[#7F73FF]/20 hover:shadow-[#7F73FF]/40"
    >
      Connect Wallet
    </button>
  );
}
