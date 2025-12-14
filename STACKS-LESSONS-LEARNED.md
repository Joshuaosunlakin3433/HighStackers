# Stacks Development: Lessons Learned & Troubleshooting Guide

**Project**: Automated Market Maker (AMM) DEX  
**Stack**: Next.js 16, React 19, Stacks.js, Clarity Smart Contracts  
**Date**: December 2025  
**Developer**: Joshua Osunlakin

---

## Table of Contents

1. [Smart Contract Integration Issues](#smart-contract-integration-issues)
2. [Stacks.js API Problems & Solutions](#stacksjs-api-problems--solutions)
3. [Transaction Flow & Error Handling](#transaction-flow--error-handling)
4. [Explorer Integration Issues](#explorer-integration-issues)
5. [State Management Challenges](#state-management-challenges)
6. [Network Configuration](#network-configuration)
7. [Best Practices Discovered](#best-practices-discovered)
8. [Common Pitfalls to Avoid](#common-pitfalls-to-avoid)

---

## Smart Contract Integration Issues

### Issue 1: Contract Deployment vs. Frontend Development

**Problem**: Initially confused about whether contracts needed to be deployed to testnet for frontend development.

**What We Learned**:
- You can build the entire frontend WITHOUT deploying contracts to testnet
- Clarinet provides local testing with `clarinet check` and `clarinet test`
- Frontend can connect to Stacks wallets (Hiro/Leather) for authentication without deployed contracts
- Transaction buttons can be implemented with UI/UX patterns even if backend isn't deployed yet

**Resolution**:
```typescript
// Frontend connects to wallet for authentication
import { AppConfig, UserSession, showConnect } from '@stacks/connect';

const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

// This works WITHOUT deployed contracts - just wallet connection
const connectWallet = () => {
  showConnect({
    appDetails: {
      name: 'Your AMM DEX',
      icon: window.location.origin + '/logo.png',
    },
    onFinish: () => {
      window.location.reload();
    },
    userSession,
  });
};
```

### Issue 2: Contract Function Calls Structure

**Problem**: Understanding how to properly structure contract calls with Stacks.js.

**What We Learned**:
- Contract calls require specific `PostConditionMode` settings
- Function arguments must match exact Clarity types (uint, principal, etc.)
- Need to wrap contract calls in try-catch with proper error handling

**Resolution**:
```typescript
import { openContractCall } from '@stacks/connect';
import { PostConditionMode, uintCV, principalCV } from '@stacks/transactions';
import { StacksTestnet } from '@stacks/network';

const handleSwap = async (tokenIn: string, tokenOut: string, amountIn: number) => {
  try {
    await openContractCall({
      network: new StacksTestnet(),
      contractAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      contractName: 'amm',
      functionName: 'swap',
      functionArgs: [
        principalCV(tokenIn),
        principalCV(tokenOut),
        uintCV(amountIn),
      ],
      postConditionMode: PostConditionMode.Allow, // Use 'Deny' in production
      onFinish: (data) => {
        console.log('Transaction ID:', data.txId);
      },
    });
  } catch (error) {
    console.error('Swap failed:', error);
  }
};
```

---

## Stacks.js API Problems & Solutions

### Issue 3: Getting User Data/Address

**Problem**: User address and authentication state wasn't persisting across page reloads.

**What We Learned**:
- `userSession.loadUserData()` must be called on app mount
- Need to check `userSession.isUserSignedIn()` before accessing user data
- User data includes `profile.stxAddress.testnet` and `profile.stxAddress.mainnet`

**Resolution**:
```typescript
// Create a WalletInitializer component
'use client';
import { useEffect } from 'react';
import { useWalletStore } from '@/store/wallet-store';

export default function WalletInitializer() {
  const loadUserData = useWalletStore((state) => state.loadUserData);

  useEffect(() => {
    loadUserData(); // Restores session on mount
  }, [loadUserData]);

  return null; // No UI, just lifecycle logic
}

// In your store:
const loadUserData = () => {
  if (userSession.isUserSignedIn()) {
    const userData = userSession.loadUserData();
    set({
      userData,
      isAuthenticated: true,
    });
  }
};
```

### Issue 4: Transaction Status Tracking

**Problem**: After calling contract function, no way to track if transaction succeeded or failed.

**What We Learned**:
- `onFinish` callback only gives you `txId`, not final status
- Transactions take time to confirm on blockchain (30-60 seconds on testnet)
- Need to poll transaction status or link to Explorer for user to check

**Resolution**:
```typescript
// Option 1: Link to Explorer (easier, what we used)
const showSuccessToast = (txId: string, message: string) => {
  toast.custom((t) => (
    <div className="bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg">
      <p className="font-semibold">{message}</p>
      <button
        onClick={() => {
          window.open(
            `https://explorer.hiro.so/txid/0x${txId}?chain=testnet`,
            '_blank'
          );
          toast.dismiss(t.id);
        }}
        className="mt-2 underline text-sm"
      >
        View on Explorer →
      </button>
    </div>
  ));
};

// Option 2: Poll transaction status (more complex)
import { TransactionsApi } from '@stacks/blockchain-api-client';

const checkTransactionStatus = async (txId: string) => {
  const api = new TransactionsApi();
  const tx = await api.getTransactionById({ txId: `0x${txId}` });
  return tx.tx_status; // 'pending', 'success', 'failed'
};
```

### Issue 5: Network Configuration Confusion

**Problem**: Transactions failing silently, unclear which network (mainnet/testnet) was being used.

**What We Learned**:
- **ALWAYS** explicitly specify network in contract calls
- Testnet uses `new StacksTestnet()`
- Mainnet uses `new StacksMainnet()`
- User's wallet might be on different network than your app

**Resolution**:
```typescript
import { StacksTestnet, StacksMainnet } from '@stacks/network';

// Define network constant at top of file
const NETWORK = new StacksTestnet(); // or StacksMainnet for production

// Use in all contract calls
await openContractCall({
  network: NETWORK, // Explicit network
  contractAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  // ... rest of config
});
```

---

## Transaction Flow & Error Handling

### Issue 6: No Loading States During Transactions

**Problem**: Buttons were clickable multiple times during pending transactions, causing confusion and potential double-spends.

**What We Learned**:
- Need centralized `isLoading` state to disable all action buttons
- Transactions are asynchronous and take time
- Use `try/catch/finally` pattern for cleanup

**Resolution**:
```typescript
// In Zustand store
const handleSwap = async (tokenIn: string, tokenOut: string, amount: number) => {
  set({ isLoading: true }); // Disable all buttons

  try {
    await openContractCall({
      // ... contract call config
      onFinish: (data) => {
        showSuccessToast(data.txId, 'Swap initiated!');
      },
    });
  } catch (error) {
    showErrorToast('Swap failed. Please try again.');
    console.error(error);
  } finally {
    set({ isLoading: false }); // Re-enable buttons ALWAYS runs
  }
};

// In component
const isLoading = useWalletStore((state) => state.isLoading);

<button
  onClick={() => handleSwap(tokenA, tokenB, 100)}
  disabled={isLoading} // Disabled during any transaction
>
  {isLoading ? 'Processing...' : 'Swap'}
</button>
```

**Why `finally` is Better Than Just `catch`**:
- `finally` block **always** executes, even if error is thrown
- Ensures loading state is reset even if unexpected errors occur
- Prevents UI from getting stuck in loading state

### Issue 7: User Rejecting Transactions

**Problem**: When user clicks "Cancel" in wallet popup, app didn't handle it gracefully.

**What We Learned**:
- User cancellation throws an error
- Need to differentiate between user rejection and actual failures
- Don't show error toast for user cancellations (expected behavior)

**Resolution**:
```typescript
try {
  await openContractCall({
    // ... config
    onCancel: () => {
      console.log('User cancelled transaction');
      // Don't show error toast here
    },
    onFinish: (data) => {
      showSuccessToast(data.txId, 'Transaction submitted!');
    },
  });
} catch (error) {
  // Only show error for actual failures, not cancellations
  if (error.message && !error.message.includes('cancel')) {
    showErrorToast('Transaction failed');
  }
} finally {
  set({ isLoading: false });
}
```

---

## Explorer Integration Issues

### Issue 8: Stacks Explorer Links Not Working

**Problem**: Explorer links opened to blank pages, transactions not found.

**Root Cause**: Missing `0x` prefix on transaction IDs.

**What We Learned**:
- Stacks transaction IDs are hexadecimal strings
- Explorer expects format: `txid/0x[TXID]`
- `onFinish` callback returns txId **without** `0x` prefix

**Resolution**:
```typescript
// WRONG ❌
window.open(`https://explorer.hiro.so/txid/${txId}?chain=testnet`);

// CORRECT ✅
window.open(`https://explorer.hiro.so/txid/0x${txId}?chain=testnet`);

// Helper function we created
const showSuccessToast = (txId: string, message: string) => {
  toast.custom((t) => (
    <div>
      <p>{message}</p>
      <button
        onClick={() => {
          window.open(
            `https://explorer.hiro.so/txid/0x${txId}?chain=testnet`, // Note 0x prefix
            '_blank'
          );
          toast.dismiss(t.id);
        }}
      >
        View on Explorer →
      </button>
    </div>
  ));
};
```

### Issue 9: Wrong Network in Explorer Links

**Problem**: Opening mainnet explorer for testnet transactions.

**Resolution**:
```typescript
// Always include ?chain=testnet or ?chain=mainnet query parameter
const EXPLORER_BASE = 'https://explorer.hiro.so';
const CHAIN = 'testnet'; // or 'mainnet'

const getExplorerUrl = (txId: string) => {
  return `${EXPLORER_BASE}/txid/0x${txId}?chain=${CHAIN}`;
};
```

---

## State Management Challenges

### Issue 10: Props Drilling for Wallet State

**Problem**: Initially passed wallet connection/transaction handlers through 5+ component levels.

**What We Learned**:
- Use global state management (Zustand) for wallet state
- Avoid creating separate instances with hooks (each component gets own copy)
- Use selector pattern for performance optimization

**Resolution**:
```typescript
// BEFORE (Props Drilling) ❌
<Navbar connectWallet={connectWallet} address={address} />
<SwapComponent handleSwap={handleSwap} isLoading={isLoading} />

// AFTER (Zustand Store) ✅
// store/wallet-store.ts
import { create } from 'zustand';

interface WalletState {
  userData: any;
  isLoading: boolean;
  connectWallet: () => void;
  handleSwap: (tokenIn: string, tokenOut: string, amount: number) => Promise<void>;
  // ... other functions
}

export const useWalletStore = create<WalletState>((set, get) => ({
  userData: null,
  isLoading: false,
  
  connectWallet: () => {
    // Implementation
  },
  
  handleSwap: async (tokenIn, tokenOut, amount) => {
    // Implementation
  },
}));

// In components (optimized selectors)
const handleSwap = useWalletStore((state) => state.handleSwap);
const isLoading = useWalletStore((state) => state.isLoading);
```

### Issue 11: Selector Pattern for Performance

**Problem**: Components re-rendering unnecessarily when unrelated wallet state changed.

**What We Learned**:
- Destructuring entire store causes re-renders on any state change
- Use selector pattern to subscribe to specific values only
- Selector function parameter can be named anything (convention is `state`)

**Resolution**:
```typescript
// BAD (causes unnecessary re-renders) ❌
const { handleSwap, isLoading, userData } = useWalletStore();

// GOOD (only re-renders when isLoading changes) ✅
const isLoading = useWalletStore((state) => state.isLoading);
const handleSwap = useWalletStore((state) => state.handleSwap);

// Functions don't cause re-renders (stable references)
// Only subscribe to primitive values you need for rendering
```

---

## Network Configuration

### Issue 12: Testnet STX Faucet

**Problem**: Couldn't test transactions without testnet STX.

**Solution**:
```
Testnet Faucet: https://explorer.hiro.so/sandbox/faucet?chain=testnet
- Paste your testnet address
- Request 500 STX (free)
- Wait 2-3 minutes for confirmation
```

### Issue 13: RPC Endpoint Configuration

**What We Learned**:
```typescript
// Testnet API endpoint (for reading blockchain data)
const TESTNET_API = 'https://api.testnet.hiro.so';

// Mainnet API endpoint
const MAINNET_API = 'https://api.hiro.so';

// Use in contract calls
const NETWORK = new StacksTestnet({ url: TESTNET_API });
```

---

## Best Practices Discovered

### 1. Toast Notifications for UX

**Implementation**:
```typescript
import toast from 'react-hot-toast';

// Three specialized helpers we created
export const showSuccessToast = (txId: string, message: string) => {
  toast.custom((t) => (
    <div className="bg-green-500 text-white px-6 py-4 rounded-lg">
      <p>{message}</p>
      <button onClick={() => window.open(`https://explorer.hiro.so/txid/0x${txId}?chain=testnet`, '_blank')}>
        View on Explorer →
      </button>
    </div>
  ));
};

export const showErrorToast = (message: string) => {
  toast.error(message, { duration: 4000 });
};

export const showLoadingToast = (message: string) => {
  return toast.loading(message); // Returns ID for dismissal
};
```

### 2. Skeleton Loading States

**Implementation**:
```tsx
// app/loading.tsx (Next.js automatically shows this during page load)
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-8 bg-gray-200 rounded animate-pulse" />
      <div className="h-64 bg-gray-200 rounded animate-pulse" />
    </div>
  );
}
```

### 3. Session Restoration Pattern

**Implementation**:
```tsx
// components/wallet-initializer.tsx
'use client';
import { useEffect } from 'react';
import { useWalletStore } from '@/store/wallet-store';

