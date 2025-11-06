const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('DisputeContract', function () {
  let disputeContract;
  let tokenAEG;
  let escrowContract;
  let owner;
  let buyer;
  let seller;
  let juror1;
  let juror2;
  let juror3;

  beforeEach(async function () {
    [owner, buyer, seller, juror1, juror2, juror3] = await ethers.getSigners();

    // Deploy TokenAEG
    const TokenAEG = await ethers.getContractFactory('TokenAEG');
    tokenAEG = await TokenAEG.deploy();
    await tokenAEG.deployed();

    // Deploy DisputeContract
    const DisputeContract = await ethers.getContractFactory('DisputeContract');
    disputeContract = await DisputeContract.deploy(tokenAEG.address);
    await disputeContract.deployed();
  });

  describe('Juror Registration', function () {
    it('Should allow user to register as juror', async function () {
      const stake = ethers.utils.parseEther('1000');
      
      // Approve tokens
      await tokenAEG.connect(juror1).approve(disputeContract.address, stake);
      
      await expect(
        disputeContract.connect(juror1).registerJuror(stake)
      ).to.emit(disputeContract, 'JurorRegistered');
    });

    it('Should reject registration with insufficient stake', async function () {
      const stake = ethers.utils.parseEther('100'); // Less than minJurorStake
      
      await tokenAEG.connect(juror1).approve(disputeContract.address, stake);
      
      await expect(
        disputeContract.connect(juror1).registerJuror(stake)
      ).to.be.revertedWith('DisputeContract: stake too low');
    });
  });

  // Add more tests here
});

