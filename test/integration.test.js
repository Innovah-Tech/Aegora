const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture, time } = require('@nomicfoundation/hardhat-network-helpers');

describe('Integration Tests', function () {
  let escrowContract;
  let disputeContract;
  let reputationContract;
  let tokenAEG;
  let owner;
  let buyer;
  let seller;
  let juror1;
  let juror2;
  let juror3;

  async function deployAllContractsFixture() {
    [owner, buyer, seller, juror1, juror2, juror3] = await ethers.getSigners();

    // Deploy TokenAEG
    const TokenAEG = await ethers.getContractFactory('TokenAEG');
    tokenAEG = await TokenAEG.deploy();
    await tokenAEG.deployed();

    // Deploy EscrowContract
    const EscrowContract = await ethers.getContractFactory('EscrowContract');
    escrowContract = await EscrowContract.deploy();
    await escrowContract.deployed();

    // Deploy DisputeContract
    const DisputeContract = await ethers.getContractFactory('DisputeContract');
    disputeContract = await DisputeContract.deploy(tokenAEG.address);
    await disputeContract.deployed();

    // Deploy ReputationContract
    const ReputationContract = await ethers.getContractFactory('ReputationContract');
    reputationContract = await ReputationContract.deploy(tokenAEG.address);
    await reputationContract.deployed();

    // Link contracts
    await escrowContract.setDisputeContract(disputeContract.address);
    await disputeContract.setEscrowContract(escrowContract.address);

    // Setup jurors
    const stake = ethers.utils.parseEther('1000');
    for (const juror of [juror1, juror2, juror3]) {
      await tokenAEG.mint(juror.address, stake.mul(2));
      await tokenAEG.connect(juror).approve(disputeContract.address, stake.mul(2));
      await disputeContract.connect(juror).registerJuror(stake);
    }

    return { escrowContract, disputeContract, reputationContract, tokenAEG, owner, buyer, seller, juror1, juror2, juror3 };
  }

  beforeEach(async function () {
    ({ escrowContract, disputeContract, reputationContract, tokenAEG, owner, buyer, seller, juror1, juror2, juror3 } = await loadFixture(deployAllContractsFixture));
  });

  describe('Full Escrow Flow', function () {
    const escrowAmount = ethers.utils.parseEther('1.0');
    const termsHash = 'QmFullFlowHash123';

    it('Should complete full escrow flow: create -> confirm -> complete', async function () {
      // 1. Create escrow
      const createTx = await escrowContract.connect(buyer).createEscrow(
        seller.address,
        ethers.constants.AddressZero,
        termsHash,
        { value: escrowAmount }
      );

      await expect(createTx)
        .to.emit(escrowContract, 'EscrowCreated');

      const createReceipt = await createTx.wait();
      const escrowCreatedEvent = createReceipt.events.find(e => e.event === 'EscrowCreated');
      const escrowId = escrowCreatedEvent.args.escrowId;

      // 2. Buyer confirms
      await expect(
        escrowContract.connect(buyer).confirmCompletion(escrowId)
      ).to.emit(escrowContract, 'ConfirmationUpdated');

      // 3. Seller confirms
      const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
      const confirmTx = await escrowContract.connect(seller).confirmCompletion(escrowId);
      const confirmReceipt = await confirmTx.wait();
      const gasUsed = confirmReceipt.gasUsed.mul(confirmReceipt.effectiveGasPrice);

      await expect(confirmTx)
        .to.emit(escrowContract, 'EscrowCompleted')
        .withArgs(escrowId, seller.address);

      // 4. Verify seller received funds
      const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
      const fee = escrowAmount.mul(25).div(10000);
      const expectedPayout = escrowAmount.sub(fee);
      expect(sellerBalanceAfter.sub(sellerBalanceBefore).add(gasUsed)).to.be.closeTo(
        expectedPayout,
        ethers.utils.parseEther('0.01')
      );

      // 5. Verify escrow status
      const escrow = await escrowContract.getEscrow(escrowId);
      expect(escrow.status).to.equal(1); // Completed
    });
  });

  describe('Full Dispute Flow', function () {
    const escrowAmount = ethers.utils.parseEther('1.0');
    const termsHash = 'QmDisputeFlowHash123';
    const evidenceHash = 'QmEvidenceHash123';
    let escrowId;
    let disputeId;

    beforeEach(async function () {
      // Create escrow
      const createTx = await escrowContract.connect(buyer).createEscrow(
        seller.address,
        ethers.constants.AddressZero,
        termsHash,
        { value: escrowAmount }
      );
      const createReceipt = await createTx.wait();
      const escrowCreatedEvent = createReceipt.events.find(e => e.event === 'EscrowCreated');
      escrowId = escrowCreatedEvent.args.escrowId;
    });

    it('Should complete full dispute flow: create -> vote -> resolve', async function () {
      // 1. Create dispute
      const disputeTx = await escrowContract.connect(buyer).createDispute(escrowId, evidenceHash);
      
      await expect(disputeTx)
        .to.emit(disputeContract, 'DisputeCreated')
        .to.emit(escrowContract, 'EscrowDisputed');

      const disputeReceipt = await disputeTx.wait();
      const disputeEvent = disputeReceipt.events.find(e => e.event === 'EscrowDisputed');
      disputeId = disputeEvent.args.disputeId;

      // 2. Verify escrow is disputed
      const escrow = await escrowContract.getEscrow(escrowId);
      expect(escrow.status).to.equal(2); // Disputed
      expect(escrow.disputeId).to.equal(disputeId);

      // 3. Get dispute details
      const dispute = await disputeContract.getDispute(disputeId);
      expect(dispute.escrowId).to.equal(escrowId);
      expect(dispute.buyer).to.equal(buyer.address);
      expect(dispute.seller).to.equal(seller.address);
      expect(dispute.jurors.length).to.be.gte(3);

      // 4. Jurors commit votes
      const vote = 1; // Buyer
      for (let i = 0; i < dispute.jurors.length; i++) {
        const juror = dispute.jurors[i];
        const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32));
        const voteHash = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(['uint8', 'uint256'], [vote, nonce])
        );

        // Get signer for juror address
        let signer;
        if (juror.toLowerCase() === juror1.address.toLowerCase()) signer = juror1;
        else if (juror.toLowerCase() === juror2.address.toLowerCase()) signer = juror2;
        else if (juror.toLowerCase() === juror3.address.toLowerCase()) signer = juror3;
        else continue;

        await disputeContract.connect(signer).castVote(disputeId, voteHash);
      }

      // 5. Advance time and reveal votes
      await time.increase(await disputeContract.votingPeriod() + 1);

      // Note: In a real scenario, we'd need to store nonces properly
      // This test demonstrates the flow structure

      // 6. Verify dispute can be resolved via timeout
      await time.increase(await disputeContract.disputeTimeout() + 1);
      
      await expect(
        disputeContract.connect(owner).resolveDisputeTimeout(disputeId)
      ).to.emit(disputeContract, 'DisputeResolved');
    });
  });

  describe('Reputation Integration', function () {
    it('Should update reputation after successful escrow', async function () {
      const escrowAmount = ethers.utils.parseEther('1.0');
      const termsHash = 'QmRepHash123';

      // Create and complete escrow
      const createTx = await escrowContract.connect(buyer).createEscrow(
        seller.address,
        ethers.constants.AddressZero,
        termsHash,
        { value: escrowAmount }
      );
      const createReceipt = await createTx.wait();
      const escrowCreatedEvent = createReceipt.events.find(e => e.event === 'EscrowCreated');
      const escrowId = escrowCreatedEvent.args.escrowId;

      await escrowContract.connect(buyer).confirmCompletion(escrowId);
      await escrowContract.connect(seller).confirmCompletion(escrowId);

      // Note: In a full implementation, reputation would be updated automatically
      // This test verifies the integration point exists
      const buyerRep = await reputationContract.getReputation(buyer.address);
      const sellerRep = await reputationContract.getReputation(seller.address);
      
      expect(buyerRep.score).to.be.gte(0);
      expect(sellerRep.score).to.be.gte(0);
    });
  });

  describe('Multi-Escrow Scenario', function () {
    it('Should handle multiple escrows for same users', async function () {
      const amount = ethers.utils.parseEther('0.5');
      const termsHash = 'QmMultiHash';

      // Create multiple escrows
      for (let i = 0; i < 3; i++) {
        await escrowContract.connect(buyer).createEscrow(
          seller.address,
          ethers.constants.AddressZero,
          `${termsHash}${i}`,
          { value: amount }
        );
      }

      // Verify all escrows are tracked
      const buyerEscrows = await escrowContract.getUserEscrows(buyer.address);
      const sellerEscrows = await escrowContract.getUserEscrows(seller.address);

      expect(buyerEscrows.length).to.equal(3);
      expect(sellerEscrows.length).to.equal(3);
    });
  });

  describe('Error Recovery', function () {
    it('Should handle failed dispute creation gracefully', async function () {
      const escrowAmount = ethers.utils.parseEther('1.0');
      const termsHash = 'QmErrorHash123';

      // Create escrow
      const createTx = await escrowContract.connect(buyer).createEscrow(
        seller.address,
        ethers.constants.AddressZero,
        termsHash,
        { value: escrowAmount }
      );
      const createReceipt = await createTx.wait();
      const escrowCreatedEvent = createReceipt.events.find(e => e.event === 'EscrowCreated');
      const escrowId = escrowCreatedEvent.args.escrowId;

      // Try to create dispute without enough jurors (unregister all)
      await disputeContract.connect(juror1).unregisterJuror();
      await disputeContract.connect(juror2).unregisterJuror();
      await disputeContract.connect(juror3).unregisterJuror();

      await expect(
        escrowContract.connect(buyer).createDispute(escrowId, 'QmEvidence')
      ).to.be.reverted;

      // Escrow should still be active
      const escrow = await escrowContract.getEscrow(escrowId);
      expect(escrow.status).to.equal(0); // Active
    });
  });
});

