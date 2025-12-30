const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');

describe('TokenAEG', function () {
  let tokenAEG;
  let owner;
  let addr1;
  let addr2;
  let minter;

  async function deployTokenFixture() {
    [owner, addr1, addr2, minter] = await ethers.getSigners();

    const TokenAEG = await ethers.getContractFactory('TokenAEG');
    tokenAEG = await TokenAEG.deploy();
    await tokenAEG.deployed();

    return { tokenAEG, owner, addr1, addr2, minter };
  }

  beforeEach(async function () {
    ({ tokenAEG, owner, addr1, addr2, minter } = await loadFixture(deployTokenFixture));
  });

  describe('Deployment', function () {
    it('Should set the right name and symbol', async function () {
      expect(await tokenAEG.name()).to.equal('Aegora Token');
      expect(await tokenAEG.symbol()).to.equal('AEG');
    });

    it('Should set the right decimals', async function () {
      expect(await tokenAEG.decimals()).to.equal(18);
    });

    it('Should mint initial supply to deployer', async function () {
      const initialSupply = ethers.utils.parseEther('1000000000');
      expect(await tokenAEG.balanceOf(owner.address)).to.equal(initialSupply);
      expect(await tokenAEG.totalSupply()).to.equal(initialSupply);
    });

    it('Should set deployer as owner', async function () {
      expect(await tokenAEG.owner()).to.equal(owner.address);
    });
  });

  describe('Transfers', function () {
    const amount = ethers.utils.parseEther('1000');

    it('Should transfer tokens between accounts', async function () {
      await expect(
        tokenAEG.connect(owner).transfer(addr1.address, amount)
      ).to.emit(tokenAEG, 'Transfer')
        .withArgs(owner.address, addr1.address, amount);

      expect(await tokenAEG.balanceOf(addr1.address)).to.equal(amount);
    });

    it('Should update balances after transfer', async function () {
      const ownerBalanceBefore = await tokenAEG.balanceOf(owner.address);
      
      await tokenAEG.connect(owner).transfer(addr1.address, amount);

      const ownerBalanceAfter = await tokenAEG.balanceOf(owner.address);
      const addr1Balance = await tokenAEG.balanceOf(addr1.address);

      expect(ownerBalanceBefore.sub(ownerBalanceAfter)).to.equal(amount);
      expect(addr1Balance).to.equal(amount);
    });

    it('Should reject transfer with insufficient balance', async function () {
      const largeAmount = ethers.utils.parseEther('10000000000');
      
      await expect(
        tokenAEG.connect(addr1).transfer(addr2.address, largeAmount)
      ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });

    it('Should reject transfer to zero address', async function () {
      await expect(
        tokenAEG.connect(owner).transfer(ethers.constants.AddressZero, amount)
      ).to.be.revertedWith('ERC20: transfer to the zero address');
    });
  });

  describe('Approvals', function () {
    const amount = ethers.utils.parseEther('1000');

    it('Should approve tokens for spender', async function () {
      await expect(
        tokenAEG.connect(owner).approve(addr1.address, amount)
      ).to.emit(tokenAEG, 'Approval')
        .withArgs(owner.address, addr1.address, amount);

      expect(await tokenAEG.allowance(owner.address, addr1.address)).to.equal(amount);
    });

    it('Should allow transferFrom with approval', async function () {
      await tokenAEG.connect(owner).approve(addr1.address, amount);
      
      await expect(
        tokenAEG.connect(addr1).transferFrom(owner.address, addr2.address, amount)
      ).to.emit(tokenAEG, 'Transfer')
        .withArgs(owner.address, addr2.address, amount);

      expect(await tokenAEG.balanceOf(addr2.address)).to.equal(amount);
      expect(await tokenAEG.allowance(owner.address, addr1.address)).to.equal(0);
    });

    it('Should reject transferFrom with insufficient allowance', async function () {
      await tokenAEG.connect(owner).approve(addr1.address, amount.div(2));
      
      await expect(
        tokenAEG.connect(addr1).transferFrom(owner.address, addr2.address, amount)
      ).to.be.revertedWith('ERC20: transfer amount exceeds allowance');
    });

    it('Should reject transferFrom with insufficient balance', async function () {
      const largeAmount = ethers.utils.parseEther('10000000000');
      await tokenAEG.connect(owner).approve(addr1.address, largeAmount);
      
      await expect(
        tokenAEG.connect(addr1).transferFrom(owner.address, addr2.address, largeAmount)
      ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });

    it('Should update allowance after partial transferFrom', async function () {
      const approveAmount = ethers.utils.parseEther('1000');
      const transferAmount = ethers.utils.parseEther('300');
      
      await tokenAEG.connect(owner).approve(addr1.address, approveAmount);
      await tokenAEG.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount);

      const remainingAllowance = await tokenAEG.allowance(owner.address, addr1.address);
      expect(remainingAllowance).to.equal(approveAmount.sub(transferAmount));
    });
  });

  describe('Minting', function () {
    const amount = ethers.utils.parseEther('1000');

    it('Should allow minter to mint tokens', async function () {
      await tokenAEG.addMinter(minter.address);
      
      await expect(
        tokenAEG.connect(minter).mint(addr1.address, amount)
      ).to.emit(tokenAEG, 'Transfer')
        .withArgs(ethers.constants.AddressZero, addr1.address, amount);

      expect(await tokenAEG.balanceOf(addr1.address)).to.equal(amount);
    });

    it('Should update total supply after minting', async function () {
      await tokenAEG.addMinter(minter.address);
      const totalSupplyBefore = await tokenAEG.totalSupply();
      
      await tokenAEG.connect(minter).mint(addr1.address, amount);

      const totalSupplyAfter = await tokenAEG.totalSupply();
      expect(totalSupplyAfter.sub(totalSupplyBefore)).to.equal(amount);
    });

    it('Should reject minting by non-minter', async function () {
      await expect(
        tokenAEG.connect(addr1).mint(addr2.address, amount)
      ).to.be.revertedWith('TokenAEG: caller is not a minter');
    });

    it('Should allow owner to add minter', async function () {
      await expect(
        tokenAEG.addMinter(minter.address)
      ).to.not.be.reverted;

      // Verify minter can now mint
      await expect(
        tokenAEG.connect(minter).mint(addr1.address, amount)
      ).to.not.be.reverted;
    });

    it('Should reject adding minter by non-owner', async function () {
      await expect(
        tokenAEG.connect(addr1).addMinter(minter.address)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should allow owner to remove minter', async function () {
      await tokenAEG.addMinter(minter.address);
      await tokenAEG.removeMinter(minter.address);
      
      await expect(
        tokenAEG.connect(minter).mint(addr1.address, amount)
      ).to.be.revertedWith('TokenAEG: caller is not a minter');
    });
  });

  describe('Burning', function () {
    const amount = ethers.utils.parseEther('1000');

    beforeEach(async function () {
      await tokenAEG.connect(owner).transfer(addr1.address, amount);
    });

    it('Should allow owner to burn tokens', async function () {
      const balanceBefore = await tokenAEG.balanceOf(addr1.address);
      const totalSupplyBefore = await tokenAEG.totalSupply();

      await expect(
        tokenAEG.connect(addr1).burn(amount)
      ).to.emit(tokenAEG, 'Transfer')
        .withArgs(addr1.address, ethers.constants.AddressZero, amount);

      const balanceAfter = await tokenAEG.balanceOf(addr1.address);
      const totalSupplyAfter = await tokenAEG.totalSupply();

      expect(balanceBefore.sub(balanceAfter)).to.equal(amount);
      expect(totalSupplyBefore.sub(totalSupplyAfter)).to.equal(amount);
    });

    it('Should reject burning more than balance', async function () {
      const largeAmount = ethers.utils.parseEther('10000');
      
      await expect(
        tokenAEG.connect(addr1).burn(largeAmount)
      ).to.be.revertedWith('ERC20: burn amount exceeds balance');
    });

    it('Should allow burning from another address with approval', async function () {
      await tokenAEG.connect(addr1).approve(owner.address, amount);
      
      await expect(
        tokenAEG.connect(owner).burnFrom(addr1.address, amount)
      ).to.emit(tokenAEG, 'Transfer')
        .withArgs(addr1.address, ethers.constants.AddressZero, amount);
    });

    it('Should reject burnFrom with insufficient allowance', async function () {
      await tokenAEG.connect(addr1).approve(owner.address, amount.div(2));
      
      await expect(
        tokenAEG.connect(owner).burnFrom(addr1.address, amount)
      ).to.be.revertedWith('ERC20: burn amount exceeds allowance');
    });
  });

  describe('Access Control', function () {
    it('Should allow owner to pause', async function () {
      await expect(
        tokenAEG.pause()
      ).to.emit(tokenAEG, 'Paused')
        .withArgs(owner.address);
    });

    it('Should reject transfers when paused', async function () {
      await tokenAEG.pause();
      
      await expect(
        tokenAEG.connect(owner).transfer(addr1.address, ethers.utils.parseEther('1000'))
      ).to.be.revertedWith('ERC20Pausable: token transfer while paused');
    });

    it('Should allow owner to unpause', async function () {
      await tokenAEG.pause();
      
      await expect(
        tokenAEG.unpause()
      ).to.emit(tokenAEG, 'Unpaused')
        .withArgs(owner.address);

      // Should allow transfers after unpause
      await expect(
        tokenAEG.connect(owner).transfer(addr1.address, ethers.utils.parseEther('1000'))
      ).to.not.be.reverted;
    });

    it('Should reject pause by non-owner', async function () {
      await expect(
        tokenAEG.connect(addr1).pause()
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });
});
