// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseEther } from "viem";

const OWNER = '0xf1f6Ccaa7e8f2f78E26D25b44d80517951c20284';
const JAN_1ST_2030 = 1893456000;
const ONE_HOUR_FROM_NOW = Math.floor(Date.now() / 1000) + 3600;
// const ONE_GWEI: bigint = parseEther("0.001");
const ZERO_GWEI: bigint = parseEther("0");

const LockModule = buildModule("LockModule", (m) => {
  const owner = m.getParameter("owner", OWNER);
  const unlockTime = m.getParameter("unlockTime", ONE_HOUR_FROM_NOW);
  const lockedAmount = m.getParameter("lockedAmount", ZERO_GWEI);

  const lock = m.contract("Lock", [owner, unlockTime], {
    value: lockedAmount,
  });

  return { lock };
});

export default LockModule;