export default function WalletInitializer() {
  const loadUserData = useWalletStore((state) => state.loadUserData);

  useEffect(() => {
    loadUserData(); // Check if user is already signed in
  }, [loadUserData]);

  return null; // No UI
}

// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <WalletInitializer /> {/* Restores wallet session */}
        {children}
      </body>
    </html>
  );
}
```

### 4. TypeScript Types for Clarity Values

**Implementation**:
```typescript
import { ClarityValue, uintCV, principalCV, bufferCV } from '@stacks/transactions';

// Helper to convert JS values to Clarity values
const toClarityValue = (value: any, type: 'uint' | 'principal' | 'buffer'): ClarityValue => {
  switch (type) {
    case 'uint':
      return uintCV(value);
    case 'principal':
      return principalCV(value);
    case 'buffer':
      return bufferCV(Buffer.from(value));
    default:
      throw new Error(`Unsupported type: ${type}`);
  }
};
```

---

## Common Pitfalls to Avoid

### ❌ Pitfall 1: Not Checking Contract Validity Before Deploying
```powershell
# Always run this first
clarinet check
```

### ❌ Pitfall 2: Forgetting PostConditionMode
```typescript
// Will fail on mainnet without proper post-conditions
await openContractCall({
  postConditionMode: PostConditionMode.Allow, // For testing only
  // Use PostConditionMode.Deny + proper conditions in production
});
```

### ❌ Pitfall 3: Hardcoding Contract Addresses
```typescript
// BAD ❌
const CONTRACT_ADDRESS = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';

