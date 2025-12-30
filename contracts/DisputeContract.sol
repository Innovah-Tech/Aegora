// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./TokenAEG.sol";

/**
 * @title DisputeContract
 * @dev Handles dispute resolution through decentralized arbitration
 */
contract DisputeContract is ReentrancyGuard, Ownable {
    enum DisputeStatus { Pending, InProgress, Resolved, Cancelled }
    enum Vote { None, Buyer, Seller }
    
    struct Dispute {
        uint256 escrowId;
        address buyer;
        address seller;
        address[] jurors;
        DisputeStatus status;
        uint256 createdAt;
        uint256 resolvedAt;
        string evidenceHash;
        Vote[] votes;
        uint256 buyerVotes;
        uint256 sellerVotes;
        uint256 totalStake;
        mapping(address => bool) hasVoted;
        mapping(address => bytes32) voteHashes; // Store vote hashes for commit-reveal
        mapping(address => uint256) jurorStake;
    }
    
    struct Juror {
        address juror;
        uint256 stake;
        uint256 reputation;
        bool isActive;
        uint256 lastActive;
    }
    
    // Dispute ID => Dispute details
    mapping(uint256 => Dispute) public disputes;
    
    // Juror address => Juror details
    mapping(address => Juror) public jurors;
    
    // Active jurors list
    address[] public activeJurors;
    
    // Dispute parameters
    uint256 public minJurorStake = 1000 * 10**18; // 1000 AEG tokens
    uint256 public maxJurorsPerDispute = 5;
    uint256 public minJurorsPerDispute = 3;
    uint256 public disputeTimeout = 7 days;
    uint256 public votingPeriod = 3 days;
    uint256 public revealPeriod = 1 days;
    
    uint256 public nextDisputeId = 1;
    
    TokenAEG public aegToken;
    
    // Events
    event DisputeCreated(uint256 indexed disputeId, uint256 indexed escrowId);
    event JurorRegistered(address indexed juror, uint256 stake);
    event JurorUnregistered(address indexed juror);
    event VoteCast(uint256 indexed disputeId, address indexed juror, Vote vote);
    event DisputeResolved(uint256 indexed disputeId, address winner);
    event JurorRewarded(address indexed juror, uint256 amount);
    event JurorPenalized(address indexed juror, uint256 amount);
    
    constructor(address _aegToken) {
        aegToken = TokenAEG(_aegToken);
    }
    
    /**
     * @dev Register as a juror
     * @param stake Amount of AEG tokens to stake
     */
    function registerJuror(uint256 stake) external nonReentrant {
        require(stake >= minJurorStake, "DisputeContract: stake too low");
        require(!jurors[msg.sender].isActive, "DisputeContract: already registered");
        
        // Transfer tokens to contract
        aegToken.transferFrom(msg.sender, address(this), stake);
        
        jurors[msg.sender] = Juror({
            juror: msg.sender,
            stake: stake,
            reputation: 100, // Start with 100 reputation points
            isActive: true,
            lastActive: block.timestamp
        });
        
        activeJurors.push(msg.sender);
        
        emit JurorRegistered(msg.sender, stake);
    }
    
    /**
     * @dev Unregister as a juror
     */
    function unregisterJuror() external nonReentrant {
        require(jurors[msg.sender].isActive, "DisputeContract: not registered");
        
        jurors[msg.sender].isActive = false;
        
        // Return staked tokens
        aegToken.transfer(msg.sender, jurors[msg.sender].stake);
        
        // Remove from active jurors list
        for (uint256 i = 0; i < activeJurors.length; i++) {
            if (activeJurors[i] == msg.sender) {
                activeJurors[i] = activeJurors[activeJurors.length - 1];
                activeJurors.pop();
                break;
            }
        }
        
        emit JurorUnregistered(msg.sender);
    }
    
    // Address of EscrowContract (can be set by owner)
    address public escrowContract;
    
    /**
     * @dev Set the EscrowContract address
     * @param _escrowContract Address of the EscrowContract
     */
    function setEscrowContract(address _escrowContract) external onlyOwner {
        require(_escrowContract != address(0), "DisputeContract: invalid escrow contract");
        escrowContract = _escrowContract;
    }
    
    /**
     * @dev Create a new dispute
     * @param escrowId ID of the escrow
     * @param buyer Address of the buyer
     * @param seller Address of the seller
     * @param evidenceHash IPFS hash of evidence
     */
    function createDispute(
        uint256 escrowId,
        address buyer,
        address seller,
        string memory evidenceHash
    ) external returns (uint256) {
        require(msg.sender == escrowContract || msg.sender == owner(), "DisputeContract: not authorized");
        require(buyer != address(0) && seller != address(0), "DisputeContract: invalid addresses");
        require(buyer != seller, "DisputeContract: buyer and seller must be different");
        require(activeJurors.length >= minJurorsPerDispute, "DisputeContract: not enough jurors");
        
        uint256 disputeId = nextDisputeId++;
        
        // Select random jurors (improved randomness)
        address[] memory selectedJurors = _selectRandomJurors();
        
        Dispute storage dispute = disputes[disputeId];
        dispute.escrowId = escrowId;
        dispute.buyer = buyer;
        dispute.seller = seller;
        dispute.jurors = selectedJurors;
        dispute.status = DisputeStatus.InProgress;
        dispute.createdAt = block.timestamp;
        dispute.evidenceHash = evidenceHash;
        dispute.votes = new Vote[](selectedJurors.length);
        
        // Calculate total stake
        for (uint256 i = 0; i < selectedJurors.length; i++) {
            dispute.totalStake += jurors[selectedJurors[i]].stake;
        }
        
        emit DisputeCreated(disputeId, escrowId);
        
        // Notify EscrowContract about the dispute ID (if escrowContract is set)
        if (escrowContract != address(0)) {
            (bool success, ) = escrowContract.call(
                abi.encodeWithSignature("setDisputeId(uint256,uint256)", escrowId, disputeId)
            );
            // Don't fail if this call fails, dispute is already created
            if (!success) {
                // Log but continue - dispute is created successfully
            }
        }
        
        return disputeId;
    }
    
    /**
     * @dev Cast a vote (commit phase)
     * @param disputeId ID of the dispute
     * @param voteHash Hash of the vote (keccak256(abi.encodePacked(vote, nonce)))
     */
    function castVote(uint256 disputeId, bytes32 voteHash) external {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.status == DisputeStatus.InProgress, "DisputeContract: dispute not in progress");
        require(block.timestamp <= dispute.createdAt + votingPeriod, "DisputeContract: voting period ended");
        
        // Check if sender is a juror
        bool isJuror = false;
        for (uint256 i = 0; i < dispute.jurors.length; i++) {
            if (dispute.jurors[i] == msg.sender) {
                isJuror = true;
                break;
            }
        }
        require(isJuror, "DisputeContract: not a juror");
        require(!dispute.hasVoted[msg.sender], "DisputeContract: already voted");
        require(voteHash != bytes32(0), "DisputeContract: invalid vote hash");
        
        // Store the vote hash for later verification
        dispute.voteHashes[msg.sender] = voteHash;
        dispute.hasVoted[msg.sender] = true;
        
        emit VoteCast(disputeId, msg.sender, Vote.None); // Vote.None for commit phase
    }
    
    /**
     * @dev Reveal vote
     * @param disputeId ID of the dispute
     * @param vote The actual vote
     * @param nonce Nonce used in commit phase
     */
    function revealVote(uint256 disputeId, Vote vote, uint256 nonce) external {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.status == DisputeStatus.InProgress, "DisputeContract: dispute not in progress");
        require(block.timestamp > dispute.createdAt + votingPeriod, "DisputeContract: reveal period not started");
        require(block.timestamp <= dispute.createdAt + votingPeriod + revealPeriod, "DisputeContract: reveal period ended");
        
        // Check if sender is a juror
        uint256 jurorIndex = 0;
        bool isJuror = false;
        for (uint256 i = 0; i < dispute.jurors.length; i++) {
            if (dispute.jurors[i] == msg.sender) {
                isJuror = true;
                jurorIndex = i;
                break;
            }
        }
        require(isJuror, "DisputeContract: not a juror");
        require(dispute.hasVoted[msg.sender], "DisputeContract: must commit vote first");
        require(dispute.votes[jurorIndex] == Vote.None, "DisputeContract: vote already revealed");
        
        // Verify the vote hash matches
        bytes32 voteHash = keccak256(abi.encodePacked(vote, nonce));
        require(dispute.voteHashes[msg.sender] == voteHash, "DisputeContract: vote hash mismatch");
        
        dispute.votes[jurorIndex] = vote;
        
        if (vote == Vote.Buyer) {
            dispute.buyerVotes++;
        } else if (vote == Vote.Seller) {
            dispute.sellerVotes++;
        }
        
        emit VoteCast(disputeId, msg.sender, vote);
        
        // Check if all jurors have revealed their votes
        bool allRevealed = true;
        for (uint256 i = 0; i < dispute.jurors.length; i++) {
            if (dispute.votes[i] == Vote.None) {
                allRevealed = false;
                break;
            }
        }
        
        if (allRevealed) {
            _resolveDispute(disputeId);
        }
    }
    
    /**
     * @dev Resolve dispute after timeout
     * @param disputeId ID of the dispute
     */
    function resolveDisputeTimeout(uint256 disputeId) external {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.status == DisputeStatus.InProgress, "DisputeContract: dispute not in progress");
        require(block.timestamp > dispute.createdAt + disputeTimeout, "DisputeContract: timeout not reached");
        
        _resolveDispute(disputeId);
    }
    
    /**
     * @dev Internal function to resolve dispute
     * @param disputeId ID of the dispute
     */
    function _resolveDispute(uint256 disputeId) internal {
        Dispute storage dispute = disputes[disputeId];
        
        dispute.status = DisputeStatus.Resolved;
        dispute.resolvedAt = block.timestamp;
        
        address winner;
        if (dispute.buyerVotes > dispute.sellerVotes) {
            winner = dispute.buyer;
        } else if (dispute.sellerVotes > dispute.buyerVotes) {
            winner = dispute.seller;
        } else {
            // Tie - could implement additional logic here
            winner = dispute.buyer; // Default to buyer
        }
        
        // Distribute rewards and penalties
        _distributeRewards(disputeId, winner);
        
        emit DisputeResolved(disputeId, winner);
    }
    
    // Reward pool for distributing rewards (in basis points, 1000 = 10% of total stake)
    uint256 public rewardPoolPercentage = 1000; // 10% of total stake goes to rewards
    
    /**
     * @dev Distribute rewards to jurors
     * @param disputeId ID of the dispute
     * @param winner Address of the winner
     */
    function _distributeRewards(uint256 disputeId, address winner) internal {
        Dispute storage dispute = disputes[disputeId];
        
        // Calculate total reward pool (10% of total stake)
        uint256 totalRewardPool = (dispute.totalStake * rewardPoolPercentage) / 10000;
        
        // Count correct voters
        uint256 correctVoters = 0;
        for (uint256 i = 0; i < dispute.jurors.length; i++) {
            address juror = dispute.jurors[i];
            Vote vote = dispute.votes[i];
            
            bool votedCorrectly = false;
            if (winner == dispute.buyer && vote == Vote.Buyer) {
                votedCorrectly = true;
            } else if (winner == dispute.seller && vote == Vote.Seller) {
                votedCorrectly = true;
            }
            
            if (votedCorrectly) {
                correctVoters++;
            }
        }
        
        // Distribute rewards only if there are correct voters
        if (correctVoters > 0 && totalRewardPool > 0) {
            uint256 rewardPerJuror = totalRewardPool / correctVoters;
            
            for (uint256 i = 0; i < dispute.jurors.length; i++) {
                address juror = dispute.jurors[i];
                Vote vote = dispute.votes[i];
                
                bool votedCorrectly = false;
                if (winner == dispute.buyer && vote == Vote.Buyer) {
                    votedCorrectly = true;
                } else if (winner == dispute.seller && vote == Vote.Seller) {
                    votedCorrectly = true;
                }
                
                if (votedCorrectly) {
                    // Reward juror
                    if (rewardPerJuror > 0 && aegToken.balanceOf(address(this)) >= rewardPerJuror) {
                        aegToken.transfer(juror, rewardPerJuror);
                        jurors[juror].reputation += 10;
                        emit JurorRewarded(juror, rewardPerJuror);
                    }
                } else {
                    // Penalize juror (reduce reputation only, no token transfer)
                    uint256 penalty = jurors[juror].stake / 10; // 10% of stake as penalty marker
                    jurors[juror].reputation = jurors[juror].reputation > 10 ? jurors[juror].reputation - 10 : 0;
                    emit JurorPenalized(juror, penalty);
                }
                
                jurors[juror].lastActive = block.timestamp;
            }
        }
        
        // Resolve escrow by calling EscrowContract
        if (escrowContract != address(0)) {
            (bool success, ) = escrowContract.call(
                abi.encodeWithSignature("resolveDispute(uint256,address)", dispute.escrowId, winner)
            );
            require(success, "DisputeContract: failed to resolve escrow");
        }
    }
    
    /**
     * @dev Select random jurors for a dispute (improved randomness)
     * Uses blockhash, block number, and dispute ID for better randomness
     * Note: For production, consider using Chainlink VRF
     */
    function _selectRandomJurors() internal view returns (address[] memory) {
        require(activeJurors.length >= minJurorsPerDispute, "DisputeContract: not enough jurors");
        
        uint256 numJurors = activeJurors.length < maxJurorsPerDispute ? activeJurors.length : maxJurorsPerDispute;
        address[] memory selected = new address[](numJurors);
        
        // Use Fisher-Yates shuffle algorithm with improved randomness source
        // Combine multiple sources: blockhash, block number, transaction origin
        uint256 seed = uint256(keccak256(abi.encodePacked(
            blockhash(block.number - 1),
            block.number,
            block.timestamp,
            tx.gasprice,
            nextDisputeId
        )));
        
        // Create a copy of active jurors for shuffling
        address[] memory candidates = new address[](activeJurors.length);
        for (uint256 i = 0; i < activeJurors.length; i++) {
            candidates[i] = activeJurors[i];
        }
        
        // Fisher-Yates shuffle
        for (uint256 i = 0; i < numJurors; i++) {
            uint256 randomIndex = uint256(keccak256(abi.encodePacked(seed, i))) % (activeJurors.length - i);
            selected[i] = candidates[randomIndex];
            
            // Swap selected element with end of array
            candidates[randomIndex] = candidates[activeJurors.length - i - 1];
        }
        
        return selected;
    }
    
    /**
     * @dev Get dispute details
     * @param disputeId ID of the dispute
     */
    function getDispute(uint256 disputeId) external view returns (
        uint256 escrowId,
        address buyer,
        address seller,
        address[] memory jurors,
        DisputeStatus status,
        uint256 createdAt,
        uint256 resolvedAt,
        string memory evidenceHash,
        uint256 buyerVotes,
        uint256 sellerVotes
    ) {
        Dispute storage dispute = disputes[disputeId];
        return (
            dispute.escrowId,
            dispute.buyer,
            dispute.seller,
            dispute.jurors,
            dispute.status,
            dispute.createdAt,
            dispute.resolvedAt,
            dispute.evidenceHash,
            dispute.buyerVotes,
            dispute.sellerVotes
        );
    }
    
    /**
     * @dev Update dispute parameters
     */
    function updateParameters(
        uint256 _minJurorStake,
        uint256 _maxJurorsPerDispute,
        uint256 _minJurorsPerDispute,
        uint256 _disputeTimeout,
        uint256 _votingPeriod,
        uint256 _revealPeriod,
        uint256 _rewardPoolPercentage
    ) external onlyOwner {
        require(_rewardPoolPercentage <= 5000, "DisputeContract: reward pool too high"); // Max 50%
        minJurorStake = _minJurorStake;
        maxJurorsPerDispute = _maxJurorsPerDispute;
        minJurorsPerDispute = _minJurorsPerDispute;
        disputeTimeout = _disputeTimeout;
        votingPeriod = _votingPeriod;
        revealPeriod = _revealPeriod;
        rewardPoolPercentage = _rewardPoolPercentage;
    }
}
