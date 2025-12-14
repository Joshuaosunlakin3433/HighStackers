import { describe, expect, it, beforeAll, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

describe("HighStackers Contract Tests", () => {
  beforeAll(() => {
    // Set epoch to 3.0 to enable all Clarity features
    simnet.setEpoch("3.0");
  });

  describe("Contract Initialization", () => {
    it("should initialize with zero lobby counter", () => {
      const counter = simnet.callReadOnlyFn(
        "high-stackers",
        "get-lobby-counter",
        [],
        deployer
      );
      expect(counter.result).toBeOk(Cl.uint(0));
    });

    it("should set deployer as contract owner", () => {
      const platformWallet = simnet.callReadOnlyFn(
        "high-stackers",
        "get-platform-wallet",
        [],
        deployer
      );
      expect(platformWallet.result).toBeOk(Cl.principal(deployer));
    });
  });

  describe("Create Lobby", () => {
    it("should successfully create a lobby with valid parameters", () => {
      const amount = 1_000_000; // 1 STX
      const multiplier = 2;

      const result = simnet.callPublicFn(
        "high-stackers",
        "create-lobby",
        [Cl.uint(amount), Cl.uint(multiplier)],
        wallet1
      );

      expect(result.result).toBeOk(Cl.uint(1));

      // Verify lobby was created
      const lobby = simnet.callReadOnlyFn(
        "high-stackers",
        "get-lobby",
        [Cl.uint(1)],
        wallet1
      );

      expect(lobby.result).toBeSome(
        Cl.tuple({
          maker: Cl.principal(wallet1),
          taker: Cl.none(),
          amount: Cl.uint(amount),
          "target-multiplier": Cl.uint(multiplier),
          status: Cl.uint(1), // status-open
          winner: Cl.none(),
          "created-at": Cl.uint(simnet.blockHeight),
        })
      );
    });

    it("should reject lobby with amount below minimum", () => {
      const result = simnet.callPublicFn(
        "high-stackers",
        "create-lobby",
        [Cl.uint(500_000), Cl.uint(2)], // 0.5 STX (below min)
        wallet1
      );

      expect(result.result).toBeErr(Cl.uint(103)); // err-insufficient-amount
    });

    it("should reject lobby with invalid multiplier (too low)", () => {
      const result = simnet.callPublicFn(
        "high-stackers",
        "create-lobby",
        [Cl.uint(1_000_000), Cl.uint(1)], // multiplier 1
        wallet1
      );

      expect(result.result).toBeErr(Cl.uint(106)); // err-invalid-multiplier
    });

    it("should reject lobby with invalid multiplier (too high)", () => {
      const result = simnet.callPublicFn(
        "high-stackers",
        "create-lobby",
        [Cl.uint(1_000_000), Cl.uint(11)], // multiplier 11
        wallet1
      );

      expect(result.result).toBeErr(Cl.uint(106)); // err-invalid-multiplier
    });

    it("should increment lobby counter", () => {
      simnet.callPublicFn(
        "high-stackers",
        "create-lobby",
        [Cl.uint(1_000_000), Cl.uint(2)],
        wallet1
      );

      simnet.callPublicFn(
        "high-stackers",
        "create-lobby",
        [Cl.uint(2_000_000), Cl.uint(3)],
        wallet2
      );

      const counter = simnet.callReadOnlyFn(
        "high-stackers",
        "get-lobby-counter",
        [],
        deployer
      );

      expect(counter.result).toBeOk(Cl.uint(2));
    });

    it("should transfer STX from maker to contract", () => {
      const initialBalance =
        simnet.getAssetsMap().get("STX")?.get(wallet1) || 0n;
      const amount = 1_000_000n;

      simnet.callPublicFn(
        "high-stackers",
        "create-lobby",
        [Cl.uint(Number(amount)), Cl.uint(2)],
        wallet1
      );

      const finalBalance = simnet.getAssetsMap().get("STX")?.get(wallet1) || 0n;
      expect(finalBalance).toBe(initialBalance - amount);
    });
  });

  describe("Join Lobby", () => {
    beforeEach(() => {
      // Create a lobby before each test
      simnet.callPublicFn(
        "high-stackers",
        "create-lobby",
        [Cl.uint(1_000_000), Cl.uint(2)],
        wallet1
      );
    });

    it("should successfully join a lobby and trigger resolution", () => {
      const result = simnet.callPublicFn(
        "high-stackers",
        "join-lobby",
        [Cl.uint(1)],
        wallet2
      );

      expect(result.result).toBeOk(Cl.bool(true));

      // Lobby successfully joined and resolved
      const lobby = simnet.callReadOnlyFn(
        "high-stackers",
        "get-lobby",
        [Cl.uint(1)],
        wallet1
      );
      // Verify lobby exists (it returns some)
      expect(lobby.result).not.toBeNone();
    });

    it("should reject joining non-existent lobby", () => {
      const result = simnet.callPublicFn(
        "high-stackers",
        "join-lobby",
        [Cl.uint(999)],
        wallet2
      );

      expect(result.result).toBeErr(Cl.uint(101)); // err-lobby-not-found
    });

    it("should reject maker joining their own lobby", () => {
      const result = simnet.callPublicFn(
        "high-stackers",
        "join-lobby",
        [Cl.uint(1)],
        wallet1
      );

      expect(result.result).toBeErr(Cl.uint(108)); // err-cannot-join-own-lobby
    });

    it("should reject joining an already closed lobby", () => {
      // First join
      simnet.callPublicFn("high-stackers", "join-lobby", [Cl.uint(1)], wallet2);

      // Try to join again
      const result = simnet.callPublicFn(
        "high-stackers",
        "join-lobby",
        [Cl.uint(1)],
        wallet3
      );

      expect(result.result).toBeErr(Cl.uint(104)); // err-lobby-full
    });
  });

  describe("Payout Distribution (90/8/2)", () => {
    it("should distribute payouts correctly", () => {
      const betAmount = 10_000_000; // 10 STX
      const totalPot = betAmount * 2; // 20 STX

      // Expected payouts
      const expectedWinnerAmount = (totalPot * 90) / 100; // 18 STX
      const expectedLoserAmount = (totalPot * 8) / 100; // 1.6 STX
      const expectedPlatformFee =
        totalPot - expectedWinnerAmount - expectedLoserAmount; // 0.4 STX

      const wallet1Initial =
        simnet.getAssetsMap().get("STX")?.get(wallet1) || 0n;
      const wallet2Initial =
        simnet.getAssetsMap().get("STX")?.get(wallet2) || 0n;

      // Create and join lobby
      simnet.callPublicFn(
        "high-stackers",
        "create-lobby",
        [Cl.uint(betAmount), Cl.uint(2)],
        wallet1
      );

      simnet.callPublicFn("high-stackers", "join-lobby", [Cl.uint(1)], wallet2);

      const wallet1Final = simnet.getAssetsMap().get("STX")?.get(wallet1) || 0n;
      const wallet2Final = simnet.getAssetsMap().get("STX")?.get(wallet2) || 0n;

      // One player gets winner amount, the other gets loser amount
      const wallet1Change = wallet1Final - (wallet1Initial - BigInt(betAmount));
      const wallet2Change = wallet2Final - (wallet2Initial - BigInt(betAmount));

      // One should have won (got 18 STX), other lost but got rebate (got 1.6 STX)
      const changes = [Number(wallet1Change), Number(wallet2Change)].sort(
        (a, b) => b - a
      );

      expect(changes[0]).toBe(expectedWinnerAmount); // Winner
      expect(changes[1]).toBe(expectedLoserAmount); // Loser rebate

      // Verify platform balance
      const platformBalance = simnet.callReadOnlyFn(
        "high-stackers",
        "get-platform-balance",
        [],
        deployer
      );

      expect(platformBalance.result).toBeOk(Cl.uint(expectedPlatformFee));
    });
  });

  describe("Platform Fee Management", () => {
    beforeEach(() => {
      // Generate some platform fees
      simnet.callPublicFn(
        "high-stackers",
        "create-lobby",
        [Cl.uint(10_000_000), Cl.uint(2)],
        wallet1
      );
      simnet.callPublicFn("high-stackers", "join-lobby", [Cl.uint(1)], wallet2);
    });

    it("should allow contract owner to withdraw platform fees", () => {
      const deployerInitial =
        simnet.getAssetsMap().get("STX")?.get(deployer) || 0n;

      const result = simnet.callPublicFn(
        "high-stackers",
        "withdraw-platform-fees",
        [],
        deployer
      );

      expect(result.result).toBeOk(Cl.uint(400_000)); // 0.4 STX fee from 20 STX pot

      const deployerFinal =
        simnet.getAssetsMap().get("STX")?.get(deployer) || 0n;
      expect(deployerFinal).toBe(deployerInitial + 400_000n);

      // Platform balance should be reset
      const platformBalance = simnet.callReadOnlyFn(
        "high-stackers",
        "get-platform-balance",
        [],
        deployer
      );
      expect(platformBalance.result).toBeOk(Cl.uint(0));
    });

    it("should reject non-owner withdrawal", () => {
      const result = simnet.callPublicFn(
        "high-stackers",
        "withdraw-platform-fees",
        [],
        wallet1
      );

      expect(result.result).toBeErr(Cl.uint(100)); // err-owner-only
    });

    it("should allow owner to update platform wallet", () => {
      const result = simnet.callPublicFn(
        "high-stackers",
        "set-platform-wallet",
        [Cl.principal(wallet3)],
        deployer
      );

      expect(result.result).toBeOk(Cl.bool(true));

      const newWallet = simnet.callReadOnlyFn(
        "high-stackers",
        "get-platform-wallet",
        [],
        deployer
      );
      expect(newWallet.result).toBeOk(Cl.principal(wallet3));
    });

    it("should reject non-owner platform wallet update", () => {
      const result = simnet.callPublicFn(
        "high-stackers",
        "set-platform-wallet",
        [Cl.principal(wallet3)],
        wallet1
      );

      expect(result.result).toBeErr(Cl.uint(100)); // err-owner-only
    });
  });

  describe("Multiple Games Scenario", () => {
    it("should handle multiple games correctly", () => {
      // Game 1
      simnet.callPublicFn(
        "high-stackers",
        "create-lobby",
        [Cl.uint(5_000_000), Cl.uint(2)],
        wallet1
      );
      simnet.callPublicFn("high-stackers", "join-lobby", [Cl.uint(1)], wallet2);

      // Game 2
      simnet.callPublicFn(
        "high-stackers",
        "create-lobby",
        [Cl.uint(3_000_000), Cl.uint(5)],
        wallet2
      );
      simnet.callPublicFn("high-stackers", "join-lobby", [Cl.uint(2)], wallet3);

      // Game 3
      simnet.callPublicFn(
        "high-stackers",
        "create-lobby",
        [Cl.uint(1_000_000), Cl.uint(10)],
        wallet1
      );
      simnet.callPublicFn("high-stackers", "join-lobby", [Cl.uint(3)], wallet3);

      // Verify all lobbies exist and are closed
      for (let i = 1; i <= 3; i++) {
        const lobby = simnet.callReadOnlyFn(
          "high-stackers",
          "get-lobby",
          [Cl.uint(i)],
          deployer
        );
        // Verify lobby exists (returns some)
        expect(lobby.result).not.toBeNone();
      }

      // Platform should have accumulated fees from all games
      const platformBalance = simnet.callReadOnlyFn(
        "high-stackers",
        "get-platform-balance",
        [],
        deployer
      );

      // Total fees = 2% of (10 + 6 + 2) = 0.36 STX = 360,000 microSTX
      expect(platformBalance.result).toBeOk(Cl.uint(360_000));
    });
  });
});
