const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture, time } = require('@nomicfoundation/hardhat-network-helpers');

describe('GovernanceContract', function () {
  let governanceContract;
  let tokenAEG;
  let timelockController;
  let owner;
  let voter1;
  let voter2;
  let voter3;
  let proposer;

  async function deployGovernanceFixture() {
    [owner, voter1, voter2, voter3, proposer] = await ethers.getSigners();

    // Deploy TokenAEG
    const TokenAEG = await ethers.getContractFactory('TokenAEG');
    tokenAEG = await TokenAEG.deploy();
    await tokenAEG.deployed();

    // Deploy TimelockController
    const minDelay = 2 * 24 * 60 * 60; // 2 days
    const proposers = [owner.address];
    const executors = [owner.address];
    
    const TimelockController = await ethers.getContractFactory('TimelockController');
    timelockController = await TimelockController.deploy(
      minDelay,
      proposers,
      executors,
      owner.address
    );
    await timelockController.deployed();

    // Deploy GovernanceContract
    const votingDelay = 1; // 1 block
    const votingPeriod = 3 * 24 * 60 * 60; // 3 days
    const proposalThreshold = ethers.utils.parseEther('100000'); // 100k tokens
    const quorumPercentage = 4; // 4%

    const GovernanceContract = await ethers.getContractFactory('GovernanceContract');
    governanceContract = await GovernanceContract.deploy(
      tokenAEG.address,
      timelockController.address,
      votingDelay,
      votingPeriod,
      proposalThreshold,
      quorumPercentage
    );
    await governanceContract.deployed();

    // Grant proposer and executor roles
    const PROPOSER_ROLE = await timelockController.PROPOSER_ROLE();
    const EXECUTOR_ROLE = await timelockController.EXECUTOR_ROLE();
    const TIMELOCK_ADMIN_ROLE = await timelockController.TIMELOCK_ADMIN_ROLE();

    await timelockController.grantRole(PROPOSER_ROLE, governanceContract.address);
    await timelockController.grantRole(EXECUTOR_ROLE, governanceContract.address);
    await timelockController.grantRole(TIMELOCK_ADMIN_ROLE, owner.address);

    // Mint tokens to voters
    const voterAmount = ethers.utils.parseEther('1000000');
    await tokenAEG.mint(voter1.address, voterAmount);
    await tokenAEG.mint(voter2.address, voterAmount);
    await tokenAEG.mint(voter3.address, voterAmount);
    await tokenAEG.mint(proposer.address, voterAmount);

    return { governanceContract, tokenAEG, timelockController, owner, voter1, voter2, voter3, proposer };
  }

  beforeEach(async function () {
    ({ governanceContract, tokenAEG, timelockController, owner, voter1, voter2, voter3, proposer } = await loadFixture(deployGovernanceFixture));
  });

  describe('Deployment', function () {
    it('Should set the correct name', async function () {
      expect(await governanceContract.name()).to.equal('AegoraDAO');
    });

    it('Should set the correct token', async function () {
      expect(await governanceContract.token()).to.equal(tokenAEG.address);
    });

    it('Should set the correct timelock', async function () {
      expect(await governanceContract.timelock()).to.equal(timelockController.address);
    });

    it('Should have correct voting settings', async function () {
      expect(await governanceContract.votingDelay()).to.equal(1);
      expect(await governanceContract.votingPeriod()).to.equal(3 * 24 * 60 * 60);
      expect(await governanceContract.proposalThreshold()).to.equal(ethers.utils.parseEther('100000'));
    });
  });

  describe('Proposal Creation', function () {
    const proposalThreshold = ethers.utils.parseEther('100000');

    beforeEach(async function () {
      // Delegate voting power
      await tokenAEG.connect(voter1).delegate(voter1.address);
      await tokenAEG.connect(voter2).delegate(voter2.address);
      await tokenAEG.connect(voter3).delegate(voter3.address);
      await tokenAEG.connect(proposer).delegate(proposer.address);
    });

    it('Should allow creating proposal with metadata', async function () {
      const targets = [tokenAEG.address];
      const values = [0];
      const calldatas = [tokenAEG.interface.encodeFunctionData('pause', [])];
      const description = 'Test proposal';
      const proposalType = 0; // ParameterUpdate
      const ipfsHash = 'QmTestHash123';

      await tokenAEG.connect(proposer).delegate(proposer.address);
      
      // Wait for voting delay
      await time.advanceBlock();

      const tx = await governanceContract.connect(proposer).proposeWithMetadata(
        targets,
        values,
        calldatas,
        description,
        proposalType,
        ipfsHash
      );

      await expect(tx)
        .to.emit(governanceContract, 'ProposalCreatedWithMetadata');

      const receipt = await tx.wait();
      const proposalCreatedEvent = receipt.events.find(e => e.event === 'ProposalCreated');
      const proposalId = proposalCreatedEvent.args.proposalId;

      const metadata = await governanceContract.proposalMetadata(proposalId);
      expect(metadata.proposalType).to.equal(proposalType);
      expect(metadata.description).to.equal(description);
      expect(metadata.ipfsHash).to.equal(ipfsHash);
    });

    it('Should reject proposal below threshold', async function () {
      const lowBalance = ethers.utils.parseEther('10000');
      await tokenAEG.mint(other.address, lowBalance);
      await tokenAEG.connect(other).delegate(other.address);

      const targets = [tokenAEG.address];
      const values = [0];
      const calldatas = [tokenAEG.interface.encodeFunctionData('pause', [])];
      const description = 'Test proposal';

      await time.advanceBlock();

      await expect(
        governanceContract.connect(other).proposeWithMetadata(
          targets,
          values,
          calldatas,
          description,
          0,
          'QmHash'
        )
      ).to.be.revertedWith('Governor: proposer votes below proposal threshold');
    });
  });

  describe('Voting', function () {
    let proposalId;

    beforeEach(async function () {
      // Delegate voting power
      await tokenAEG.connect(voter1).delegate(voter1.address);
      await tokenAEG.connect(voter2).delegate(voter2.address);
      await tokenAEG.connect(voter3).delegate(voter3.address);
      await tokenAEG.connect(proposer).delegate(proposer.address);

      // Create proposal
      const targets = [tokenAEG.address];
      const values = [0];
      const calldatas = [tokenAEG.interface.encodeFunctionData('pause', [])];
      const description = 'Test proposal';

      await time.advanceBlock();

      const tx = await governanceContract.connect(proposer).proposeWithMetadata(
        targets,
        values,
        calldatas,
        description,
        0,
        'QmHash'
      );

      const receipt = await tx.wait();
      const proposalCreatedEvent = receipt.events.find(e => e.event === 'ProposalCreated');
      proposalId = proposalCreatedEvent.args.proposalId;

      // Wait for voting delay
      await time.advanceBlock();
    });

    it('Should allow voting for proposal', async function () {
      await expect(
        governanceContract.connect(voter1).castVote(proposalId, 1) // For
      ).to.emit(governanceContract, 'VoteCast')
        .withArgs(voter1.address, proposalId, 1, ethers.utils.parseEther('1000000'), '');
    });

    it('Should allow voting against proposal', async function () {
      await expect(
        governanceContract.connect(voter2).castVote(proposalId, 0) // Against
      ).to.emit(governanceContract, 'VoteCast');
    });

    it('Should allow abstaining', async function () {
      await expect(
        governanceContract.connect(voter3).castVote(proposalId, 2) // Abstain
      ).to.emit(governanceContract, 'VoteCast');
    });

    it('Should reject voting after voting period', async function () {
      await time.increase(await governanceContract.votingPeriod() + 1);

      await expect(
        governanceContract.connect(voter1).castVote(proposalId, 1)
      ).to.be.revertedWith('Governor: vote not currently active');
    });

    it('Should reject voting before voting starts', async function () {
      // Create new proposal
      const targets = [tokenAEG.address];
      const values = [0];
      const calldatas = [tokenAEG.interface.encodeFunctionData('pause', [])];
      const description = 'Test proposal 2';

      const tx = await governanceContract.connect(proposer).proposeWithMetadata(
        targets,
        values,
        calldatas,
        description,
        0,
        'QmHash2'
      );

      const receipt = await tx.wait();
      const proposalCreatedEvent = receipt.events.find(e => e.event === 'ProposalCreated');
      const newProposalId = proposalCreatedEvent.args.proposalId;

      await expect(
        governanceContract.connect(voter1).castVote(newProposalId, 1)
      ).to.be.revertedWith('Governor: vote not currently active');
    });
  });

  describe('Proposal Execution', function () {
    let proposalId;

    beforeEach(async function () {
      // Delegate voting power
      await tokenAEG.connect(voter1).delegate(voter1.address);
      await tokenAEG.connect(voter2).delegate(voter2.address);
      await tokenAEG.connect(voter3).delegate(voter3.address);
      await tokenAEG.connect(proposer).delegate(proposer.address);

      // Create and vote on proposal
      const targets = [tokenAEG.address];
      const values = [0];
      const calldatas = [tokenAEG.interface.encodeFunctionData('pause', [])];
      const description = 'Test proposal';

      await time.advanceBlock();

      const tx = await governanceContract.connect(proposer).proposeWithMetadata(
        targets,
        values,
        calldatas,
        description,
        0,
        'QmHash'
      );

      const receipt = await tx.wait();
      const proposalCreatedEvent = receipt.events.find(e => e.event === 'ProposalCreated');
      proposalId = proposalCreatedEvent.args.proposalId;

      // Wait for voting delay and vote
      await time.advanceBlock();
      await governanceContract.connect(voter1).castVote(proposalId, 1);
      await governanceContract.connect(voter2).castVote(proposalId, 1);
      await governanceContract.connect(voter3).castVote(proposalId, 1);

      // Wait for voting period to end
      await time.increase(await governanceContract.votingPeriod() + 1);
    });

    it('Should queue proposal after successful vote', async function () {
      const targets = [tokenAEG.address];
      const values = [0];
      const calldatas = [tokenAEG.interface.encodeFunctionData('pause', [])];
      const descriptionHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(description));

      await expect(
        governanceContract.queue(targets, values, calldatas, descriptionHash)
      ).to.emit(governanceContract, 'ProposalQueued')
        .withArgs(proposalId, await timelockController.getMinDelay());
    });

    it('Should execute proposal after timelock delay', async function () {
      const targets = [tokenAEG.address];
      const values = [0];
      const calldatas = [tokenAEG.interface.encodeFunctionData('pause', [])];
      const descriptionHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('Test proposal'));

      // Queue proposal
      await governanceContract.queue(targets, values, calldatas, descriptionHash);

      // Wait for timelock delay
      const minDelay = await timelockController.getMinDelay();
      await time.increase(minDelay + 1);

      // Execute proposal
      await expect(
        governanceContract.execute(targets, values, calldatas, descriptionHash)
      ).to.emit(governanceContract, 'ProposalExecuted')
        .withArgs(proposalId);

      // Verify token is paused
      expect(await tokenAEG.paused()).to.be.true;
    });
  });

  describe('Proposal Counting', function () {
    it('Should return correct proposal count', async function () {
      // Create multiple proposals
      await tokenAEG.connect(proposer).delegate(proposer.address);
      
      for (let i = 0; i < 3; i++) {
        await time.advanceBlock();
        const targets = [tokenAEG.address];
        const values = [0];
        const calldatas = [tokenAEG.interface.encodeFunctionData('pause', [])];
        const description = `Proposal ${i}`;

        await governanceContract.connect(proposer).proposeWithMetadata(
          targets,
          values,
          calldatas,
          description,
          0,
          `QmHash${i}`
        );
      }

      const count = await governanceContract.proposalCount();
      expect(count).to.be.gte(3);
    });
  });
});

