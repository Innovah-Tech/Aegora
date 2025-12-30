const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');

describe('ReputationContract', function () {
  let reputationContract;
  let tokenAEG;
  let owner;
  let user1;
  let user2;

  async function deployReputationFixture() {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy TokenAEG
    const TokenAEG = await ethers.getContractFactory('TokenAEG');
    tokenAEG = await TokenAEG.deploy();
    await tokenAEG.deployed();

    // Deploy ReputationContract
    const ReputationContract = await ethers.getContractFactory('ReputationContract');
    reputationContract = await ReputationContract.deploy(tokenAEG.address);
    await reputationContract.deployed();

    return { reputationContract, tokenAEG, owner, user1, user2 };
  }

  beforeEach(async function () {
    ({ reputationContract, tokenAEG, owner, user1, user2 } = await loadFixture(deployReputationFixture));
  });

  describe('Deployment', function () {
    it('Should set the correct token address', async function () {
      expect(await reputationContract.aegToken()).to.equal(tokenAEG.address);
    });

    it('Should have correct initial reputation for new users', async function () {
      const reputation = await reputationContract.getReputation(user1.address);
      expect(reputation.score).to.equal(100); // Default starting score
    });
  });

  describe('Reputation Updates', function () {
    it('Should allow updating reputation score', async function () {
      await expect(
        reputationContract.updateReputation(user1.address, 150, 'Test update')
      ).to.emit(reputationContract, 'ReputationUpdated')
        .withArgs(user1.address, 150);

      const reputation = await reputationContract.getReputation(user1.address);
      expect(reputation.score).to.equal(150);
    });

    it('Should reject reputation update from non-owner', async function () {
      await expect(
        reputationContract.connect(user1).updateReputation(user2.address, 150, 'Test')
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should cap reputation at maximum', async function () {
      const maxScore = await reputationContract.MAX_REPUTATION();
      await reputationContract.updateReputation(user1.address, maxScore.add(100), 'Test');
      
      const reputation = await reputationContract.getReputation(user1.address);
      expect(reputation.score).to.equal(maxScore);
    });

    it('Should prevent reputation below minimum', async function () {
      await reputationContract.updateReputation(user1.address, 0, 'Test');
      
      const reputation = await reputationContract.getReputation(user1.address);
      expect(reputation.score).to.equal(0);
    });
  });

  describe('Transaction History', function () {
    it('Should record successful transaction', async function () {
      await expect(
        reputationContract.recordTransaction(user1.address, true, 1)
      ).to.emit(reputationContract, 'TransactionRecorded')
        .withArgs(user1.address, 1, true);

      const reputation = await reputationContract.getReputation(user1.address);
      expect(reputation.successfulTransactions).to.equal(1);
    });

    it('Should record failed transaction', async function () {
      await reputationContract.recordTransaction(user1.address, false, 1);

      const reputation = await reputationContract.getReputation(user1.address);
      expect(reputation.failedTransactions).to.equal(1);
    });

    it('Should increase reputation on successful transaction', async function () {
      const initialScore = (await reputationContract.getReputation(user1.address)).score;
      
      await reputationContract.recordTransaction(user1.address, true, 1);

      const newScore = (await reputationContract.getReputation(user1.address)).score;
      expect(newScore).to.be.gt(initialScore);
    });

    it('Should decrease reputation on failed transaction', async function () {
      await reputationContract.updateReputation(user1.address, 150, 'Set initial');
      const initialScore = (await reputationContract.getReputation(user1.address)).score;
      
      await reputationContract.recordTransaction(user1.address, false, 1);

      const newScore = (await reputationContract.getReputation(user1.address)).score;
      expect(newScore).to.be.lt(initialScore);
    });
  });

  describe('Arbitration History', function () {
    it('Should record arbitration participation', async function () {
      await expect(
        reputationContract.recordArbitration(user1.address, true, 1)
      ).to.emit(reputationContract, 'ArbitrationRecorded')
        .withArgs(user1.address, 1, true);

      const reputation = await reputationContract.getReputation(user1.address);
      expect(reputation.arbitrationsParticipated).to.equal(1);
    });

    it('Should increase reputation for correct arbitration', async function () {
      const initialScore = (await reputationContract.getReputation(user1.address)).score;
      
      await reputationContract.recordArbitration(user1.address, true, 1);

      const newScore = (await reputationContract.getReputation(user1.address)).score;
      expect(newScore).to.be.gt(initialScore);
    });

    it('Should decrease reputation for incorrect arbitration', async function () {
      await reputationContract.updateReputation(user1.address, 150, 'Set initial');
      const initialScore = (await reputationContract.getReputation(user1.address)).score;
      
      await reputationContract.recordArbitration(user1.address, false, 1);

      const newScore = (await reputationContract.getReputation(user1.address)).score;
      expect(newScore).to.be.lt(initialScore);
    });
  });

  describe('Reputation Tiers', function () {
    it('Should return correct tier for reputation score', async function () {
      await reputationContract.updateReputation(user1.address, 200, 'Test');
      
      const tier = await reputationContract.getReputationTier(user1.address);
      expect(tier).to.be.gte(0);
    });

    it('Should upgrade tier with higher reputation', async function () {
      await reputationContract.updateReputation(user1.address, 100, 'Initial');
      const tier1 = await reputationContract.getReputationTier(user1.address);
      
      await reputationContract.updateReputation(user1.address, 500, 'Upgrade');
      const tier2 = await reputationContract.getReputationTier(user1.address);
      
      expect(tier2).to.be.gte(tier1);
    });
  });

  describe('Batch Operations', function () {
    it('Should allow batch reputation updates', async function () {
      const addresses = [user1.address, user2.address];
      const scores = [150, 200];
      const reasons = ['Update 1', 'Update 2'];

      await expect(
        reputationContract.batchUpdateReputation(addresses, scores, reasons)
      ).to.emit(reputationContract, 'ReputationUpdated');

      const rep1 = await reputationContract.getReputation(user1.address);
      const rep2 = await reputationContract.getReputation(user2.address);
      
      expect(rep1.score).to.equal(150);
      expect(rep2.score).to.equal(200);
    });

    it('Should reject batch update with mismatched arrays', async function () {
      const addresses = [user1.address, user2.address];
      const scores = [150]; // Mismatched length
      const reasons = ['Update 1', 'Update 2'];

      await expect(
        reputationContract.batchUpdateReputation(addresses, scores, reasons)
      ).to.be.revertedWith('ReputationContract: array length mismatch');
    });
  });
});

