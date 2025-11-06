const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('TokenAEG', function () {
  let tokenAEG;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const TokenAEG = await ethers.getContractFactory('TokenAEG');
    tokenAEG = await TokenAEG.deploy();
    await tokenAEG.deployed();
  });

  describe('Deployment', function () {
    it('Should set the right name and symbol', async function () {
      expect(await tokenAEG.name()).to.equal('Aegora Token');
      expect(await tokenAEG.symbol()).to.equal('AEG');
    });

    it('Should mint initial supply to deployer', async function () {
      const initialSupply = ethers.utils.parseEther('1000000000');
      expect(await tokenAEG.balanceOf(owner.address)).to.equal(initialSupply);
    });
  });

  describe('Minting', function () {
    it('Should allow minter to mint tokens', async function () {
      await tokenAEG.addMinter(addr1.address);
      const amount = ethers.utils.parseEther('1000');
      
      await expect(
        tokenAEG.connect(addr1).mint(addr2.address, amount)
      ).to.not.be.reverted;
      
      expect(await tokenAEG.balanceOf(addr2.address)).to.equal(amount);
    });

    it('Should reject minting by non-minter', async function () {
      const amount = ethers.utils.parseEther('1000');
      
      await expect(
        tokenAEG.connect(addr1).mint(addr2.address, amount)
      ).to.be.revertedWith('TokenAEG: caller is not a minter');
    });
  });

  // Add more tests here
});

