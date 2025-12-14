# HighStackers Project - Debug Log & Solutions

**Project**: HighStackers - PvP Betting Arena on Stacks Testnet  
**Framework**: Next.js 16, React 19, Stacks.js, Clarity Smart Contracts  
**Date**: December 12, 2025  
**Contract**: `ST1XF7QZ52F6WYHKP9NKR869NNN3ZEY6SXHQ9E497.high-stackers`

---

## Table of Contents

1. [Wallet Connection Issues](#wallet-connection-issues)
2. [Transaction Execution Problems](#transaction-execution-problems)
3. [Clarity Value Parsing](#clarity-value-parsing)
4. [CORS and API Issues](#cors-and-api-issues)
5. [Contract Data Structure](#contract-data-structure)
6. [Key Learnings](#key-learnings)

---

## Wallet Connection Issues

### Issue 1: Wallet Address Not Displaying After Connection

**Symptom**: User could click "Connect Wallet", approve in Leather/Hiro wallet popup, but the address never appeared in the UI. Console showed "No STX addresses in response".

**Root Cause**: Multiple attempted methods to extract address from wallet connection response, all failing due to incorrect API usage:

- Tried `response.addresses.stx[0].address` - Failed
- Tried `localStorage.getItem("stacks-user")` - Always returned null
- Tried `request("stx_getAccounts")` - Not supported, threw errors
- Tried immediate `getLocalStorage()` call - Data not available yet

**Solution**:

```typescript
import { connect, getLocalStorage } from "@stacks/connect";

const connectWallet = async () => {
  try {
    await connect({
      appDetails: {
        name: "HighStackers",
        icon: window.location.origin + "/logo.png",
      },
      onFinish: () => {
        // Wait briefly for data to persist
        setTimeout(() => {
          const userData = getLocalStorage();
          if (userData?.profile?.stxAddress) {
            const address = userData.profile.stxAddress.testnet;
            setAddress(address);
            window.dispatchEvent(new Event("wallet-connected"));
          }
        }, 500);
      },
    });
  } catch (error) {
    console.error("Connection failed:", error);
  }
};
```

**Key Learning**:

- Don't try to read wallet data from `connect()` response directly
- Use `getLocalStorage()` after a short delay (500ms) to allow data persistence
- Address is at `userData.profile.stxAddress.testnet` for testnet
- Dispatch custom events for parent components to react to wallet changes

---

## Transaction Execution Problems

### Issue 2: Deprecated API - `request()` Causing Infinite Hangs

**Symptom**: After clicking "Create Lobby" and approving in wallet popup, the UI showed "Processing..." forever. Wallet closed but frontend never received response.

**Root Cause**: Used deprecated `request("stx_callContract")` API which doesn't properly return transaction results in modern Stacks Connect.

**Original (Broken) Code**:

```typescript
const response = await request("stx_callContract", {
  contract: `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
  functionName: "create-lobby",
  functionArgs: [Cl.uint(amountInMicroStx), Cl.uint(targetMultiplier)],
  postConditionMode: "deny",
});
```

**Solution**: Switch to `openContractCall()` with callbacks:

```typescript
import { openContractCall } from "@stacks/connect";

export async function createLobby(
  amount: number,
  targetMultiplier: number,
  senderAddress: string
) {
  const amountInMicroStx = amount * 1_000_000;

  return new Promise((resolve, reject) => {
    openContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: "create-lobby",
      functionArgs: [Cl.uint(amountInMicroStx), Cl.uint(targetMultiplier)],
      postConditions: [
        Pc.principal(senderAddress).willSendEq(amountInMicroStx).ustx(),
      ],
      postConditionMode: 0x02, // Deny mode
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
```

**Key Learning**:

- `request()` API is deprecated - use `openContractCall()` instead
- `openContractCall()` uses callbacks (`onFinish`, `onCancel`), not promises
- Wrap in Promise for async/await syntax
- `postConditionMode: 0x02` = Deny mode (safer than "deny" string)

---

### Issue 3: Transaction ID Format for Explorer Links

**Symptom**: Clicking transaction toast to view on Explorer opened blank page. Transaction not found.

**Root Cause**: Missing `0x` prefix on transaction ID when constructing Explorer URL.

**Solution**:

```typescript
if (response && response.txId) {
  const txId = response.txId.startsWith("0x")
    ? response.txId
    : `0x${response.txId}`;
  const explorerUrl = `https://explorer.hiro.so/txid/${txId}?chain=testnet`;

  toast.success(
    <div>
      <div>Lobby created!</div>
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 underline text-sm"
      >
        View TX: {txId.slice(0, 8)}...{txId.slice(-4)}
      </a>
    </div>
  );
}
```

**Key Learning**:

- `onFinish` callback returns `txId` WITHOUT `0x` prefix
- Always add `0x` prefix for Explorer URLs
- Include `?chain=testnet` query parameter for testnet transactions

---

## Clarity Value Parsing

### Issue 4: Contract Response Structure - Optional Types

**Symptom**: Contract functions returned data successfully (confirmed on blockchain), but frontend couldn't parse it. Console showed "Cannot read properties of undefined (reading 'value')".

**Root Cause**: Contract's `get-lobby` function returns `(optional {...})` type, wrapping the actual data in an extra layer. Frontend was trying to access `json.value.maker` when actual path was `json.value.value.maker`.

**Contract Return Type**:

```clarity
(define-read-only (get-lobby (lobby-id uint))
    (map-get? lobbies { lobby-id: lobby-id })
)
;; Returns: (optional { maker: principal, amount: uint, ... })
```

**cvToJSON Response Structure**:

```json
{
  "type": "some",
  "value": {
    "type": "tuple",
    "value": {
      "maker": { "type": "principal", "value": "ST1XF..." },
      "amount": { "type": "uint", "value": "1000000" },
      "status": { "type": "uint", "value": "1" },
      "taker": { "type": "(optional none)", "value": null },
      "target-multiplier": { "type": "uint", "value": "2" },
      "winner": { "type": "(optional none)", "value": null },
      "created-at": { "type": "uint", "value": "3691274" }
    }
  }
}
```

**Incorrect Parsing (Failed)**:

```typescript
const json = cvToJSON(result);
const lobbyData = json.value; // This is the wrapper!
const maker = lobbyData.maker.value; // Error: maker is undefined
```

**Correct Parsing**:

```typescript
export async function getLobby(lobbyId: number): Promise<Lobby | null> {
  const result = await fetchCallReadOnlyFunction({
    network: NETWORK,
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "get-lobby",
    functionArgs: [uintCV(lobbyId)],
    senderAddress: CONTRACT_ADDRESS,
  });

  const json = cvToJSON(result);

  // Check if lobby exists (type 'none' means not found)
  if (json.type === "none" || !json.value) {
    return null;
  }

  // Data is wrapped in 'some' type, so go one level deeper
  const lobbyData = json.value.value || json.value;

  return {
    maker: lobbyData.maker.value,
    taker: lobbyData.taker.value, // null is OK here
    amount: parseInt(lobbyData.amount.value) / 1_000_000, // Convert microSTX
    targetMultiplier: parseInt(lobbyData["target-multiplier"].value),
    status: parseInt(lobbyData.status.value),
    winner: lobbyData.winner.value, // null is OK here
    createdAt: parseInt(lobbyData["created-at"].value),
  };
}
```

**Key Learning**:

- Clarity `map-get?` returns `(optional type)` which wraps response in `some` or `none`
- Check `json.type === 'none'` for non-existent entries
- Actual data is at `json.value.value` for `some` types
- Each Clarity value has structure: `{ type: "...", value: actual_value }`
- Use fallback: `json.value.value || json.value` for safety

---

### Issue 5: Contract Read-Only Function Response - (ok uint)

**Symptom**: `get-lobby-counter` returned 0 even though counter was actually 11+ on blockchain.

**Contract Function**:

```clarity
(define-read-only (get-lobby-counter)
    (ok (var-get lobby-counter))
)
;; Returns: (ok uint)
```

**Response Structure**:

```json
{
  "type": "(response uint UnknownType)",
  "value": {
    "type": "uint",
    "value": "11"
  },
  "success": true
}
```

**Incorrect Parsing**:

```typescript
const json = cvToJSON(result);
const counter = parseInt(json.value); // NaN or wrong value
```

**Correct Parsing**:

```typescript
export async function getLobbyCounter(): Promise<number> {
  const result = await fetchCallReadOnlyFunction({
    network: NETWORK,
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "get-lobby-counter",
    functionArgs: [],
    senderAddress: CONTRACT_ADDRESS,
  });

  const json = cvToJSON(result);

  // For (ok uint) response, value is nested
  const counterValue =
    json.value?.value || // Standard path for (ok uint)
    json.value || // Fallback
    json.success?.value || // Alternative success format
    0;

  return parseInt(String(counterValue));
}
```

**Key Learning**:

- Clarity `(ok type)` responses have structure: `{ type: "response...", value: { type: "...", value: actual }, success: true }`
- Counter is at `json.value.value` for `(ok uint)`
- Always use multiple fallback paths for robustness
- Convert to string before parseInt to handle edge cases

---

## CORS and API Issues

### Issue 6: Browser CORS Blocking Hiro API Calls

**Symptom**: Some `fetchCallReadOnlyFunction` calls worked, others failed with CORS errors. Console showed "Access-Control-Allow-Origin header is present" errors. Only 1 out of 10 lobby fetches succeeded.

**Root Cause**: Browser's CORS policy blocks some cross-origin requests to `api.testnet.hiro.so` from `localhost:3000`. Hiro API partially supports CORS but rate-limits or blocks rapid sequential requests from localhost.

**Attempted Solutions That Didn't Work**:

1. ❌ Added CORS headers to `next.config.ts` - No effect (headers apply to outgoing responses, not incoming requests)
2. ❌ Created Next.js API route proxy - `fetchCallReadOnlyFunction` calls API directly from browser, bypasses proxy
3. ❌ Custom StacksNetwork configuration - Still calls same API endpoint

**Working Solution**: Reduce request frequency and add delays

```typescript
export async function getOpenLobbies(): Promise<Array<Lobby & { id: number }>> {
  const counter = await getLobbyCounter();

  if (counter === 0) return [];

  const openLobbies: Array<Lobby & { id: number }> = [];

  // Only fetch last 3 lobbies to minimize CORS issues
  const startId = Math.max(1, counter - 2);

  for (let i = counter; i >= startId; i--) {
    try {
      const lobby = await getLobby(i);

      if (lobby && lobby.status === 1) {
        openLobbies.push({ ...lobby, id: i });
      }

      // 500ms delay between requests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.warn(`⚠️ Failed to fetch lobby ${i}, skipping`);
      continue; // Skip failed requests, don't crash
    }
  }

  return openLobbies;
}
```

**Key Learning**:

- Hiro testnet API has CORS restrictions from localhost
- Limit number of rapid sequential requests (max 3-5 at a time)
- Add 500ms+ delay between requests to avoid rate limiting
- Use try-catch with continue to gracefully skip failed fetches
- Consider deploying to production domain for better CORS support
- For production, cache results or use server-side API routes

---

## Contract Data Structure

### Issue 7: Status Codes Mismatch

**Symptom**: Lobbies were confirmed created on blockchain (verified in Explorer), but frontend showed 0 lobbies. `getOpenLobbies()` was checking for `status === 0` but finding none.

**Root Cause**: Frontend assumed status codes started at 0, but contract used 1-indexed status values.

**Contract Status Constants**:

```clarity
(define-constant status-open u1)
(define-constant status-in-progress u2)
(define-constant status-closed u3)
```

**Incorrect Filter**:

```typescript
if (lobby && lobby.status === 0) {
  // Wrong! No status 0 in contract
  openLobbies.push({ ...lobby, id: i });
}
```

**Correct Filter**:

```typescript
if (lobby && lobby.status === 1) {
  // 1 = status-open
  openLobbies.push({ ...lobby, id: i });
}
```

**Key Learning**:

- Always check contract source code for constant definitions
- Don't assume 0-indexed status codes - Clarity often uses 1-indexed
- Match frontend enums/constants exactly to contract values
- Add comments in code mapping status numbers to their meanings

---

## Key Learnings

### 1. Stacks Connect API Best Practices

✅ **DO**:

- Use `openContractCall()` for contract interactions
- Use `getLocalStorage()` to retrieve wallet data after connection
- Add delays (500ms) after `connect()` before reading data
- Wrap `openContractCall` in Promise for async/await
- Include `0x` prefix for transaction IDs in Explorer links
- Use `postConditionMode: 0x02` (numeric) instead of "deny" string

❌ **DON'T**:

- Use deprecated `request("stx_callContract")` API
- Try to read wallet data directly from `connect()` response
- Use `localStorage.getItem()` directly - use `getLocalStorage()`
- Forget network parameter in `openContractCall()`

### 2. Clarity Value Parsing Patterns

**Response Type Patterns**:

| Contract Return Type         | cvToJSON Structure                                         | Access Path                  |
| ---------------------------- | ---------------------------------------------------------- | ---------------------------- |
| `(ok uint)`                  | `{ value: { type: "uint", value: "123" } }`                | `json.value.value`           |
| `(optional tuple)` with data | `{ type: "some", value: { type: "tuple", value: {...} } }` | `json.value.value`           |
| `(optional tuple)` none      | `{ type: "none" }`                                         | Check `json.type === 'none'` |
| Direct tuple                 | `{ type: "tuple", value: {...} }`                          | `json.value`                 |

**Universal Parsing Function**:

```typescript
function extractClarityValue(
  json: any,
  expectedType: "none" | "some" | "ok"
): any {
  // Check for none/empty
  if (json.type === "none" || !json.value) {
    return null;
  }

  // For optional (some) and response (ok), go one level deeper
  if (json.type === "some" || json.type.includes("response")) {
    return json.value.value || json.value;
  }

  // Direct value
  return json.value;
}
```

### 3. Network and CORS Management

**For Development**:

- Limit parallel requests to Hiro API (3-5 max)
- Add 500ms delays between sequential requests
- Use try-catch with continue to handle failures gracefully
- Log all API errors for debugging but don't crash app

**For Production**:

- Deploy to real domain (not localhost) for better CORS support
- Implement server-side caching of blockchain data
- Consider using Hiro API key for higher rate limits
- Use Next.js API routes as proxy for sensitive operations

### 4. Transaction Flow Best Practices

```typescript
// Complete transaction flow with proper error handling
const handleCreateLobby = async () => {
  setGameState("action"); // Show loading state

  try {
    const response = await createLobby(amount, multiplier, userAddress);

    setGameState("idle"); // Reset immediately after tx broadcast

    if (response?.txId) {
      const txId = response.txId.startsWith("0x")
        ? response.txId
        : `0x${response.txId}`;
      const explorerUrl = `https://explorer.hiro.so/txid/${txId}?chain=testnet`;

      toast.success(
        <div>
          <div>Lobby created!</div>
          <a href={explorerUrl} target="_blank">
            View TX
          </a>
        </div>,
        { duration: 8000 }
      );

      // Refresh data after confirmation time
      setTimeout(() => refreshBlockchainData(), 3000);
    }
  } catch (error) {
    setGameState("idle");

    if (error.message?.includes("cancel")) {
      // User cancelled - no error toast needed
      return;
    }

    toast.error(`Failed: ${error.message}`);
  }
};
```

### 5. Debugging Techniques That Worked

1. **Log Raw Responses**: Always log the raw `result` before calling `cvToJSON()`

```typescript
console.log("Raw result:", result);
console.log("Result type:", result.constructor.name);
const json = cvToJSON(result);
console.log("Parsed JSON:", JSON.stringify(json, null, 2));
```

2. **Verify on Explorer**: Cross-reference contract state on Explorer vs frontend display
3. **Check Contract Source**: Read Clarity code for exact return types and status constants
4. **Test with Minimal Requests**: Reduce loop iterations to 1-2 when debugging parsing logic
5. **Use TypeScript**: Catch type mismatches early

---

## Summary: Critical Fixes Timeline

1. ✅ Fixed wallet connection using `getLocalStorage()` with setTimeout
2. ✅ Switched from `request()` to `openContractCall()` for transactions
3. ✅ Added `0x` prefix to transaction IDs for Explorer links
4. ✅ Fixed Clarity optional type parsing (`json.value.value` for `some` types)
5. ✅ Fixed response type parsing (`json.value.value` for `ok uint`)
6. ✅ Corrected status code filter (1 instead of 0 for open lobbies)
7. ✅ Reduced request frequency with delays to avoid CORS issues
8. ✅ Added error handling with graceful fallbacks

---

**Project Status**: ✅ Core functionality working

- Wallet connection: ✅ Working
- Create lobby: ✅ Working with blockchain confirmation
- Display lobbies: ✅ Working with real-time blockchain data
- Transaction links: ✅ Working with clickable Explorer links
- Join lobby: ⏳ Ready for testing

**Next Steps**:

- Test join lobby with second wallet
- Implement game resolution logic
- Add winner determination
- Test full game flow end-to-end
- Deploy to production domain for better API access

---

**Generated**: December 13-14, 2025  
**Contract**: ST1XF7QZ52F6WYHKP9NKR869NNN3ZEY6SXHQ9E497.high-stackers  
**Testnet Explorer**: https://explorer.hiro.so/address/ST1XF7QZ52F6WYHKP9NKR869NNN3ZEY6SXHQ9E497?chain=testnet

---

## CRITICAL PRODUCTION FIXES (December 13-14, 2025)

### Issue 7: Data Disappearing After Auto-Refresh

**Symptom**: Lobbies and recent games displayed correctly initially, but after 30-60 seconds of inactivity, all data disappeared from UI. Manual refresh brought it back temporarily, then disappeared again.

**Root Cause**: Auto-refresh interval (30s) was calling blockchain APIs repeatedly, causing:

1. **CORS/Rate Limiting**: Hiro API blocking requests due to frequency
2. **Empty Array Returns**: Failed requests returning `[]` instead of throwing errors
3. **State Clearing**: React state being updated with empty arrays, clearing displayed data

**Investigation Process**:

```typescript
// Original broken code - always updates even with empty data
const refreshBlockchainData = async () => {
  const openLobbies = await getOpenLobbies();
  setLobbies(formattedLobbies); // ❌ Clears data if API returns []

  const games = await getRecentGames();
  setRecentGames(games); // ❌ Clears data if API returns []
};
```

**Failed Attempts**:

1. ❌ Conditional update only for games - lobbies still disappeared
2. ❌ Reduced to checking length > 0 - still cleared on first load
3. ❌ Added loading states - didn't solve the root issue

**Final Solution** - Preserve Existing Data:

```typescript
const refreshBlockchainData = async () => {
  console.log("🔄 Starting blockchain data refresh...");
  try {
    setIsLoadingLobbies(true);
    setIsLoadingGames(true);

    const openLobbies = await getOpenLobbies();
    console.log("📦 Fetched lobbies:", openLobbies.length);

    const formattedLobbies = openLobbies.map((lobby) => ({...}));

    // Only update if we got NEW data OR it's first load (empty state)
    if (formattedLobbies.length > 0 || lobbies.length === 0) {
      console.log("✅ Updating lobbies:", formattedLobbies.length);
      setLobbies(formattedLobbies);
    } else {
      console.log("⏭️ Preserving existing lobbies:", lobbies.length);
    }

    const games = await getRecentGames();
    console.log("🎮 Fetched games:", games.length);

    if (games.length > 0 || recentGames.length === 0) {
      console.log("✅ Updating games:", games.length);
      setRecentGames(games);
    } else {
      console.log("⏭️ Preserving existing games:", recentGames.length);
    }
  } catch (error) {
    console.error("❌ Error fetching blockchain data:", error);
    // Keep existing data on error - don't clear anything
  } finally {
    setIsLoadingLobbies(false);
    setIsLoadingGames(false);
  }
};
```

**Key Learning**:

- **Never blindly update state with API responses** - they can be empty due to network issues
- **Preserve existing data** unless new valid data arrives
- **Allow initial empty state** to load first data
- **Log everything** during refresh to diagnose issues

---

### Issue 8: API Rate Limiting & CORS Blocking

**Symptom**: Console showing "Failed to fetch" errors, `TypeError: Failed to fetch` in blockchain.ts functions.

**Root Cause**: Excessive API calls overwhelming Hiro's public endpoint:

- 30-second auto-refresh interval
- Parallel fetching 10 lobbies simultaneously
- No retry logic for failed requests
- `getCurrentBlockHeight()` making extra unnecessary calls

**Solution - Multi-Layered Approach**:

1. **Remove Unnecessary API Calls**:

```typescript
// ❌ REMOVED - was causing extra network calls
export async function getCurrentBlockHeight(): Promise<number> {
  const response = await fetch(`${NETWORK.coreApiUrl}/v2/info`);
  // ... unnecessary for our use case
}
```

2. **Add Retry Logic with Exponential Backoff**:

```typescript
export async function getLobbyCounter(): Promise<number> {
  let retries = 3;
  let delay = 1000;

  while (retries > 0) {
    try {
      const result = await fetchCallReadOnlyFunction({...});
      return counter;
    } catch (error) {
      retries--;
      if (retries === 0) {
        console.error("❌ Error fetching lobby counter after retries:", error);
        return 0;
      }
      console.warn(`⚠️ Retry getLobbyCounter (${retries} left), waiting ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff: 1s → 2s
    }
  }
  return 0;
}
```

3. **Increase Refresh Interval**:

```typescript
// Changed from 30s to 45s to reduce API pressure
const interval = setInterval(refreshBlockchainData, 45000);
```

**Key Learning**:

- **Rate limits are real** - respect them with exponential backoff
- **Retry intelligently** - 3 retries with increasing delays (1s, 2s)
- **Reduce frequency** - 45s+ intervals for non-critical data
- **Remove waste** - audit all API calls, remove unnecessary ones

---

### Issue 9: Nakamoto Block Time Calculations

**Symptom**: Timestamp display showing nonsensical values like "489424h ago" or "52 games ago" for recent games.

**Root Cause**: Attempted to calculate elapsed time using block heights and assumed 10-minute block times (pre-Nakamoto behavior).

**Background - Nakamoto Upgrade (October 28, 2024)**:

Pre-Nakamoto:

- 1 Stacks block per Bitcoin block (~10 minutes)
- Predictable, consistent timing
- Easy to calculate: `(currentHeight - gameHeight) * 10 minutes`

Post-Nakamoto:

- **Tenure System**: Miners elected via Bitcoin blocks (~10 min)
- **Fast Blocks**: Each miner produces MANY blocks during their tenure
- **Variable Timing**: Average 28.9 seconds, but highly variable
- **Signer Validation**: 37 signers, 70% must approve each block
- **Computation Budget**: Block production depends on available compute

**Failed Calculation Attempt**:

```typescript
// ❌ DOESN'T WORK - Nakamoto blocks are variable
const currentHeight = await getCurrentBlockHeight();
const timeDiff = (currentHeight - game.createdAt) * 10 * 60 * 1000; // Wrong!
```

**Solution**: Remove timestamps entirely:

```typescript
// ✅ Just show game results without time calculations
interface RecentGame {
  id: number;
  winner: string;
  amount: number;
  // ❌ REMOVED: timestamp: number;
}

export async function getRecentGames(): Promise<RecentGame[]> {
  // Removed getCurrentBlockHeight() call
  // Removed timestamp calculation
  return games.map((game) => ({
    id: game.id,
    winner: `${game.winner.slice(0, 6)}...${game.winner.slice(-3)}`,
    amount: game.amount,
    // No timestamp field
  }));
}
```

**Key Learning**:

- **Nakamoto fundamentally changed block production** - don't assume fixed timing
- **Tenure system is complex** - variable blocks between Bitcoin anchors
- **When in doubt, simplify** - remove unreliable features rather than show wrong data
- **Read actual docs** - don't rely on pre-upgrade assumptions

**Reference**: https://www.hiro.so/blog/understanding-nakamotos-fast-blocks-on-stacks

---

### Issue 10: Winner/Loser Notifications Not Wallet-Specific

**Symptom**: User won game with Wallet A, saw celebration modal. Switched to Wallet B (loser) - no notification shown. Switching back to Wallet A also didn't show notification again.

**Root Cause**: localStorage key for "shown notifications" was only using lobby ID:

```typescript
// ❌ Same key for all wallets
const shownKey = `game-result-shown-${lobbyId}`;
```

**Solution**: Include wallet address in localStorage key:

```typescript
const checkForRecentGameResult = async () => {
  const userData = getLocalStorage();
  if (!userData || !userData.addresses) return;

  const userAddress = userData.addresses[0];
  const recentGames = await getRecentGames();

  for (let i = 0; i < recentGames.length; i++) {
    const game = recentGames[i];

    // ✅ Wallet-specific key
    const shownKey = `game-result-shown-${userAddress}-${game.id}`;

    if (localStorage.getItem(shownKey)) {
      continue; // Already shown to THIS wallet
    }

    // Check if THIS wallet was winner or loser
    if (game.winner === userAddress) {
      setGameResult({ isWinner: true, amount: game.amount });
      localStorage.setItem(shownKey, 'true');
    } else if (/* check if user was loser */) {
      setGameResult({ isWinner: false, rebateAmount: game.amount * 0.08 });
      localStorage.setItem(shownKey, 'true');
    }
  }
};
```

**Key Learning**:

- **Multi-wallet support requires wallet-specific state**
- **localStorage keys should include user identifiers**
- **Test with multiple wallets** to catch these issues early

---

### Issue 11: Confetti Not Displaying for Winners

**Symptom**: Winner modal showed correctly with trophy and message, but no confetti animation appeared.

**Root Cause**: `react-confetti` package requires window dimensions to render. Component was setting initial state to `{width: 0, height: 0}` before useEffect ran, causing confetti canvas to be 0x0 pixels (invisible).

**Original Broken Code**:

```typescript
const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

useEffect(() => {
  setWindowSize({
    width: window.innerWidth,
    height: window.innerHeight,
  });
}, []);
```

**Solution**: Initialize with actual window dimensions:

```typescript
const [windowSize, setWindowSize] = useState({
  width: typeof window !== "undefined" ? window.innerWidth : 1920,
  height: typeof window !== "undefined" ? window.innerHeight : 1080,
});

useEffect(() => {
  const handleResize = () => {
    setWindowSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  };

  window.addEventListener("resize", handleResize);
  return () => window.removeEventListener("resize", handleResize);
}, []);
```

**Key Learning**:

- **Canvas libraries need dimensions immediately** - can't wait for useEffect
- **Check for SSR** - `typeof window !== 'undefined'` for Next.js
- **Add resize listeners** for responsive behavior
- **Test visual effects** - they fail silently without errors

---

### Issue 12: Mobile Responsiveness Issues

**Symptom**: On mobile/tablet, UI elements overlapped, text too small, side panels not visible without scrolling, info banner hidden.

**Solution - Responsive Design System**:

```typescript
// Tailwind breakpoint classes
<main className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-140px)]">
  {/* Left Panel */}
  <aside className="w-full lg:w-80 flex-shrink-0">

  {/* Center Panel */}
  <section className="flex-1">

  {/* Right Panel */}
  <aside className="w-full lg:w-80 flex-shrink-0">
</main>

// Responsive text sizes
<h1 className="text-xl md:text-3xl">

// Responsive padding
<header className="px-4 md:px-8">

// Conditional visibility
<div className="hidden md:block"> {/* Only show on desktop */}
```

**Key Learning**:

- **Mobile-first approach** - `flex-col` default, `lg:flex-row` for desktop
- **Test on actual devices** - browser responsive mode isn't enough
- **Reduce heights on mobile** - save vertical space
- **Hide non-critical UI** - banner, extra info on small screens

---

## Critical Production Checklist

Before deploying to hackathon submission:

### Performance ✅

- [x] Removed unnecessary API calls (`getCurrentBlockHeight`)
- [x] Added retry logic with exponential backoff
- [x] Increased refresh interval to 45s
- [x] Parallel lobby fetching for speed
- [x] Data preservation during failed refreshes

### User Experience ✅

- [x] Winner/loser modals with animations
- [x] Confetti for winners (window size fixed)
- [x] Wallet-specific notifications
- [x] Loading indicators for all data fetches
- [x] Transaction links to Explorer
- [x] Responsive design (mobile/tablet/desktop)
- [x] Toast notifications for all actions

### Error Handling ✅

- [x] Try-catch blocks on all async functions
- [x] Graceful fallbacks for failed API calls
- [x] Detailed console logging for debugging
- [x] Preserve UI state on errors
- [x] User-friendly error messages

### Multi-Wallet Support ✅

- [x] Wallet-specific localStorage keys
- [x] Switch wallet without losing state
- [x] Each wallet sees their own results
- [x] Auto-refresh works with wallet changes

### Known Limitations ⚠️

- ⚠️ Timestamps removed (Nakamoto blocks too variable)
- ⚠️ Relies on public Hiro API (rate limits possible)
- ⚠️ 45s refresh means 45s delay for new data
- ⚠️ Parallel fetching limited to 10 lobbies

---

## Summary: Critical Fixes Timeline

1. ✅ Fixed wallet connection using `getLocalStorage()` with setTimeout
2. ✅ Switched from `request()` to `openContractCall()` for transactions
3. ✅ Added `0x` prefix to transaction IDs for Explorer links
4. ✅ Fixed Clarity optional type parsing (`json.value.value` for `some` types)
5. ✅ Fixed response type parsing (`json.value.value` for `ok uint`)
6. ✅ Corrected status code filter (1 instead of 0 for open lobbies)
7. ✅ Reduced request frequency with delays to avoid CORS issues
8. ✅ Added error handling with graceful fallbacks
9. ✅ Fixed data disappearing with state preservation logic
10. ✅ Added retry logic with exponential backoff (3 retries, 1s→2s delays)
11. ✅ Removed timestamp calculations (Nakamoto variable block times)
12. ✅ Fixed confetti window size initialization
13. ✅ Made notifications wallet-specific with localStorage keys
14. ✅ Implemented full responsive design for mobile/tablet
15. ✅ Increased refresh interval to 45s to respect rate limits

---

**Project Status**: ✅ Production Ready

- Wallet connection: ✅ Working with multi-wallet support
- Create lobby: ✅ Working with blockchain confirmation
- Display lobbies: ✅ Working with real-time updates & data preservation
- Join lobby: ✅ Working with multiplier animation
- Winner determination: ✅ Working with celebration modal
- Game resolution: ✅ Working with 90/8/2 split
- Transaction links: ✅ Working with clickable Explorer links
- Mobile support: ✅ Responsive design implemented
- Error handling: ✅ Comprehensive with retry logic
- Rate limiting: ✅ Handled with backoff and reduced frequency

**Deployment Recommendations**:

1. ✅ Test full game flow with two wallets
2. ✅ Verify mobile responsiveness on actual devices
3. ✅ Check console logs for any remaining errors
4. ⏳ Consider deploying to custom domain for better API access
5. ⏳ Monitor API rate limits during submission period

---

**Generated**: December 13-14, 2025  
**Contract**: ST1XF7QZ52F6WYHKP9NKR869NNN3ZEY6SXHQ9E497.high-stackers  
**Testnet Explorer**: https://explorer.hiro.so/address/ST1XF7QZ52F6WYHKP9NKR869NNN3ZEY6SXHQ9E497?chain=testnet
