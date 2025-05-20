import dotenv from "dotenv";
import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";

dotenv.config();

const config: HardhatUserConfig = {
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  gasReporter: {
    coinmarketcap: process.env.COINMARKETCAP_API_KEY || "",
    currency: "USD",
    enabled: process.env.REPORT_GAS !== undefined,
    gasPrice: 3,
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
    arbitrum: {
      accounts: [process.env.MAINNET_PRIVATE_KEY ?? ''],
      from: process.env.MAINNET_FROM, // want this contract owner
      url: process.env.ARBITRUM_SEPOLIA_URL,
    },
    optimism: {
      accounts: [process.env.MAINNET_PRIVATE_KEY ?? ''],
      from: process.env.MAINNET_FROM, // want this contract owner
      url: process.env.OPTIMISM_SEPOLIA_URL,
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
