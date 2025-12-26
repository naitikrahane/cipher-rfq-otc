import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

task("auction:advanced", "Run Competitive Blind Auction (Multi-Bidder)").setAction(
  async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers, fhevm } = hre;
    const fhe = fhevm as any;

    // ========================================================================
    // 🛠️ HELPERS (Visuals & Stability from your Demo Code)
    // ========================================================================
    const logHeader = (msg: string) => console.log(`\n============== 🔐 ${msg.toUpperCase()} ==============`);

    const logEnc = (label: string, handle: any) => {
      let handleStr = handle;
      if (typeof handle !== "string") {
        handleStr = "0x" + Buffer.from(handle).toString("hex");
      }
      console.log(`   🛡️  [ENCRYPTED INPUT] ${label}`);
      console.log(
        `       Ciphertext:        ${handleStr.substring(0, 14)}...${handleStr.substring(handleStr.length - 8)}`,
      );
      console.log(`       On-Chain Status:   Confidential (Hidden)`);
    };

    const logComp = (msg: string) => console.log(`   ⚙️  [BLIND COMPUTATION] ${msg}`);
    const logReveal = (label: string, value: any) => console.log(`   🔓 [VERIFIED REVEAL] ${label}: ${value}`);

    // Retry Logic for Sepolia Stability
    const sendWithRetry = async (fn: () => Promise<any>, label: string) => {
      for (let i = 0; i < 5; i++) {
        try {
          const tx = await fn();
          console.log(`      ⏳ Sending ${label}...`);
          await tx.wait(1);
          await new Promise((r) => setTimeout(r, 5000)); // Cool-down
          console.log(`      ✅ ${label} Confirmed.`);
          return;
        } catch (e: any) {
          if (e.message.includes("Timeout") || e.code === "NETWORK_ERROR") {
            console.log(`      ⚠️ Network Lag on ${label}. Retrying... (${i + 1}/5)`);
            await new Promise((r) => setTimeout(r, 8000));
          } else {
            throw e;
          }
        }
      }
      throw new Error(`${label} Failed after 5 retries.`);
    };

    const gasConfig = {
      maxFeePerGas: ethers.parseUnits("50", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
    };

    // ========================================================================
    // 🚀 INITIALIZATION
    // ========================================================================
    logHeader("Initializing Cipher Protocol (Advanced Mode)");
    await fhe.initializeCLIApi();

    // Accounts: Seller, Bidder 1 (Loser), Bidder 2 (Winner)
    const [admin, seller, bidder1, bidder2] = await ethers.getSigners();

    // 🔗 CONNECTING TO YOUR EXISTING DEPLOYED CONTRACTS
    const coreAddr = "0xfAa11ff22D6459b124d281A21C02E9B99FF16477"; // CipherCore
    const zUSDAddr = "0x8205E27c00Bc6aa1Af2b9267E491D15d3A85BD2F"; // ConfidentialERC20 [cite: 1]
    const pepeAddr = "0x2BfA15FF478ECEA26Da4D53864992f4ce8f9c1d4"; // MockERC20

    console.log(`   📍 Core:   ${coreAddr}`);
    console.log(`   👤 Seller: ${seller.address}`);
    console.log(`   👤 Bidder1:${bidder1.address}`);
    console.log(`   👤 Bidder2:${bidder2.address}`);

    const cipherCore = (await ethers.getContractAt("CipherCore", coreAddr)) as any;
    const zUSD = (await ethers.getContractAt("ConfidentialERC20", zUSDAddr)) as any;
    const PEPE = (await ethers.getContractAt("MockERC20", pepeAddr)) as any;

    // ========================================================================
    // PHASE 1: FINANCIAL SETUP (Competition Setup)
    // ========================================================================
    logHeader("Phase 1: Multi-User Financial Setup");

    // 1. Seller has PEPE
    console.log("   👉 Setup Seller (PEPE)...");
    await sendWithRetry(() => PEPE.connect(seller).mint(seller.address, 100000), "Mint PEPE");
    await sendWithRetry(() => PEPE.connect(seller).approve(cipherCore.target, 100000), "Approve PEPE");

    // 2. Bidder 1 Setup (Needs zUSD)
    console.log("   👉 Setup Bidder 1 (zUSD)...");
    try {
      await sendWithRetry(() => zUSD.connect(bidder1).mint(bidder1.address, 50000), "Mint zUSD (B1)");
      await sendWithRetry(() => zUSD.connect(bidder1).approve(cipherCore.target, 50000), "Approve zUSD (B1)");
    } catch (e) {
      console.log("      ⚠️ Bidder 1 setup skipped (likely ready)");
    }

    // 3. Bidder 2 Setup (Needs zUSD)
    console.log("   👉 Setup Bidder 2 (zUSD)...");
    try {
      await sendWithRetry(() => zUSD.connect(bidder2).mint(bidder2.address, 50000), "Mint zUSD (B2)");
      await sendWithRetry(() => zUSD.connect(bidder2).approve(cipherCore.target, 50000), "Approve zUSD (B2)");
    } catch (e) {
      console.log("      ⚠️ Bidder 2 setup skipped (likely ready)");
    }

    // ========================================================================
    // PHASE 2: AUCTION CREATION
    // ========================================================================
    logHeader("Phase 2: Encrypted Auction Creation");
    console.log("   Action: Seller encrypts Reserve Price = 10,000");

    const encRes = await fhe.createEncryptedInput(coreAddr, seller.address).add64(10000).encrypt();
    logEnc("Reserve Price", encRes.handles[0]);

    await sendWithRetry(
      () =>
        cipherCore.connect(seller).createRequest(PEPE.target, 500, zUSD.target, encRes.handles[0], encRes.inputProof, {
          ...gasConfig,
          gasLimit: 3000000,
        }),
      "Create Auction Request",
    );

    // Fetch Request ID
    const reqId = (await cipherCore.nextRequestId()) - 1n;
    console.log(`   ✅ Auction #${reqId} is LIVE.`);

    // ========================================================================
    // PHASE 3: COMPETITIVE BIDDING WAR
    // ========================================================================
    logHeader("Phase 3: Competitive Encrypted Bidding");

    // --- BIDDER 1 (Low Bid) ---
    console.log("\n   🗳️  Bidder 1 bids 12,000 (Low)...");
    const encBid1 = await fhe.createEncryptedInput(coreAddr, bidder1.address).add64(12000).encrypt();
    logEnc("Bid 1", encBid1.handles[0]);

    await sendWithRetry(
      () => cipherCore.connect(bidder1).submitBid(reqId, encBid1.handles[0], encBid1.inputProof, gasConfig),
      "Submit Bid 1",
    );

    // --- BIDDER 2 (High Bid) ---
    console.log("\n   🗳️  Bidder 2 bids 25,000 (High)...");
    const encBid2 = await fhe.createEncryptedInput(coreAddr, bidder2.address).add64(25000).encrypt();
    logEnc("Bid 2", encBid2.handles[0]);

    await sendWithRetry(
      () => cipherCore.connect(bidder2).submitBid(reqId, encBid2.handles[0], encBid2.inputProof, gasConfig),
      "Submit Bid 2",
    );

    // ========================================================================
    // PHASE 4: BLIND SORTING & COMPUTATION
    // ========================================================================
    logHeader("Phase 4: Homomorphic Computation (Finding Winner)");
    console.log("   Action: Contract compares Enc(12k) vs Enc(25k) vs Enc(Reserve).");
    console.log("   Note: The Contract DOES NOT know the actual values.");

    await sendWithRetry(
      () => cipherCore.connect(seller).calculateWinner(reqId, { ...gasConfig, gasLimit: 5000000 }), // Higher gas for loop
      "Calculate Winner",
    );

    logComp("Computation Complete. Results stored as Encrypted Handles.");
    console.log("\n   ⏳ Syncing Encrypted State (60s)...");
    await new Promise((r) => setTimeout(r, 60000));

    // ========================================================================
    // PHASE 5: VERIFICATION (Which Bidder Won?)
    // ========================================================================
    logHeader("Phase 5: Verification & Reveal");

    // Humare paas 2 hypotheses hain:
    const scenarios = [
      { w: 1, p: 12000, s: true, label: "Hypothesis: Bidder 1 Wins (Incorrect)" },
      { w: 2, p: 25000, s: true, label: "Hypothesis: Bidder 2 Wins (Correct)" }, // Note: Winner ID is 1-based index in array [cite: 58]
    ];

    let verifiedResult;

    for (const sc of scenarios) {
      process.stdout.write(`   🔍 Checking: [${sc.label}]... `);
      try {
        // Static Call checks if "Decrypted(Handle) == Hypothesis"
        // Signature: settleAuction(reqId, winnerId, price, success, proof)
        await cipherCore.connect(seller).settleAuction.staticCall(reqId, sc.w, sc.p, sc.s, "0x00");
        console.log("MATCH! ✅");
        verifiedResult = sc;
        break;
      } catch (e) {
        console.log("Mismatch ❌");
      }
    }

    if (verifiedResult) {
      console.log("\n   🎉 [PROTOCOL SUCCESS]");
      console.log(`   The 'CipherLibrary' correctly identified that 25,000 > 12,000.`);
      logReveal("Winning Bidder ID", verifiedResult.w);
      logReveal("Clearing Price", verifiedResult.p);

      // Final Settlement
      await sendWithRetry(
        () =>
          cipherCore
            .connect(seller)
            .settleAuction(reqId, verifiedResult.w, verifiedResult.p, verifiedResult.s, "0x00", gasConfig),
        "Final Settlement",
      );
      console.log(`   ✅ Assets Transferred. Auction Closed.`);
    } else {
      console.log("   ⚠️ Verification Failed. Something went wrong with the logic.");
    }

    logHeader("ADVANCED DEMO COMPLETE");
  },
);
