
# 🔐 Cipher RFQ & OTC: Privacy-Preserving On-Chain Trading Protocol

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![Framework](https://img.shields.io/badge/framework-Hardhat-yellow.svg) ![Encryption](https://img.shields.io/badge/encryption-TFHE%20(Zama)-green.svg) ![Network](https://img.shields.io/badge/network-Sepolia%20FHEVM-orange.svg) ![Status](https://img.shields.io/badge/status-Alpha-red.svg)

> **"Trading in the Dark, Settling in the Light."**

**Cipher RFQ** is a decentralized, privacy-first **Request for Quote (RFQ)** and **Over-The-Counter (OTC)** trading protocol built on **Zama's FHEVM (Fully Homomorphic Encryption Virtual Machine)**.

It solves the critical problem of information leakage in DeFi (MEV, front-running, strategy exposure) by allowing traders to submit **Encrypted Bids** and **Encrypted Asks** that remain confidential during computation and are only revealed upon settlement.

---

## 📚 Table of Contents

1.  [🌟 Core Concept & Problem Statement](#-core-concept--problem-statement)
2.  [🧮 Mathematical Foundations (FHE)](#-mathematical-foundations-fhe)
    * [Homomorphic Operations](#homomorphic-operations)
    * [TFHE Boolean Logic & Comparators](#tfhe-boolean-logic--comparators)
    * [The MUX (Multiplexer) Algorithm](#the-mux-multiplexer-algorithm)
3.  [🏗 System Architecture](#-system-architecture)
    * [Protocol Flow](#protocol-flow)
    * [Zama FHEVM Integration](#zama-fhevm-integration)
4.  [📂 Repository Structure](#-repository-structure)
5.  [📝 Smart Contract Deep Dive](#-smart-contract-deep-dive)
    * [CipherCore.sol](#ciphercoresol)
    * [CipherStorage.sol](#cipherstoragesol)
    * [CipherLibrary.sol](#cipherlibrarysol)
6.  [⚙️ Installation & Configuration](#-installation--configuration)
7.  [🚀 Deployment Guide](#-deployment-guide)
8.  [🏃 Usage & Demo Tasks](#-usage--demo-tasks)
9.  [🧪 Testing](#-testing)
10. [🛡 Security Considerations](#-security-considerations)

---

## 🌟 Core Concept & Problem Statement

### The Problem: Transparency is a Bug
In traditional AMMs (Uniswap) and Order Book DEXs, all data is public.
* **Front-Running:** MEV bots monitor the mempool, see a large buy order, and buy before it to spike the price.
* **Sandwich Attacks:** Bots buy before you and sell after you, extracting risk-free profit.
* **Information Leakage:** Institutional OTC desks cannot operate on-chain because their large positions would signal the market immediately, causing slippage.

### The Solution: Cipher RFQ
Cipher RFQ utilizes **Fully Homomorphic Encryption (FHE)** to keep state encrypted while allowing the blockchain to validate logic.
1.  **Encrypted State:** Order sizes and reserve prices are stored as `euint64` (encrypted integers) on-chain.
2.  **Blind Computation:** The blockchain validators execute the matching logic (e.g., `Bid > Ask?`) *without decrypting the data*.
3.  **Atomic Settlement:** If a match is found, tokens are swapped. If not, the state remains encrypted.

---

## 🧮 Mathematical Foundations (FHE)

This protocol relies on **TFHE (Torus Fully Homomorphic Encryption)** over the Torus $T = R / Z$. This allows us to perform arithmetic on ciphertexts.

### Terminology

* **`E(x)`**: The encryption of value `x` using the Global FHE Key.
* **`euint64`**: An encrypted unsigned 64-bit integer type used in Solidity.
* **`ebool`**: An encrypted boolean (result of a comparison).
* **`cmux`**: Controlled Multiplexer (The `if/else` of encryption).

### Homomorphic Operations

#### 1. Homomorphic Addition
We operate in a space where operations on ciphertexts map to operations on plaintexts.
$$E(x) \oplus E(y) \approx E(x + y \mod M)$$
*Used in:* Calculating total volume or updating escrow balances without revealing the amount.

#### 2. Homomorphic Comparison (The Core Logic)
In Cipher RFQ, we heavily rely on `Greater Than` (GT) and `Less Than or Equal` (LE) to find the best price.
$$b = \text{TFHE.gt}(E(bid), E(reserve))$$
Where $b$ is an encrypted boolean (`ebool`).
* If $bid > reserve$, then $Decrypt(b) = 1$ (True).
* If $bid \le reserve$, then $Decrypt(b) = 0$ (False).
* *Crucially:* The network computes $b$ without seeing $bid$ or $reserve$.

#### 3. The MUX (Multiplexer) Algorithm
Since we cannot use Solidity `if/else` statements on encrypted data (because the condition is unknown to the CPU), we use **Multiplexers**.

**Mathematical Formula:**
$$Result = b \cdot x + (1 - b) \cdot y$$

**In Zama Solidity SDK (`TFHE.select`):**
```solidity
// If 'condition' is true, return 'trueValue', else return 'falseValue'
euint64 result = TFHE.select(condition, trueValue, falseValue);

```

**Application in CipherCore (Winning Bid Logic):**
We iterate through all bids to find the highest without revealing the losers.

```solidity
// Loop through bids
ebool isHigher = TFHE.gt(newBid, currentHighest);
// If newBid is higher, update currentHighest. Otherwise keep old value.
currentHighest = TFHE.select(isHigher, newBid, currentHighest);
// Also update the winner ID tracking
winningID = TFHE.select(isHigher, currentID, winningID);

```

---

## 🏗 System Architecture

### Protocol Flow

1. **Request Creation (Maker):**
* Maker generates a random salt and encrypts their **Reserve Price** locally using the FHEVM Public Key.
* Maker approves the ERC20 token for the `CipherCore` contract.
* Maker calls `createRequest()` with the encrypted reserve price.
* *State:* `euint64 encryptedReserve` stored on-chain.


2. **Bidding (Taker):**
* Taker views the open request (but cannot see the price).
* Taker encrypts their **Bid Price**.
* Taker calls `submitBid()` with the encrypted bid.
* *State:* `euint64 encryptedBid` added to the request's array.


3. **Resolution (Keeper/Validator):**
* The `resolveAuction()` function is called.
* The contract performs the **Linear Scan** using `TFHE.select`.
* **Verification:** `TFHE.le(reserve, winningBid)` checks if the reserve price was met.
* **Transfer:** If successful, `TFHE.decrypt()` is used strictly on the transfer amount (or re-encrypted for the receiver) to settle the trade.



---

## 📂 Repository Structure

Based on the current codebase:

```text
cipher-rfq-otc/
├── contracts/
│   ├── CipherCore.sol       # 🧠 MAIN LOGIC: Handles auctions, bids, and settlement.
│   ├── CipherStorage.sol    # 💾 STATE: Stores mappings and variables (Upgradeability safe).
│   ├── CipherLibrary.sol    # 📚 LIBS: Wrapper functions for TFHE math operations.
│   ├── FHECounter.sol       # 🔢 EXAMPLE: Simple counter for basic connectivity tests.
│   └── mocks/
│       └── ConfidentialERC20.sol # 🪙 TEST TOKEN: An encrypted ERC20 token for testing.
├── deploy/
│   ├── deployCipherCore.ts  # 🚀 DEPLOY: Script to deploy the main system.
│   └── deployMocks.ts       # 🚀 DEPLOY: Script to deploy test tokens.
├── tasks/
│   ├── demo.ts              # 🎬 E2E DEMO: Runs a full trade scenario (Sell -> Bid -> Win).
│   ├── accounts.ts          # 🛠 UTILS: List available accounts.
│   └── advanced_auction.ts  # 🛠 UTILS: Complex auction logic test.
├── test/
│   └── FHECounter.ts        # 🧪 TEST: Basic unit tests.
├── hardhat.config.ts        # ⚙️ CONFIG: Network settings for Zama Sepolia.
└── .env                     # 🔑 SECRETS: Private keys and API URLs.

```

---

## 📝 Smart Contract Deep Dive

### `CipherCore.sol`

This is the entry point. It inherits storage and uses the library.

* **`createRequest`**:
* *Input:* `tokenToSell`, `amount`, `tokenToBuy`, `encryptedReserve` (`bytes` input).
* *Process:* Converts `bytes` handle to `euint64` using `TFHE.asEuint64(encryptedReserve)`.
* *Storage:* Saves the request ID and meta-data in `CipherStorage`.


* **`submitBid`**:
* *Input:* `requestId`, `encryptedPrice`.
* *Process:* Stores the bid against the Request ID. FHE computation is deferred to resolution to save gas during bidding.


* **`resolveAuction` (The Heavy Lifter)**:
* *Algorithm:* Linear Scan with Encrypted Accumulator.
* It initializes `highestBid = 0`.
* Loops through all bids:
* `isNewHighest = TFHE.gt(bid[i], highestBid)`
* `highestBid = TFHE.select(isNewHighest, bid[i], highestBid)`
* `winnerID = TFHE.select(isNewHighest, bidID[i], winnerID)`


* Finally, checks against reserve: `isSold = TFHE.le(reserve, highestBid)`.
* If `isSold` is true, executes transfer.



### `CipherStorage.sol`

Implements the **Eternal Storage** pattern to allow logic upgrades without losing data.

* `mapping(uint256 => Request)`: Stores main order info.
* `mapping(uint256 => Bid[])`: Stores array of encrypted bids.

### `CipherLibrary.sol`

Abstracts complexity and keeps `CipherCore` clean.

* `function safeGt(euint64 a, euint64 b)`: Returns `ebool`.
* `function decryptAndCheck(euint64 encrypted)`: (Admin only) Debugging tool for DevNet.

---

## ⚙️ Installation & Configuration

### Prerequisites

* Node.js v18+
* npm or yarn
* Git

### 1. Clone the Repository

```bash
git clone [https://github.com/naitikrahane/cipher-rfq-otc.git](https://github.com/naitikrahane/cipher-rfq-otc.git)
cd cipher-rfq-otc

```

### 2. Install Dependencies

```bash
npm install

```

### 3. Environment Setup

Create a `.env` file in the root directory. You can copy the example if it exists.

**hardhat.config Content:**

```fill this in hardhat.config
# Your 12-word seed phrase (Recommended for dev)
MNEMONIC="test test test test test test test test test test test junk"

# OR Your Private Key (If not using mnemonic)
PRIVATE_KEY="0x..."

# Sepolia RPC URL
RPC_URL="rpc/infaura"

# Etherscan API Key (Optional, for verification)
ETHERSCAN_API_KEY="ABC..."

```

---

## 🚀 Deployment Guide

We use Hardhat scripts to ensure consistent deployment.

### 1. Compile Contracts

Ensure the Solidity compiler runs successfully.

```bash
npx hardhat compile

```

### 2. Deploy Mock Tokens (For Testing)

Deploys `ConfidentialERC20` tokens (e.g., zUSD, zPEPE).

```bash
npx hardhat run deploy/deployMocks.ts --network zama

```

### 3. Deploy CipherCore

Deploys the main logic and links it to the mocks.

```bash
npx hardhat run deploy/deployCipherCore.ts --network zama

```

*Take note of the deployed address output!*

---

## 🏃 Usage & Demo Tasks

The most powerful way to understand this protocol is to run the **End-to-End Demo Script**.

### Run the Demo

This script (`tasks/demo.ts`) simulates a full lifecycle:

1. **Minting:** Mints test tokens to Alice (Seller) and Bob (Buyer).
2. **Encryption:** Alice generates an encrypted Reserve Price.
3. **Order:** Alice creates an OTC Request.
4. **Bidding:** Bob generates an encrypted Bid.
5. **Settlement:** The script calls `resolveAuction` to compute the winner on-chain.

```bash
npx hardhat run tasks/demo.ts --network zama

```

**Expected Output:**

```text
Running Cipher RFQ Demo...
-------------------------------------------
[1] Seller created Request #1 (Encrypted Reserve)
[2] Buyer encrypted bid generated...
[3] Bid Submitted.
[4] Auction Resolved. Winner Found.
-------------------------------------------
Demo Complete.

```

---

## 🧪 Testing

To run unit tests that verify the FHE logic using Zama's mock environment:

```bash
npx hardhat test

```

To run specific tests:

```bash
npx hardhat test test/CipherCore.test.ts

```

---

## 🛡 Security Considerations

1. **Metadata Leakage:** While the *amount* is encrypted, the *timing* of the bid and the *bidder's address* are visible on the ledger. Future versions will implement Relayers to obfuscate the sender.
2. **Replay Attacks:** Proofs of encryption (`inputProof`) are bound to the contract address and user to prevent replaying a bid on a different chain.
3. **Access Control:** Only the `CipherCore` contract is authorized to operate on the `euint64` handles associated with the request.


```

```
