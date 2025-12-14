"use client";

import { useEffect, useRef } from "react";

interface SoundManagerProps {
  gameState: "idle" | "action" | "win";
  isMuted: boolean;
}

export default function SoundManager({
  gameState,
  isMuted,
}: SoundManagerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    // Initialize audio element
    if (typeof window !== "undefined" && !audioRef.current) {
      audioRef.current = new Audio("/sound/HighStackers 2.m4a");
      audioRef.current.loop = true;
      audioRef.current.volume = 0.3;

      // Try to play immediately
      const playPromise = audioRef.current.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            hasStartedRef.current = true;
            console.log("Audio started automatically");
          })
          .catch((error) => {
            console.log(
              "Autoplay prevented, waiting for user interaction:",
              error
            );
            // Add click listener to start audio on first user interaction
            const startAudio = () => {
              if (audioRef.current && !hasStartedRef.current) {
                audioRef.current.play().then(() => {
                  hasStartedRef.current = true;
                  console.log("Audio started after user interaction");
                });
              }
              document.removeEventListener("click", startAudio);
            };
            document.addEventListener("click", startAudio);
          });
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, []);

  // Handle mute/unmute
  useEffect(() => {
    if (!audioRef.current) return;

    if (isMuted) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((error) => {
        console.log("Play prevented:", error);
      });
    }
  }, [isMuted]);

  // Adjust volume based on game state
  useEffect(() => {
    if (!audioRef.current) return;

    if (gameState === "idle") {
      audioRef.current.volume = 0.3;
    } else if (gameState === "action") {
      audioRef.current.volume = 0.6;
    } else if (gameState === "win") {
      audioRef.current.volume = 0.8;
    }
  }, [gameState]);

  return null;
}
