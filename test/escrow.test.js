const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('EscrowContract', function () {
  let escrowContract;
  let tokenAEG;
  let owner;
  let buyer;
  let seller;

  beforeEach(async function () {
    [owner, buyer, seller] = await ethers.getSigners();

    // Deploy TokenAEG
    const TokenAEG = await ethers.getContractFactory('TokenAEG');
    tokenAEG = await TokenAEG.deploy();
    await tokenAEG.deployed();

    // Deploy EscrowContract
    const EscrowContract = await ethers.getContractFactory('EscrowContract');
    escrowContract = await EscrowContract.deploy();
    await escrowContract.deployed();
  });

  describe('Deployment', function () {
    it('Should set the right owner', async function () {
      expect(await escrowContract.owner()).to.equal(owner.address);
    });

    it('Should have ETH allowed by default', async function () {
      expect(await escrowContract.allowedTokens(ethers.constants.AddressZero)).to.be.true;
    });
  });

  describe('Creating Escrow', function () {
    it('Should create an escrow with ETH', async function () {
      const amount = ethers.utils.parseEther('1.0');
      const termsHash = 'QmTestHash123';

      await expect(
        escrowContract.connect(buyer).createEscrow(seller.address, ethers.constants.AddressZero, termsHash, {
          value: amount
        })
      ).to.emit(escrowContract, 'EscrowCreated');
    });

    it('Should reject escrow with same buyer and seller', async function () {
      const amount = ethers.utils.parseEther('1.0');
      const termsHash = 'QmTestHash123';

      await expect(
        escrowContract.connect(buyer).createEscrow(buyer.address, ethers.constants.AddressZero, termsHash, {
          value: amount
        })
      ).to.be.revertedWith('EscrowContract: cannot escrow with self');
    });
  });

  // Add more tests here
});

