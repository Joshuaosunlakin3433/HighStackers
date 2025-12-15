import { openContractCall } from "@stacks/connect";
import {
  Cl,
  Pc,
  cvToJSON,
  uintCV,
  fetchCallReadOnlyFunction,
} from "@stacks/transactions";
import { STACKS_TESTNET } from "@stacks/network";

// Contract deployed on Stacks Testnet
const CONTRACT_ADDRESS = "ST1XF7QZ52F6WYHKP9NKR869NNN3ZEY6SXHQ9E497";
const CONTRACT_NAME = "high-stackers";
const NETWORK = STACKS_TESTNET;

export interface Lobby {
  maker: string;
  makerAddress?: string; // Full address for validation
  taker: string | null;
  amount: number;
  targetMultiplier: number;
  status: number;
  winner: string | null;
  createdAt: number;
}

/**
 * Create a new lobby
 * @param amount Amount in STX (will be converted to microSTX)
 * @param targetMultiplier Target multiplier (2-10)
 * @param senderAddress User's Stacks address (for post-conditions)
 */
export async function createLobby(
  amount: number,
  targetMultiplier: number,
  senderAddress: string
) {
  const amountInMicroStx = amount * 1_000_000; // Convert STX to microSTX

  console.log("Opening contract call...");

  return new Promise((resolve, reject) => {
    openContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: "create-lobby",
      functionArgs: [Cl.uint(amountInMicroStx), Cl.uint(targetMultiplier)],
      postConditions: [],
      postConditionMode: 0x01, // Allow mode - contract does stx-transfer
      network: NETWORK,
      onFinish: (data) => {
        console.log("✅ Transaction broadcast:", data);
        resolve(data);
      },
      onCancel: () => {
        console.log("❌ User cancelled transaction");
        reject(new Error("Transaction cancelled"));
      },
    });
  });
}

/**
 * Join an existing lobby
 * @param lobbyId ID of the lobby to join
 * @param amount Amount in STX that the lobby requires
 * @param senderAddress User's Stacks address (for post-conditions)
 */
export async function joinLobby(
  lobbyId: number,
  amount: number,
  senderAddress: string
) {
  const amountInMicroStx = amount * 1_000_000; // Convert STX to microSTX

  console.log("Opening join lobby contract call...", {
    lobbyId,
    amount,
    amountInMicroStx,
    senderAddress,
  });

  return new Promise((resolve, reject) => {
    openContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: "join-lobby",
      functionArgs: [Cl.uint(lobbyId)],
      postConditions: [
        // Taker sends their bet to the contract
        Pc.principal(senderAddress).willSendEq(amountInMicroStx).ustx(),
      ],
      postConditionMode: 0x01, // Allow mode - contract will send STX to winner/loser
      network: NETWORK,
      onFinish: (data) => {
        console.log("✅ Join transaction broadcast:", data);
        resolve(data);
      },
      onCancel: () => {
        console.log("❌ User cancelled join transaction");
        reject(new Error("Transaction cancelled"));
      },
    });
  });
}

/**
 * Get lobby details from blockchain
 * @param lobbyId ID of the lobby
 */
export async function getLobby(lobbyId: number): Promise<Lobby | null> {
  try {
    const result = await fetchCallReadOnlyFunction({
      network: NETWORK,
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: "get-lobby",
      functionArgs: [uintCV(lobbyId)],
      senderAddress: CONTRACT_ADDRESS,
    });

    const json = cvToJSON(result);

    // Contract returns (some {...}) so check if it's 'none'
    if (json.type === "none" || !json.value) {
      return null;
    }

    // The actual lobby data is in json.value.value (because it's wrapped in 'some')
    const lobbyData = json.value.value || json.value;

    return {
      maker: lobbyData.maker.value,
      taker: lobbyData.taker.value,
      amount: parseInt(lobbyData.amount.value) / 1_000_000,
      targetMultiplier: parseInt(lobbyData["target-multiplier"].value),
      status: parseInt(lobbyData.status.value),
      winner:
        lobbyData.winner.type === "none"
          ? ""
          : lobbyData.winner.value?.value || lobbyData.winner.value || "",
      createdAt: parseInt(lobbyData["created-at"].value),
    };
  } catch (error) {
    console.error(`❌ Error fetching lobby ${lobbyId}:`, error);
    return null;
  }
}

