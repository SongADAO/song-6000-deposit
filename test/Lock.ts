import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { getAddress, parseGwei } from "viem";

describe("Lock", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployOneYearLockFixture() {
    const ONE_DAY_FROM_NOW = 24 * 3600;
    const TWELVE_HOURS_FROM_NOW = 12 * 3600;

    const lockedAmount = parseGwei("1");
    const unlockTime = BigInt((await time.latest()) + ONE_DAY_FROM_NOW);
    const depositDeadline = BigInt((await time.latest()) + TWELVE_HOURS_FROM_NOW);

    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await hre.viem.getWalletClients();

    const lock = await hre.viem.deployContract("Lock", [
      getAddress(owner.account.address),
      unlockTime,
      depositDeadline
    ], {
      value: lockedAmount,
    });

    const publicClient = await hre.viem.getPublicClient();

    return {
      lock,
      unlockTime,
      depositDeadline,
      lockedAmount,
      owner,
      otherAccount,
      publicClient,
    };
  }

  describe("Deployment", function () {
    it("Should set the right unlockTime", async function () {
      const { lock, unlockTime } = await loadFixture(deployOneYearLockFixture);

      expect(await lock.read.unlockTime()).to.equal(unlockTime);
    });

    it("Should set the right depositDeadline", async function () {
      const { lock, depositDeadline } = await loadFixture(deployOneYearLockFixture);

      expect(await lock.read.depositDeadline()).to.equal(depositDeadline);
    });

    it("Should set the right owner", async function () {
      const { lock, owner } = await loadFixture(deployOneYearLockFixture);

      expect(await lock.read.owner()).to.equal(
        getAddress(owner.account.address)
      );
    });

    it("Should receive and store the funds to lock", async function () {
      const { lock, lockedAmount, publicClient } = await loadFixture(
        deployOneYearLockFixture
      );

      expect(
        await publicClient.getBalance({
          address: lock.address,
        })
      ).to.equal(lockedAmount);
    });

    it("Should fail if the unlockTime is not in the future", async function () {
      const [owner, otherAccount] = await hre.viem.getWalletClients();

      const latestTime = BigInt(await time.latest());
      const futureDepositDeadline = latestTime + BigInt(3600); // 1 hour from now

      await expect(
        hre.viem.deployContract("Lock", [
          getAddress(owner.account.address),
          latestTime,
          futureDepositDeadline
        ], {
          value: 1n,
        })
      ).to.be.rejectedWith("Unlock time should be in the future");
    });

    it("Should fail if the depositDeadline is not in the future", async function () {
      const [owner, otherAccount] = await hre.viem.getWalletClients();

      const latestTime = BigInt(await time.latest());
      const futureUnlockTime = latestTime + BigInt(86400); // 1 day from now

      await expect(
        hre.viem.deployContract("Lock", [
          getAddress(owner.account.address),
          futureUnlockTime,
          latestTime
        ], {
          value: 1n,
        })
      ).to.be.rejectedWith("Deposit deadline should be in the future");
    });

    it("Should fail if depositDeadline is after unlockTime", async function () {
      const [owner, otherAccount] = await hre.viem.getWalletClients();

      const latestTime = BigInt(await time.latest());
      const unlockTime = latestTime + BigInt(3600); // 1 hour from now
      const depositDeadline = latestTime + BigInt(7200); // 2 hours from now

      await expect(
        hre.viem.deployContract("Lock", [
          getAddress(owner.account.address),
          unlockTime,
          depositDeadline
        ], {
          value: 1n,
        })
      ).to.be.rejectedWith("Deposit deadline must be before or equal to unlock time");
    });
  });

  describe("Withdrawals", function () {
    describe("Validations", function () {
      it("Should revert with the right error if called too soon", async function () {
        const { lock } = await loadFixture(deployOneYearLockFixture);

        await expect(lock.write.withdraw()).to.be.rejectedWith(
          "You can't withdraw yet"
        );
      });

      it("Should revert with the right error if called from another account", async function () {
        const { lock, unlockTime, otherAccount } = await loadFixture(
          deployOneYearLockFixture
        );

        // We can increase the time in Hardhat Network
        await time.increaseTo(unlockTime);

        // We retrieve the contract with a different account to send a transaction
        const lockAsOtherAccount = await hre.viem.getContractAt(
          "Lock",
          lock.address,
          { client: { wallet: otherAccount } }
        );
        await expect(lockAsOtherAccount.write.withdraw()).to.be.rejectedWith(
          "You aren't the owner"
        );
      });

      it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async function () {
        const { lock, unlockTime } = await loadFixture(
          deployOneYearLockFixture
        );

        // Transactions are sent using the first signer by default
        await time.increaseTo(unlockTime);

        await expect(lock.write.withdraw()).to.be.fulfilled;
      });
    });

    describe("Events", function () {
      it("Should emit an event on withdrawals", async function () {
        const { lock, unlockTime, lockedAmount, publicClient } =
          await loadFixture(deployOneYearLockFixture);

        await time.increaseTo(unlockTime);

        const hash = await lock.write.withdraw();
        await publicClient.waitForTransactionReceipt({ hash });

        // get the withdrawal events in the latest block
        const withdrawalEvents = await lock.getEvents.Withdrawal();
        expect(withdrawalEvents).to.have.lengthOf(1);
        expect(withdrawalEvents[0].args.amount).to.equal(lockedAmount);
      });
    });
  });

  describe("Set Unlock Time", function () {
    describe("Validations", function () {
      it("Should revert if called before the unlock time", async function () {
        const { lock, unlockTime } = await loadFixture(deployOneYearLockFixture);

        // Try to set a new unlock time before the current unlock time has passed
        await expect(lock.write.setUnlockTime([unlockTime - BigInt(1)]))
          .to.be.rejectedWith("Cannot decrease lock time");
      });

      it("Should revert if called from another account", async function () {
        const { lock, unlockTime, otherAccount } = await loadFixture(
          deployOneYearLockFixture
        );

        // We can increase the time in Hardhat Network to pass the unlock time
        await time.increaseTo(unlockTime);

        // Try to set unlock time from another account
        const lockAsOtherAccount = await hre.viem.getContractAt(
          "Lock",
          lock.address,
          { client: { wallet: otherAccount } }
        );
        await expect(lockAsOtherAccount.write.setUnlockTime([unlockTime + 1n]))
          .to.be.rejectedWith("You aren't the owner");
      });

      it("Should update the unlock time if called by the owner after unlock time", async function () {
        const { lock, unlockTime } = await loadFixture(
          deployOneYearLockFixture
        );

        // Increase time to pass the unlock time
        await time.increaseTo(unlockTime);

        // Set a new unlock time (one more year)
        const newUnlockTime = unlockTime + BigInt(60);
        await lock.write.setUnlockTime([newUnlockTime]);

        // Check if the unlock time was updated
        expect(await lock.read.unlockTime()).to.equal(newUnlockTime);
      });
    });
  });

  describe("Set Deposit Deadline", function () {
    describe("Validations", function () {
      it("Should revert if called from another account", async function () {
        const { lock, depositDeadline, otherAccount } = await loadFixture(
          deployOneYearLockFixture
        );

        // Try to set deposit deadline from another account
        const lockAsOtherAccount = await hre.viem.getContractAt(
          "Lock",
          lock.address,
          { client: { wallet: otherAccount } }
        );
        await expect(lockAsOtherAccount.write.setDepositDeadline([depositDeadline + BigInt(60)]))
          .to.be.rejectedWith("You aren't the owner");
      });

      it("Should revert if new deadline is after unlock time", async function () {
        const { lock, unlockTime } = await loadFixture(
          deployOneYearLockFixture
        );

        await expect(lock.write.setDepositDeadline([unlockTime + BigInt(60)]))
          .to.be.rejectedWith("Deposit deadline must be before or equal to unlock time");
      });

      it("Should revert if new deadline is not in the future", async function () {
        const { lock } = await loadFixture(deployOneYearLockFixture);

        const pastTime = BigInt(await time.latest()) - BigInt(3600);
        await expect(lock.write.setDepositDeadline([pastTime]))
          .to.be.rejectedWith("Deposit deadline should be in the future");
      });

      it("Should update the deposit deadline if called by the owner with valid time", async function () {
        const { lock, unlockTime } = await loadFixture(
          deployOneYearLockFixture
        );

        // Set a new deposit deadline (equal to unlock time)
        await lock.write.setDepositDeadline([unlockTime]);

        // Check if the deposit deadline was updated
        expect(await lock.read.depositDeadline()).to.equal(unlockTime);
      });
    });
  });

  describe("Set Owner", function () {
    describe("Validations", function () {
      it("Should revert if called from another account", async function () {
        const { lock, otherAccount } = await loadFixture(
          deployOneYearLockFixture
        );

        // Try to set owner from another account
        const lockAsOtherAccount = await hre.viem.getContractAt(
          "Lock",
          lock.address,
          { client: { wallet: otherAccount } }
        );
        await expect(lockAsOtherAccount.write.setOwner([getAddress(otherAccount.account.address)]))
          .to.be.rejectedWith("You aren't the owner");
      });

      it("Should update the owner if called by the current owner", async function () {
        const { lock, owner, otherAccount } = await loadFixture(
          deployOneYearLockFixture
        );

        // Set new owner
        await lock.write.setOwner([getAddress(otherAccount.account.address)]);

        // Check if the owner was updated
        expect(await lock.read.owner()).to.equal(
          getAddress(otherAccount.account.address)
        );
      });

      it("Should allow the new owner to withdraw after ownership transfer", async function () {
        const { lock, unlockTime, otherAccount, publicClient } = await loadFixture(
          deployOneYearLockFixture
        );

        // Change owner to otherAccount
        await lock.write.setOwner([getAddress(otherAccount.account.address)]);

        // Increase time to pass the unlock time
        await time.increaseTo(unlockTime);

        // Try to withdraw with the new owner
        const lockAsNewOwner = await hre.viem.getContractAt(
          "Lock",
          lock.address,
          { client: { wallet: otherAccount } }
        );

        // Should succeed with the new owner
        await expect(lockAsNewOwner.write.withdraw()).to.be.fulfilled;
      });

      it("Should prevent the old owner from withdrawing after ownership transfer", async function () {
        const { lock, unlockTime, otherAccount } = await loadFixture(
          deployOneYearLockFixture
        );

        // Change owner to otherAccount
        await lock.write.setOwner([getAddress(otherAccount.account.address)]);

        // Increase time to pass the unlock time
        await time.increaseTo(unlockTime);

        // Original owner should no longer be able to withdraw
        await expect(lock.write.withdraw()).to.be.rejectedWith(
          "You aren't the owner"
        );
      });
    });
  });

  describe("Receive function", function () {
    it("Should emit Received event when contract receives Ether before deposit deadline", async function () {
      const { lock, otherAccount, publicClient } = await loadFixture(
        deployOneYearLockFixture
      );

      // Send ETH directly to the contract before deposit deadline
      const amount = parseGwei("0.5");
      const hash = await otherAccount.sendTransaction({
        to: lock.address,
        value: amount,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Verify that the Received event was emitted
      const receivedEvents = await lock.getEvents.Received();
      expect(receivedEvents).to.have.lengthOf(1);
      expect(receivedEvents[0].args.sender).to.equal(
        getAddress(otherAccount.account.address)
      );
      expect(receivedEvents[0].args.amount).to.equal(amount);
    });

    it("Should revert when trying to send Ether after deposit deadline", async function () {
      const { lock, depositDeadline, otherAccount } = await loadFixture(
        deployOneYearLockFixture
      );

      // Fast forward time past the deposit deadline
      await time.increaseTo(depositDeadline + BigInt(1));

      // Try to send ETH after deposit deadline
      const amount = parseGwei("0.5");
      await expect(
        otherAccount.sendTransaction({
          to: lock.address,
          value: amount,
        })
      ).to.be.rejectedWith("Deposits are no longer allowed");
    });

    it("Should increase contract balance when receiving Ether before deadline", async function () {
      const { lock, otherAccount, publicClient, lockedAmount } = await loadFixture(
        deployOneYearLockFixture
      );

      // Get the initial balance
      const initialBalance = await publicClient.getBalance({
        address: lock.address,
      });

      // Send ETH directly to the contract
      const amount = parseGwei("0.5");
      const hash = await otherAccount.sendTransaction({
        to: lock.address,
        value: amount,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Check that the balance increased by the correct amount
      const newBalance = await publicClient.getBalance({
        address: lock.address,
      });
      expect(newBalance).to.equal(initialBalance + amount);
    });

    it("Should allow receiving Ether from multiple accounts before deadline", async function () {
      const { lock, owner, otherAccount, publicClient } = await loadFixture(
        deployOneYearLockFixture
      );

      // Get the initial balance
      const initialBalance = await publicClient.getBalance({
        address: lock.address,
      });

      // Send ETH from multiple accounts
      const amount1 = parseGwei("0.3");
      const hash1 = await owner.sendTransaction({
        to: lock.address,
        value: amount1,
      });
      await publicClient.waitForTransactionReceipt({ hash: hash1 });

      // Check events
      const receivedEvents1 = await lock.getEvents.Received();
      expect(receivedEvents1).to.have.lengthOf(1);

      // Verify both events have correct data
      const ownerEvent1 = receivedEvents1.find(
        event => event.args.sender === getAddress(owner.account.address)
      );

      expect(ownerEvent1).to.not.be.undefined;
      expect(ownerEvent1?.args.amount).to.equal(amount1);

      const amount2 = parseGwei("0.7");
      const hash2 = await otherAccount.sendTransaction({
        to: lock.address,
        value: amount2,
      });
      await publicClient.waitForTransactionReceipt({ hash: hash2 });

      // Check events
      const receivedEvents2 = await lock.getEvents.Received();
      expect(receivedEvents2).to.have.lengthOf(1);

      // Verify both events have correct data
      const ownerEvent2 = receivedEvents2.find(
        event => event.args.sender === getAddress(otherAccount.account.address)
      );

      expect(ownerEvent2).to.not.be.undefined;
      expect(ownerEvent2?.args.amount).to.equal(amount2);

      // Check that the balance increased by the correct total amount
      const newBalance = await publicClient.getBalance({
        address: lock.address,
      });
      expect(newBalance).to.equal(initialBalance + amount1 + amount2);
    });

    it("Should work with withdraw function after deposit deadline has passed", async function () {
      const { lock, unlockTime, depositDeadline, owner, otherAccount, publicClient } = await loadFixture(
        deployOneYearLockFixture
      );

      // Send additional ETH to the contract before deposit deadline
      const amount = parseGwei("0.5");
      const hash = await otherAccount.sendTransaction({
        to: lock.address,
        value: amount,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Fast forward time past deposit deadline but before unlock time
      await time.increaseTo(depositDeadline + BigInt(3600));

      // Verify deposits are now blocked
      await expect(
        otherAccount.sendTransaction({
          to: lock.address,
          value: parseGwei("0.1"),
        })
      ).to.be.rejectedWith("Deposits are no longer allowed");

      // Fast forward time to unlock
      await time.increaseTo(unlockTime);

      // Get the owner's balance before withdrawal
      const ownerBalanceBefore = await publicClient.getBalance({
        address: owner.account.address,
      });

      // Owner withdraws all funds
      const withdrawHash = await lock.write.withdraw();
      const receipt = await publicClient.waitForTransactionReceipt({ hash: withdrawHash });

      // Calculate gas cost
      const gasCost = receipt.gasUsed * receipt.effectiveGasPrice;

      // Get the owner's balance after withdrawal
      const ownerBalanceAfter = await publicClient.getBalance({
        address: owner.account.address,
      });

      // Check contract balance is zero
      const contractBalance = await publicClient.getBalance({
        address: lock.address,
      });
      expect(contractBalance).to.equal(0n);

      // Check owner received the funds (minus gas costs)
      // The initial locked amount + the additional amount should have been transferred
      const { lockedAmount } = await loadFixture(deployOneYearLockFixture);

      // When working with BigInts, use BigInt-specific assertions
      // Instead of using closeTo with numbers, check if within a small range
      const expectedBalance = ownerBalanceBefore + lockedAmount + amount - gasCost;
      const difference = expectedBalance > ownerBalanceAfter
        ? expectedBalance - ownerBalanceAfter
        : ownerBalanceAfter - expectedBalance;

      // Allow for a small variance (1000 wei)
      expect(difference <= 1000n).to.be.true;
    });
  });
});
