import dotenv from "dotenv";
import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";

dotenv.config();

const config: HardhatUserConfig = {
  etherscan: {
    apiKey: {
      // Mainnet networks
      mainnet: process.env.ETHERSCAN_API_KEY ?? '',
      arbitrumOne: process.env.ARBISCAN_API_KEY ?? '',
      base: process.env.BASESCAN_API_KEY ?? '',
      optimisticEthereum: process.env.OPTIMISM_API_KEY ?? '',

      // Testnet networks
      sepolia: process.env.ETHERSCAN_API_KEY ?? '',
      arbitrumSepolia: process.env.ARBISCAN_API_KEY ?? '',
      baseSepolia: process.env.BASESCAN_API_KEY ?? '',
      optimismSepolia: process.env.OPTIMISM_API_KEY ?? '',
    },
    customChains: [
      // Mainnet chains
      {
        network: "arbitrumOne",
        chainId: 42161,
        urls: {
          apiURL: "https://api.arbiscan.io/api",
          browserURL: "https://arbiscan.io"
        }
      },
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org"
        }
      },
      {
        network: "optimisticEthereum",
        chainId: 10,
        urls: {
          apiURL: "https://api-optimistic.etherscan.io/api",
          browserURL: "https://optimistic.etherscan.io"
        }
      },

      // Testnet chains
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org"
        }
      },
      {
        network: "arbitrumSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io"
        }
      },
      {
        network: "optimismSepolia",
        chainId: 11155420,
        urls: {
          apiURL: "https://api-sepolia-optimistic.etherscan.io/api",
          browserURL: "https://sepolia-optimism.etherscan.io"
        }
      }
    ]
  },
  gasReporter: {
    coinmarketcap: process.env.COINMARKETCAP_API_KEY ?? '',
    currency: "USD",
    enabled: process.env.REPORT_GAS !== undefined,
    gasPrice: 15,
  },
  networks: {
    // hardhat: {},
    localhost: {
      from: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // want this contract owner
      url: "http://127.0.0.1:8545",
    },
    mainnet: {
      accounts: [process.env.MAINNET_PRIVATE_KEY ?? ''],
      from: process.env.MAINNET_FROM, // want this contract owner
      url: process.env.MAINNET_URL,
    },
    arbitrumOne: {
      accounts: [process.env.MAINNET_PRIVATE_KEY ?? ''],
      from: process.env.MAINNET_FROM, // want this contract owner
      url: process.env.ARBITRUM_URL,
    },
    optimisticEthereum: {
      accounts: [process.env.MAINNET_PRIVATE_KEY ?? ''],
      from: process.env.MAINNET_FROM, // want this contract owner
      url: process.env.OPTIMISM_URL,
    },
    base: {
      accounts: [process.env.MAINNET_PRIVATE_KEY ?? ''],
      from: process.env.MAINNET_FROM, // want this contract owner
      url: process.env.BASE_URL,
    },
    sepolia: {
      accounts: [process.env.SEPOLIA_PRIVATE_KEY ?? ''],
      from: process.env.SEPOLIA_FROM, // want this contract owner
      url: process.env.SEPOLIA_URL,
    },
    baseSepolia: {
      accounts: [process.env.SEPOLIA_PRIVATE_KEY ?? ''],
      from: process.env.SEPOLIA_FROM, // want this contract owner
      url: process.env.BASE_SEPOLIA_URL,
    },
  },
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
};

export default config;