/**
 * Get current lobby counter from blockchain
 */
export async function getLobbyCounter(): Promise<number> {
  let retries = 3;
  let delay = 1000;

  while (retries > 0) {
    try {
      const result = await fetchCallReadOnlyFunction({
        network: NETWORK,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: "get-lobby-counter",
        functionArgs: [],
        senderAddress: CONTRACT_ADDRESS,
      });

      console.log("🔍 Raw result from get-lobby-counter:", result);
      const json = cvToJSON(result);
      console.log("📊 JSON parsed result:", JSON.stringify(json, null, 2));

      // Try multiple paths to find the counter value
      const counterValue =
        json.value?.value || // (ok uint) format
        json.value || // Direct uint
        json.success?.value || // Alternative success format
        0;

      const counter = parseInt(String(counterValue));
      console.log("✅ Final counter value:", counter);
      return counter;
    } catch (error) {
      retries--;
      if (retries === 0) {
        console.error("❌ Error fetching lobby counter after retries:", error);
        return 0;
      }
      console.warn(
        `⚠️ Retry getLobbyCounter (${retries} left), waiting ${delay}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
  return 0;
}

/**
 * Get all open lobbies by querying recent lobby IDs
 */
export async function getOpenLobbies(): Promise<Array<Lobby & { id: number }>> {
  try {
    const counter = await getLobbyCounter();
    console.log("📊 Lobby counter:", counter);

    if (counter === 0) {
      console.log("No lobbies created yet");
      return [];
    }

    // Fetch last 10 lobbies to ensure we show all open ones
    const startId = Math.max(1, counter - 9);
    console.log(`🔍 Checking lobbies from ${counter} down to ${startId}`);

    // Fetch all lobbies in parallel for faster loading
    const lobbyIds = Array.from(
      { length: counter - startId + 1 },
      (_, i) => counter - i
    );

    const lobbyPromises = lobbyIds.map(async (id) => {
      try {
        const lobby = await getLobby(id);
        if (lobby && lobby.status === 1) {
          console.log(`✅ Found open lobby ${id}`);
          return { ...lobby, id };
        }
        return null;
      } catch (error) {
        console.warn(`⚠️ Failed to fetch lobby ${id}`);
        return null;
      }
    });

    // Wait for all fetches to complete
    const results = await Promise.all(lobbyPromises);

    // Filter out nulls and return open lobbies
    const openLobbies = results.filter(
      (lobby): lobby is Lobby & { id: number } => lobby !== null
    );

    console.log("✅ Total open lobbies found:", openLobbies.length);
    return openLobbies;
  } catch (error) {
    console.error("Error fetching open lobbies:", error);
    return [];
  }
}

/**
 * Get recent completed games
 */
export async function getRecentGames(): Promise<
  Array<{ id: number; winner: string; amount: number }>
> {
  try {
    const counter = await getLobbyCounter();

    const recentGames: Array<{
      id: number;
      winner: string;
      amount: number;
    }> = [];

    // Check last 15 lobbies to find recent completed games
    const startId = Math.max(1, counter - 14);

    for (let i = counter; i >= startId; i--) {
      try {
        const lobby = await getLobby(i);
        if (lobby && lobby.status === 3 && lobby.winner) {
          // 3 = status-closed

          recentGames.push({
            id: i,
            winner: `${lobby.winner.slice(0, 6)}...${lobby.winner.slice(-3)}`,
            amount: lobby.amount * 2 * 0.9, // 90% of pot to winner
          });

          if (recentGames.length >= 10) break; // Limit to 10 recent
        }

        // Delay between requests to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 150));
      } catch (error) {
        console.warn(`Failed to fetch game ${i}, skipping`);
        continue;
      }
    }

    return recentGames;
  } catch (error) {
    console.error("Error fetching recent games:", error);
    return [];
  }
}

/**
 * Convert STX to microSTX
 */
export function stxToMicroStx(stx: number): number {
  return stx * 1_000_000;
}

/**
 * Convert microSTX to STX
 */
export function microStxToStx(microStx: number): number {
  return microStx / 1_000_000;
}