// GOOD ✅
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
```

### ❌ Pitfall 4: Not Handling Async Errors
```typescript
// BAD ❌
const handleSwap = async () => {
  await openContractCall({ /* ... */ }); // Unhandled promise rejection
};

// GOOD ✅
const handleSwap = async () => {
  try {
    await openContractCall({ /* ... */ });
  } catch (error) {
    console.error('Error:', error);
    showErrorToast('Transaction failed');
  }
};
```

### ❌ Pitfall 5: Mixing Testnet and Mainnet
```typescript
// Ensure consistency across your app
const NETWORK = new StacksTestnet(); // Use same network everywhere
const EXPLORER_CHAIN = 'testnet'; // Match network
const API_URL = 'https://api.testnet.hiro.so'; // Match network
```

---

## Deployment Checklist

### For Smart Contracts (Clarity):
1. ✅ Run `clarinet check` to validate syntax
2. ✅ Run `clarinet test` to run unit tests
3. ✅ Ensure deployer account has testnet STX
4. ✅ Generate deployment plan: `clarinet deployments generate --testnet`
5. ✅ Review `deployments/default.testnet-plan.yaml`
6. ✅ Deploy: `clarinet deployments apply --testnet`
7. ✅ Verify on Explorer: `https://explorer.hiro.so/address/[CONTRACT_ADDRESS]?chain=testnet`

