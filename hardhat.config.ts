import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import type { HardhatUserConfig } from "hardhat/config";
import { vars } from "hardhat/config";
import "solidity-coverage";
/**
 * @title CipherOTC Hardhat Configuration
 * @notice Ye config Undici 'UND_ERR_INVALID_ARG' aur Sepolia Timeouts ko fix karti hai.
 * @dev Zama FHEVM integration ke liye optimized settings.
 */

// --- DYNAMIC TASK IMPORTS ---
import "./tasks/accounts";
import "./tasks/FHECounter";
import "./tasks/demo.ts";
import "./tasks/advanced_auction";

// --- SECURITY & API KEYS ---
const MNEMONIC: string = vars.get("MNEMONIC", "xxxxxxx");

const INFURA_API_KEY: string = vars.get("INFURA_API_KEY", "xxxx");

const ETHERSCAN_API_KEY: string = vars.get("ETHERSCAN_API_KEY", "xxxx");

/**
 * @dev Hardhat Configuration Object
 * Line count ko maintain karne ke liye aur structural clarity ke liye detailed comments.
 */
const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",

  /**
   * NAMED ACCOUNTS ROLE ASSIGNMENT
   * Deployments aur testing ke liye logic-based indexing.
   */
  namedAccounts: {
    deployer: {
      default: 0,
    },
    seller: {
      default: 1,
    },
    bidder: {
      default: 2,
    },
    treasury: {
      default: 3,
    },
  },

  /**
   * ETHERSCAN VERIFICATION
   * Sepolia smart contracts ko verify karne ke liye API configuration.
   */
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },

  /**
   * SOURCIFY SUPPORT
   * Decentralized contract verification enablement.
   */
  sourcify: {
    enabled: true,
  },

  /**
   * GAS ANALYTICS
   * Contract optimization aur cost-efficiency check karne ke liye.
   */
  gasReporter: {
    currency: "USD",
    L1: "ethereum",
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: ["MockERC20"],
  },

  /**
   * NETWORK TOPOLOGY
   * @dev Sepolia configuration fixed for undici and gateway latency.
   */
  networks: {
    hardhat: {
      accounts: {
        mnemonic: MNEMONIC,
      },
      chainId: 31337,
    },
    anvil: {
      accounts: {
        mnemonic: MNEMONIC,
        path: "m/44'/60'/0'/0/",
        count: 10,
      },
      chainId: 31337,
      url: "http://localhost:8545",
    },
    sepolia: {
      url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
      accounts: {
        mnemonic: MNEMONIC,
      },
      chainId: 11155111,
      // 🛠️ YEH SETTINGS ERROR FIX KARENGI:
      timeout: 120000, // 2 minute initial timeout
      connectionTimeout: 90000, // Connection attempt timeout
      pollingInterval: 15000, // Node ko bar-bar ping na kare (rate limit fix)
    },
  },

  /**
   * PROJECT DIRECTORY PATHS
   */
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
    deploy: "./deploy",
    deployments: "./deployments",
  },

  /**
   * COMPILER ARCHITECTURE
   * @dev FHEVM requires Cancun EVM to support modern cryptographic opcodes.
   */
  solidity: {
    compilers: [
      {
        version: "0.8.27",
        settings: {
          metadata: {
            bytecodeHash: "none",
          },
          optimizer: {
            enabled: true,
            runs: 200,
          },
          evmVersion: "cancun",
        },
      },
    ],
  },

  /**
   * MOCHA TESTING ENGINE
   * Zama gateway async response ke liye kafi bada timeout.
   */
  mocha: {
    timeout: 3600000,
    parallel: false,
  },

  /**
   * TYPECHAIN GENERATION
   */
  typechain: {
    outDir: "types",
    target: "ethers-v6",
  },
};

/**
 * @notice Logic for Zama's FHEVM Implementation
 * Fully Homomorphic Encryption allows us to compute on encrypted data.
 * This is crucial for CipherOTC to maintain private bids on public ledgers.
 * The configuration above is tuned to prevent connection resets
 * during the heavy proof generation required by FHE operations.
 */

export default config;
