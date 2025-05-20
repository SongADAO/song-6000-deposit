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
    const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;

    const lockedAmount = parseGwei("1");
    const unlockTime = BigInt((await time.latest()) + ONE_YEAR_IN_SECS);

    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await hre.viem.getWalletClients();

    const lock = await hre.viem.deployContract("Lock", [getAddress(owner.account.address), unlockTime], {
      value: lockedAmount,
    });

    const publicClient = await hre.viem.getPublicClient();

    return {
      lock,
      unlockTime,
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

      // We don't use the fixture here because we want a different deployment
      const latestTime = BigInt(await time.latest());
      await expect(
        hre.viem.deployContract("Lock", [getAddress(owner.account.address), latestTime], {
          value: 1n,
        })
      ).to.be.rejectedWith("Unlock time should be in the future");
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
        const { lock } = await loadFixture(deployOneYearLockFixture);

        // Try to set a new unlock time before the current unlock time has passed
        await expect(lock.write.setUnlockTime([BigInt((await time.latest()) + 2 * 365 * 24 * 60 * 60)]))
          .to.be.rejectedWith("You can't change time yet");
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
        const newUnlockTime = unlockTime + BigInt(365 * 24 * 60 * 60);
        await lock.write.setUnlockTime([newUnlockTime]);

        // Check if the unlock time was updated
        expect(await lock.read.unlockTime()).to.equal(newUnlockTime);
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
});