### For Frontend (Next.js):
1. ✅ Set environment variables in `.env.local`
2. ✅ Build locally: `npm run build`
3. ✅ Check for TypeScript errors
4. ✅ Deploy to Vercel (or your hosting platform)
5. ✅ Update contract addresses to deployed testnet/mainnet addresses
6. ✅ Test wallet connection on production URL

---

## Key Stacks.js Packages

```json
{
  "@stacks/connect": "^8.0.0",      // Wallet connection
  "@stacks/transactions": "^7.0.0", // Contract calls, CV types
  "@stacks/network": "^7.0.0",      // Network config
  "@stacks/blockchain-api-client": "^8.0.0" // Read blockchain data
}
```

---

## Debugging Commands

```powershell
# Validate contracts
clarinet check

# Run tests
clarinet test

# Check testnet balance
# Visit: https://explorer.hiro.so/address/[YOUR_ADDRESS]?chain=testnet

# Check transaction status
# Visit: https://explorer.hiro.so/txid/0x[TX_ID]?chain=testnet

# Generate deployment plan
clarinet deployments generate --testnet

# View deployment plan
cat deployments/default.testnet-plan.yaml
```

---

## Resources

- **Stacks Docs**: https://docs.stacks.co/
- **Clarity Language**: https://book.clarity-lang.org/
- **Stacks.js Docs**: https://stacks.js.org/
- **Hiro Platform**: https://www.hiro.so/
- **Testnet Explorer**: https://explorer.hiro.so/?chain=testnet
- **Testnet Faucet**: https://explorer.hiro.so/sandbox/faucet?chain=testnet

---

## Summary: Most Critical Lessons

1. **0x Prefix**: Always add `0x` to transaction IDs for Explorer links
2. **Finally Block**: Use `try/catch/finally` for transaction state cleanup
3. **Network Consistency**: Explicitly specify network in all contract calls
4. **Zustand Selectors**: Use selector pattern for performance optimization
5. **Session Restoration**: Call `loadUserData()` on app mount
6. **Loading States**: Centralize `isLoading` to prevent double-clicks
7. **Toast Notifications**: Provide clear feedback with clickable Explorer links
8. **Error Handling**: Differentiate between user cancellations and failures
9. **Local Development**: Can build full frontend without deploying contracts
10. **Testnet STX**: Get free testnet STX from faucet before testing transactions

---

**Generated**: December 12, 2025  
**Project**: Automated Market Maker AMM/DEX  
**Author**: Joshua Osunlakin  
**Repository**: https://github.com/Joshuaosunlakin3433/Automated-Market-Maker

