import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  makeContractDeploy,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
} from "@stacks/transactions";
import { StacksTestnet } from "@stacks/network";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read mnemonic from Testnet.toml
const tomlContent = fs.readFileSync(
  path.join(__dirname, "settings", "Testnet.toml"),
  "utf8"
);
const mnemonicMatch = tomlContent.match(/mnemonic = "([^"]+)"/);

if (!mnemonicMatch) {
  console.error("❌ Could not find mnemonic in settings/Testnet.toml");
  process.exit(1);
}

const mnemonic = mnemonicMatch[1];

// Read contract
const contractPath = path.join(__dirname, "contracts", "high-stackers.clar");
const contractCode = fs.readFileSync(contractPath, "utf8");

console.log("🚀 HighStackers Testnet Deployment\n");
console.log("📋 Contract:", contractPath);
console.log("📏 Size:", contractCode.length, "bytes");
console.log("🌐 Network: Stacks Testnet\n");

async function deploy() {
  try {
    const network = new StacksTestnet();

    // You'll need to derive the private key from mnemonic
    // For now, let's show what needs to happen
    console.log("⚠️  To complete deployment, you need to:");
    console.log("\n1. Derive private key from your mnemonic");
    console.log("2. Use makeContractDeploy() with your key");
    console.log("3. Or use Platform: https://platform.hiro.so/\n");

    console.log("📝 Your contract is ready. Use one of these methods:");
    console.log("\nMETHOD 1: Platform (Easiest)");
    console.log("  → https://platform.hiro.so/");
    console.log("  → Upload contracts/high-stackers.clar");
    console.log("  → Click Deploy to Testnet\n");

    console.log("METHOD 2: Stacks Explorer");
    console.log("  → https://explorer.hiro.so/sandbox/deploy?chain=testnet");
    console.log("  → Paste contract code");
    console.log("  → Connect wallet and deploy\n");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

deploy();
