**Role & Context:**
You are a Senior Blockchain & Full-Stack Game Developer. We are building "HighStackers," an MVP for a Stacks Blockchain Hackathon due in 4 days.
I have already initialized the project:
- `/backend`: Clarinet project for Stacks smart contracts.
- `/frontend`: Next.js 14 + Tailwind + React Three Fiber (R3F) + Stacks.js.

**The Product: "HighStackers"**
A 3D PvP betting arena where users ("Stackers") challenge each other.
- **Model:** Asynchronous PvP (Maker creates a lobby, Taker joins).
- **Unique Selling Point:** The "Restack Rebate" (Losers get 8% back).
- **Visual Metaphor:** Stacks (L2) running on Bitcoin (L1).

**Design Constraints:**
- **Vibe:** "Industrial Cyberpunk." Deep blacks, Neon Purple (`#7F73FF`), Neon Orange (`#F7931A`).
- **UX:** Organic, tactile buttons (no generic AI gradients).
- **Optimization:** Use Three.js primitive shapes (Spheres, Cylinders) instead of loading external 3D models.

**Operational Rules (Zero Hallucination Protocol):**
1.  **Do NOT guess data:** If you need a Wallet Address, Contract Principal, or API Key, **STOP and ask me** to provide it. Do not generate fake values like `SP3...XYZ` unless explicitly telling me it is a placeholder.
2.  **Verify Documentation:** Do not invent functions for `stacks.js` or `Clarity`. If you are unsure of a specific syntax or library method, ask me to check the documentation or provide the relevant code snippet. Here's a link to clarity functions and the recently added ones in case you need it - https://docs.stacks.co/reference/clarity/functions
3.  **Safe Defaults:** If you must use a placeholder, use clearly marked variables (e.g., `INSERT_WALLET_ADDRESS_HERE`) and add a comment flagging it for my attention.

---

### **Task 1: The Smart Contract (`backend/contracts/high-stackers.clar`)**
Write the Clarity contract.
1.  **The 90/8/2 Logic:**
    - Winner gets **90%**.
    - Loser gets **8%** (Restack Rebate).
    - Platform gets **2%**.
    - *Math Note:* Handle integer division carefully. Send any "dust" (remainder) to the Platform to avoid stuck funds.
2.  **State Maps:** `lobbies` map storing { maker, taker, amount, target-multiplier, status }.
3.  **Functions:** `create-lobby`, `join-lobby` (triggers the random resolution), `get-lobby`.

---

### **Task 2: The 3D Scene (`frontend/components/GameScene.tsx`)**
Build the R3F component.
1.  **Background (Layer 1):** Create a massive, slowly rotating **"Bitcoin Sun"** in the far distance. Use a Wireframe Sphere with intense Emissive Orange color. It represents Bitcoin securing the chain.
2.  **Foreground (Layer 2):**
    - The Floor: An infinite neon grid moving towards the camera.
    - The "Pot": A floating collection of **"Stacks Chips"** (Cylinders) in the center. Use Purple/White materials.
3.  **Animation States:**
    - *Idle:* The Stacks Chips float calmly under the Bitcoin Sun.
    - *Action:* The Chips spin rapidly, and the Sun pulses.
    - *Win:* Chips explode upwards.

---

### **Task 3: The UI Overlay (`frontend/app/page.tsx`)**
1.  **Header:** "HighStackers" text logo + Stacks Connect Wallet button. Here is a link to the docs for the recent way of creating wallet connect hook on stacks https://docs.stacks.co/stacks-connect/connect-wallet
2.  **Layout:**
    - **Left:** "Live Comms" (List of Open Lobbies).
    - **Right:** "Command Deck" (Input Amount, Target, "Deploy Stack" button).
3.  **Footer:** "Low on Ammo? Swap on Bitflow" (Sponsor link).

---

**Immediate Action:**
Start by writing the **`high-stackers.clar` contract** in the backend folder.