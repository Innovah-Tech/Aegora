const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');

describe('EscrowContract', function () {
  let escrowContract;
  let tokenAEG;
  let mockERC20;
  let owner;
  let buyer;
  let seller;
  let arbitrator;
  let other;

  // Deploy contracts fixture
  async function deployContractsFixture() {
    [owner, buyer, seller, arbitrator, other] = await ethers.getSigners();

    // Deploy TokenAEG
    const TokenAEG = await ethers.getContractFactory('TokenAEG');
    tokenAEG = await TokenAEG.deploy();
    await tokenAEG.deployed();

    // Deploy EscrowContract
    const EscrowContract = await ethers.getContractFactory('EscrowContract');
    escrowContract = await EscrowContract.deploy();
    await escrowContract.deployed();

    // Deploy mock ERC20 token for testing
    const MockERC20 = await ethers.getContractFactory('TokenAEG'); // Reuse TokenAEG as mock
    mockERC20 = await MockERC20.deploy();
    await mockERC20.deployed();

    // Add mock token to allowed list
    await escrowContract.addAllowedToken(mockERC20.address);

    // Mint tokens to buyer for ERC20 tests
    await mockERC20.mint(buyer.address, ethers.utils.parseEther('10000'));
    await tokenAEG.mint(buyer.address, ethers.utils.parseEther('10000'));

    return { escrowContract, tokenAEG, mockERC20, owner, buyer, seller, arbitrator, other };
  }

  beforeEach(async function () {
    ({ escrowContract, tokenAEG, mockERC20, owner, buyer, seller, arbitrator, other } = await loadFixture(deployContractsFixture));
  });

  describe('Deployment', function () {
    it('Should set the right owner', async function () {
      expect(await escrowContract.owner()).to.equal(owner.address);
    });

    it('Should have ETH allowed by default', async function () {
      expect(await escrowContract.allowedTokens(ethers.constants.AddressZero)).to.be.true;
    });

    it('Should have correct initial fees', async function () {
      expect(await escrowContract.escrowFee()).to.equal(25); // 0.25%
      expect(await escrowContract.disputeFee()).to.equal(100); // 1%
    });

    it('Should start with nextEscrowId = 1', async function () {
      expect(await escrowContract.nextEscrowId()).to.equal(1);
    });
  });

  describe('Token Management', function () {
    it('Should allow owner to add allowed token', async function () {
      const newToken = ethers.Wallet.createRandom().address;
      await expect(escrowContract.addAllowedToken(newToken))
        .to.emit(escrowContract, 'OwnershipTransferred'); // This might not emit, but transaction should succeed
      
      expect(await escrowContract.allowedTokens(newToken)).to.be.true;
    });

    it('Should allow owner to remove allowed token', async function () {
      await escrowContract.removeAllowedToken(ethers.constants.AddressZero);
      expect(await escrowContract.allowedTokens(ethers.constants.AddressZero)).to.be.false;
    });

    it('Should reject non-owner from adding tokens', async function () {
      const newToken = ethers.Wallet.createRandom().address;
      await expect(
        escrowContract.connect(buyer).addAllowedToken(newToken)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  describe('Creating Escrow with ETH', function () {
    const amount = ethers.utils.parseEther('1.0');
    const termsHash = 'QmTestHash123456789';

    it('Should create an escrow with ETH', async function () {
      const tx = await escrowContract.connect(buyer).createEscrow(
        seller.address,
        ethers.constants.AddressZero,
        termsHash,
        { value: amount }
      );

      await expect(tx)
        .to.emit(escrowContract, 'EscrowCreated')
        .withArgs(1, buyer.address, seller.address, amount, ethers.constants.AddressZero);

      const escrow = await escrowContract.getEscrow(1);
      expect(escrow.buyer).to.equal(buyer.address);
      expect(escrow.seller).to.equal(seller.address);
      expect(escrow.amount).to.equal(amount);
      expect(escrow.status).to.equal(0); // Active
      expect(escrow.tokenAddress).to.equal(ethers.constants.AddressZero);
    });

    it('Should increment escrow ID', async function () {
      await escrowContract.connect(buyer).createEscrow(
        seller.address,
        ethers.constants.AddressZero,
        termsHash,
        { value: amount }
      );

      expect(await escrowContract.nextEscrowId()).to.equal(2);
    });

    it('Should track user escrows', async function () {
      await escrowContract.connect(buyer).createEscrow(
        seller.address,
        ethers.constants.AddressZero,
        termsHash,
        { value: amount }
      );

      const buyerEscrows = await escrowContract.getUserEscrows(buyer.address);
      const sellerEscrows = await escrowContract.getUserEscrows(seller.address);

      expect(buyerEscrows.length).to.equal(1);
      expect(buyerEscrows[0]).to.equal(1);
      expect(sellerEscrows.length).to.equal(1);
      expect(sellerEscrows[0]).to.equal(1);
    });

    it('Should reject escrow with zero seller address', async function () {
      await expect(
        escrowContract.connect(buyer).createEscrow(
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          termsHash,
          { value: amount }
        )
      ).to.be.revertedWith('EscrowContract: invalid seller');
    });

    it('Should reject escrow with same buyer and seller', async function () {
      await expect(
        escrowContract.connect(buyer).createEscrow(
          buyer.address,
          ethers.constants.AddressZero,
          termsHash,
          { value: amount }
        )
      ).to.be.revertedWith('EscrowContract: cannot escrow with self');
    });

    it('Should reject escrow with zero ETH amount', async function () {
      await expect(
        escrowContract.connect(buyer).createEscrow(
          seller.address,
          ethers.constants.AddressZero,
          termsHash,
          { value: 0 }
        )
      ).to.be.revertedWith('EscrowContract: ETH amount must be positive');
    });

    it('Should reject escrow if ETH is not allowed', async function () {
      await escrowContract.removeAllowedToken(ethers.constants.AddressZero);
      
      await expect(
        escrowContract.connect(buyer).createEscrow(
          seller.address,
          ethers.constants.AddressZero,
          termsHash,
          { value: amount }
        )
      ).to.be.revertedWith('EscrowContract: ETH not allowed');
    });

    it('Should store terms hash', async function () {
      await escrowContract.connect(buyer).createEscrow(
        seller.address,
        ethers.constants.AddressZero,
        termsHash,
        { value: amount }
      );

      const escrow = await escrowContract.getEscrow(1);
      expect(escrow.termsHash).to.equal(termsHash);
    });

    it('Should allow arbitrator to be set', async function () {
      await escrowContract.connect(buyer).createEscrow(
        seller.address,
        arbitrator.address,
        termsHash,
        { value: amount }
      );

      const escrow = await escrowContract.getEscrow(1);
      expect(escrow.arbitrator).to.equal(arbitrator.address);
    });
  });

  describe('Creating Escrow with ERC20', function () {
    const amount = ethers.utils.parseEther('100');
    const termsHash = 'QmERC20Hash123456789';

    beforeEach(async function () {
      // Approve tokens
      await mockERC20.connect(buyer).approve(escrowContract.address, amount);
    });

    it('Should create an escrow with ERC20 token', async function () {
      const tx = await escrowContract.connect(buyer).createEscrowERC20(
        seller.address,
        ethers.constants.AddressZero,
        mockERC20.address,
        amount,
        termsHash
      );

      await expect(tx)
        .to.emit(escrowContract, 'EscrowCreated')
        .withArgs(1, buyer.address, seller.address, amount, mockERC20.address);

      const escrow = await escrowContract.getEscrow(1);
      expect(escrow.tokenAddress).to.equal(mockERC20.address);
      expect(escrow.amount).to.equal(amount);
    });

    it('Should transfer tokens from buyer to contract', async function () {
      const buyerBalanceBefore = await mockERC20.balanceOf(buyer.address);
      const contractBalanceBefore = await mockERC20.balanceOf(escrowContract.address);

      await escrowContract.connect(buyer).createEscrowERC20(
        seller.address,
        ethers.constants.AddressZero,
        mockERC20.address,
        amount,
        termsHash
      );

      const buyerBalanceAfter = await mockERC20.balanceOf(buyer.address);
      const contractBalanceAfter = await mockERC20.balanceOf(escrowContract.address);

      expect(buyerBalanceBefore.sub(buyerBalanceAfter)).to.equal(amount);
      expect(contractBalanceAfter.sub(contractBalanceBefore)).to.equal(amount);
    });

    it('Should reject ERC20 escrow with unallowed token', async function () {
      const unallowedToken = ethers.Wallet.createRandom().address;
      
      await expect(
        escrowContract.connect(buyer).createEscrowERC20(
          seller.address,
          ethers.constants.AddressZero,
          unallowedToken,
          amount,
          termsHash
        )
      ).to.be.revertedWith('EscrowContract: token not allowed');
    });

    it('Should reject ERC20 escrow with zero token address', async function () {
      await expect(
        escrowContract.connect(buyer).createEscrowERC20(
          seller.address,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          amount,
          termsHash
        )
      ).to.be.revertedWith('EscrowContract: invalid token address');
    });

    it('Should reject ERC20 escrow with insufficient allowance', async function () {
      await mockERC20.connect(buyer).approve(escrowContract.address, amount.div(2));
      
      await expect(
        escrowContract.connect(buyer).createEscrowERC20(
          seller.address,
          ethers.constants.AddressZero,
          mockERC20.address,
          amount,
          termsHash
        )
      ).to.be.reverted;
    });
  });

  describe('Confirming Escrow', function () {
    const amount = ethers.utils.parseEther('1.0');
    const termsHash = 'QmConfirmHash123';

    beforeEach(async function () {
      await escrowContract.connect(buyer).createEscrow(
        seller.address,
        ethers.constants.AddressZero,
        termsHash,
        { value: amount }
      );
    });

    it('Should allow buyer to confirm', async function () {
      await expect(
        escrowContract.connect(buyer).confirmCompletion(1)
      ).to.emit(escrowContract, 'ConfirmationUpdated')
        .withArgs(1, buyer.address, true);

      const escrow = await escrowContract.getEscrow(1);
      expect(escrow.buyerConfirmed).to.be.true;
    });

    it('Should allow seller to confirm', async function () {
      await expect(
        escrowContract.connect(seller).confirmCompletion(1)
      ).to.emit(escrowContract, 'ConfirmationUpdated')
        .withArgs(1, seller.address, true);

      const escrow = await escrowContract.getEscrow(1);
      expect(escrow.sellerConfirmed).to.be.true;
    });

    it('Should complete escrow when both parties confirm', async function () {
      await escrowContract.connect(buyer).confirmCompletion(1);
      
      const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
      
      const tx = await escrowContract.connect(seller).confirmCompletion(1);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);

      await expect(tx)
        .to.emit(escrowContract, 'EscrowCompleted')
        .withArgs(1, seller.address);

      const escrow = await escrowContract.getEscrow(1);
      expect(escrow.status).to.equal(1); // Completed
      expect(escrow.completedAt).to.be.gt(0);

      // Check seller received funds (minus fee)
      const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
      const fee = amount.mul(25).div(10000); // 0.25%
      const expectedPayout = amount.sub(fee);
      expect(sellerBalanceAfter.sub(sellerBalanceBefore).add(gasUsed)).to.be.closeTo(
        expectedPayout,
        ethers.utils.parseEther('0.01')
      );
    });

    it('Should reject confirmation from unauthorized address', async function () {
      await expect(
        escrowContract.connect(other).confirmCompletion(1)
      ).to.be.revertedWith('EscrowContract: not authorized');
    });

    it('Should reject confirmation for non-active escrow', async function () {
      await escrowContract.connect(buyer).confirmCompletion(1);
      await escrowContract.connect(seller).confirmCompletion(1);

      await expect(
        escrowContract.connect(buyer).confirmCompletion(1)
      ).to.be.revertedWith('EscrowContract: escrow not active');
    });
  });

  describe('Dispute Creation', function () {
    const amount = ethers.utils.parseEther('1.0');
    const termsHash = 'QmDisputeHash123';
    const evidenceHash = 'QmEvidenceHash123';

    beforeEach(async function () {
      await escrowContract.connect(buyer).createEscrow(
        seller.address,
        ethers.constants.AddressZero,
        termsHash,
        { value: amount }
      );
    });

    it('Should allow buyer to create dispute', async function () {
      // Deploy and set DisputeContract
      const DisputeContract = await ethers.getContractFactory('DisputeContract');
      const disputeContract = await DisputeContract.deploy(tokenAEG.address);
      await disputeContract.deployed();

      await escrowContract.setDisputeContract(disputeContract.address);
      await disputeContract.setEscrowContract(escrowContract.address);

      // Register jurors first
      const stake = ethers.utils.parseEther('1000');
      await tokenAEG.mint(buyer.address, stake);
      await tokenAEG.connect(buyer).approve(disputeContract.address, stake);
      await disputeContract.connect(buyer).registerJuror(stake);

      await tokenAEG.mint(seller.address, stake);
      await tokenAEG.connect(seller).approve(disputeContract.address, stake);
      await disputeContract.connect(seller).registerJuror(stake);

      await tokenAEG.mint(other.address, stake);
      await tokenAEG.connect(other).approve(disputeContract.address, stake);
      await disputeContract.connect(other).registerJuror(stake);

      const tx = await escrowContract.connect(buyer).createDispute(1, evidenceHash);
      
      await expect(tx)
        .to.emit(escrowContract, 'EscrowDisputed');

      const escrow = await escrowContract.getEscrow(1);
      expect(escrow.status).to.equal(2); // Disputed
      expect(escrow.evidenceHash).to.equal(evidenceHash);
    });

    it('Should reject dispute creation from unauthorized address', async function () {
      await expect(
        escrowContract.connect(other).createDispute(1, evidenceHash)
      ).to.be.revertedWith('EscrowContract: not authorized');
    });

    it('Should reject dispute for non-active escrow', async function () {
      await escrowContract.connect(buyer).confirmCompletion(1);
      await escrowContract.connect(seller).confirmCompletion(1);

      await expect(
        escrowContract.connect(buyer).createDispute(1, evidenceHash)
      ).to.be.revertedWith('EscrowContract: escrow not active');
    });
  });

  describe('Cancelling Escrow', function () {
    const amount = ethers.utils.parseEther('1.0');
    const termsHash = 'QmCancelHash123';

    beforeEach(async function () {
      await escrowContract.connect(buyer).createEscrow(
        seller.address,
        ethers.constants.AddressZero,
        termsHash,
        { value: amount }
      );
    });

    it('Should allow buyer to cancel', async function () {
      const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
      
      const tx = await escrowContract.connect(buyer).cancelEscrow(1);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);

      await expect(tx)
        .to.emit(escrowContract, 'EscrowCancelled')
        .withArgs(1);

      const escrow = await escrowContract.getEscrow(1);
      expect(escrow.status).to.equal(3); // Cancelled

      // Check buyer received refund
      const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
      expect(buyerBalanceAfter.sub(buyerBalanceBefore).add(gasUsed)).to.be.closeTo(
        amount,
        ethers.utils.parseEther('0.01')
      );
    });

    it('Should allow seller to cancel', async function () {
      await expect(
        escrowContract.connect(seller).cancelEscrow(1)
      ).to.emit(escrowContract, 'EscrowCancelled');
    });

    it('Should allow owner to cancel', async function () {
      await expect(
        escrowContract.connect(owner).cancelEscrow(1)
      ).to.emit(escrowContract, 'EscrowCancelled');
    });

    it('Should reject cancellation from unauthorized address', async function () {
      await expect(
        escrowContract.connect(other).cancelEscrow(1)
      ).to.be.revertedWith('EscrowContract: not authorized');
    });

    it('Should reject cancellation for non-active escrow', async function () {
      await escrowContract.connect(buyer).confirmCompletion(1);
      await escrowContract.connect(seller).confirmCompletion(1);

      await expect(
        escrowContract.connect(buyer).cancelEscrow(1)
      ).to.be.revertedWith('EscrowContract: escrow not active');
    });
  });

  describe('Fee Management', function () {
    it('Should allow owner to update fees', async function () {
      await escrowContract.updateFees(50, 200);
      expect(await escrowContract.escrowFee()).to.equal(50);
      expect(await escrowContract.disputeFee()).to.equal(200);
    });

    it('Should reject fee update from non-owner', async function () {
      await expect(
        escrowContract.connect(buyer).updateFees(50, 200)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should reject escrow fee above 5%', async function () {
      await expect(
        escrowContract.updateFees(501, 200)
      ).to.be.revertedWith('EscrowContract: escrow fee too high');
    });

    it('Should reject dispute fee above 10%', async function () {
      await expect(
        escrowContract.updateFees(50, 1001)
      ).to.be.revertedWith('EscrowContract: dispute fee too high');
    });
  });

  describe('Dispute Resolution', function () {
    const amount = ethers.utils.parseEther('1.0');
    const termsHash = 'QmResolveHash123';

    beforeEach(async function () {
      await escrowContract.connect(buyer).createEscrow(
        seller.address,
        ethers.constants.AddressZero,
        termsHash,
        { value: amount }
      );
    });

    it('Should allow DisputeContract to resolve dispute', async function () {
      // Deploy DisputeContract
      const DisputeContract = await ethers.getContractFactory('DisputeContract');
      const disputeContract = await DisputeContract.deploy(tokenAEG.address);
      await disputeContract.deployed();

      await escrowContract.setDisputeContract(disputeContract.address);
      await disputeContract.setEscrowContract(escrowContract.address);

      // Create dispute
      const evidenceHash = 'QmEvidence123';
      await escrowContract.connect(buyer).createDispute(1, evidenceHash);

      // Resolve dispute
      await escrowContract.connect(disputeContract.address).resolveDispute(1, seller.address);

      const escrow = await escrowContract.getEscrow(1);
      expect(escrow.status).to.equal(1); // Completed
    });

    it('Should reject resolution from unauthorized address', async function () {
      await expect(
        escrowContract.connect(other).resolveDispute(1, seller.address)
      ).to.be.revertedWith('EscrowContract: not authorized');
    });
  });
});
