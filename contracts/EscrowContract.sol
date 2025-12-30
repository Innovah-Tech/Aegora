// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./TokenAEG.sol";

/**
 * @title EscrowContract
 * @dev Handles escrow functionality for Aegora protocol
 * Funds are locked until terms are met or dispute resolution
 */
contract EscrowContract is ReentrancyGuard, Ownable {
    enum EscrowStatus { Active, Completed, Disputed, Cancelled }
    
    struct Escrow {
        address buyer;
        address seller;
        address arbitrator;
        uint256 amount;
        address tokenAddress;
        EscrowStatus status;
        uint256 createdAt;
        uint256 completedAt;
        string termsHash; // IPFS hash of terms
        string evidenceHash; // IPFS hash of evidence
        uint256 disputeId;
        bool buyerConfirmed;
        bool sellerConfirmed;
    }
    
    // Escrow ID => Escrow details
    mapping(uint256 => Escrow) public escrows;
    
    // User => Escrow IDs
    mapping(address => uint256[]) public userEscrows;
    
    // Token => Allowed for escrow
    mapping(address => bool) public allowedTokens;
    
    // Escrow fees (in basis points, 100 = 1%)
    uint256 public escrowFee = 25; // 0.25%
    uint256 public disputeFee = 100; // 1%
    
    uint256 public nextEscrowId = 1;
    
    // Events
    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        address tokenAddress
    );
    
    event EscrowCompleted(uint256 indexed escrowId, address indexed winner);
    event EscrowDisputed(uint256 indexed escrowId, uint256 indexed disputeId);
    event EscrowCancelled(uint256 indexed escrowId);
    event ConfirmationUpdated(uint256 indexed escrowId, address indexed user, bool confirmed);
    
    constructor() {
        // Allow native ETH and AEG token by default
        allowedTokens[address(0)] = true;
    }
    
    /**
     * @dev Add a token to allowed list
     * @param token Token address to allow
     */
    function addAllowedToken(address token) external onlyOwner {
        allowedTokens[token] = true;
    }
    
    /**
     * @dev Remove a token from allowed list
     * @param token Token address to remove
     */
    function removeAllowedToken(address token) external onlyOwner {
        allowedTokens[token] = false;
    }
    
    /**
     * @dev Create a new escrow with ETH
     * @param seller Address of the seller
     * @param arbitrator Address of the arbitrator (can be zero for random selection)
     * @param termsHash IPFS hash of the terms
     */
    function createEscrow(
        address seller,
        address arbitrator,
        string memory termsHash
    ) external payable nonReentrant returns (uint256) {
        require(seller != address(0), "EscrowContract: invalid seller");
        require(seller != msg.sender, "EscrowContract: cannot escrow with self");
        require(allowedTokens[address(0)], "EscrowContract: ETH not allowed");
        require(msg.value > 0, "EscrowContract: ETH amount must be positive");
        
        uint256 escrowId = nextEscrowId++;
        
        escrows[escrowId] = Escrow({
            buyer: msg.sender,
            seller: seller,
            arbitrator: arbitrator,
            amount: msg.value,
            tokenAddress: address(0),
            status: EscrowStatus.Active,
            createdAt: block.timestamp,
            completedAt: 0,
            termsHash: termsHash,
            evidenceHash: "",
            disputeId: 0,
            buyerConfirmed: false,
            sellerConfirmed: false
        });
        
        userEscrows[msg.sender].push(escrowId);
        userEscrows[seller].push(escrowId);
        
        emit EscrowCreated(escrowId, msg.sender, seller, msg.value, address(0));
        
        return escrowId;
    }
    
    /**
     * @dev Create a new escrow with ERC20 token
     * @param seller Address of the seller
     * @param arbitrator Address of the arbitrator (can be zero for random selection)
     * @param tokenAddress Address of the ERC20 token
     * @param amount Amount of tokens to escrow
     * @param termsHash IPFS hash of the terms
     */
    function createEscrowERC20(
        address seller,
        address arbitrator,
        address tokenAddress,
        uint256 amount,
        string memory termsHash
    ) external nonReentrant returns (uint256) {
        require(seller != address(0), "EscrowContract: invalid seller");
        require(seller != msg.sender, "EscrowContract: cannot escrow with self");
        require(tokenAddress != address(0), "EscrowContract: invalid token address");
        require(allowedTokens[tokenAddress], "EscrowContract: token not allowed");
        require(amount > 0, "EscrowContract: amount must be positive");
        
        // Transfer tokens from buyer to contract
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount);
        
        uint256 escrowId = nextEscrowId++;
        
        escrows[escrowId] = Escrow({
            buyer: msg.sender,
            seller: seller,
            arbitrator: arbitrator,
            amount: amount,
            tokenAddress: tokenAddress,
            status: EscrowStatus.Active,
            createdAt: block.timestamp,
            completedAt: 0,
            termsHash: termsHash,
            evidenceHash: "",
            disputeId: 0,
            buyerConfirmed: false,
            sellerConfirmed: false
        });
        
        userEscrows[msg.sender].push(escrowId);
        userEscrows[seller].push(escrowId);
        
        emit EscrowCreated(escrowId, msg.sender, seller, amount, tokenAddress);
        
        return escrowId;
    }
    
    /**
     * @dev Confirm completion by buyer or seller
     * @param escrowId ID of the escrow
     */
    function confirmCompletion(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.Active, "EscrowContract: escrow not active");
        require(
            msg.sender == escrow.buyer || msg.sender == escrow.seller,
            "EscrowContract: not authorized"
        );
        
        if (msg.sender == escrow.buyer) {
            escrow.buyerConfirmed = true;
        } else {
            escrow.sellerConfirmed = true;
        }
        
        emit ConfirmationUpdated(escrowId, msg.sender, true);
        
        // If both parties confirm, complete the escrow
        if (escrow.buyerConfirmed && escrow.sellerConfirmed) {
            _completeEscrow(escrowId, escrow.seller);
        }
    }
    
    // Address of DisputeContract (can be set by owner)
    address public disputeContract;
    
    /**
     * @dev Set the DisputeContract address
     * @param _disputeContract Address of the DisputeContract
     */
    function setDisputeContract(address _disputeContract) external onlyOwner {
        require(_disputeContract != address(0), "EscrowContract: invalid dispute contract");
        disputeContract = _disputeContract;
    }
    
    // Interface for DisputeContract
    interface IDisputeContract {
        function createDispute(uint256 escrowId, address buyer, address seller, string memory evidenceHash) external returns (uint256);
    }
    
    /**
     * @dev Create a dispute for the escrow
     * @param escrowId ID of the escrow
     * @param evidenceHash IPFS hash of evidence
     */
    function createDispute(uint256 escrowId, string memory evidenceHash) external nonReentrant returns (uint256) {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.Active, "EscrowContract: escrow not active");
        require(
            msg.sender == escrow.buyer || msg.sender == escrow.seller,
            "EscrowContract: not authorized"
        );
        require(disputeContract != address(0), "EscrowContract: dispute contract not set");
        
        // Mark escrow as disputed first
        escrow.status = EscrowStatus.Disputed;
        escrow.evidenceHash = evidenceHash;
        
        // Call DisputeContract to create dispute
        IDisputeContract dispute = IDisputeContract(disputeContract);
        uint256 disputeId = dispute.createDispute(escrowId, escrow.buyer, escrow.seller, evidenceHash);
        
        // Store the dispute ID
        escrow.disputeId = disputeId;
        
        emit EscrowDisputed(escrowId, disputeId);
        
        return disputeId;
    }
    
    /**
     * @dev Set dispute ID for an escrow (called by DisputeContract)
     * @param escrowId ID of the escrow
     * @param disputeId ID of the dispute
     */
    function setDisputeId(uint256 escrowId, uint256 disputeId) external {
        require(msg.sender == disputeContract, "EscrowContract: only dispute contract");
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.Disputed, "EscrowContract: escrow not disputed");
        escrow.disputeId = disputeId;
    }
    
    /**
     * @dev Complete escrow after dispute resolution (called by DisputeContract)
     * @param escrowId ID of the escrow
     * @param winner Address of the winner
     */
    function resolveDispute(uint256 escrowId, address winner) external {
        require(msg.sender == disputeContract || msg.sender == owner(), "EscrowContract: not authorized");
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.Disputed, "EscrowContract: escrow not disputed");
        
        _completeEscrow(escrowId, winner);
    }
    
    /**
     * @dev Internal function to complete escrow
     * @param escrowId ID of the escrow
     * @param winner Address of the winner
     */
    function _completeEscrow(uint256 escrowId, address winner) internal {
        Escrow storage escrow = escrows[escrowId];
        
        escrow.status = EscrowStatus.Completed;
        escrow.completedAt = block.timestamp;
        
        // Calculate fees
        uint256 fee = (escrow.amount * escrowFee) / 10000;
        uint256 payout = escrow.amount - fee;
        
        // Transfer funds
        if (escrow.tokenAddress == address(0)) {
            payable(winner).transfer(payout);
            if (fee > 0) {
                payable(owner()).transfer(fee);
            }
        } else {
            // Handle ERC20 transfer with safe transfer
            require(IERC20(escrow.tokenAddress).transfer(winner, payout), "EscrowContract: ERC20 transfer failed");
            if (fee > 0) {
                require(IERC20(escrow.tokenAddress).transfer(owner(), fee), "EscrowContract: ERC20 fee transfer failed");
            }
        }
        
        emit EscrowCompleted(escrowId, winner);
    }
    
    /**
     * @dev Cancel escrow (only if both parties agree or after timeout)
     * @param escrowId ID of the escrow
     */
    function cancelEscrow(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.Active, "EscrowContract: escrow not active");
        require(
            msg.sender == escrow.buyer || msg.sender == escrow.seller || msg.sender == owner(),
            "EscrowContract: not authorized"
        );
        
        escrow.status = EscrowStatus.Cancelled;
        
        // Refund to buyer
        if (escrow.tokenAddress == address(0)) {
            payable(escrow.buyer).transfer(escrow.amount);
        } else {
            require(IERC20(escrow.tokenAddress).transfer(escrow.buyer, escrow.amount), "EscrowContract: ERC20 refund failed");
        }
        
        emit EscrowCancelled(escrowId);
    }
    
    /**
     * @dev Get escrow details
     * @param escrowId ID of the escrow
     */
    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
        return escrows[escrowId];
    }
    
    /**
     * @dev Get user's escrows
     * @param user User address
     */
    function getUserEscrows(address user) external view returns (uint256[] memory) {
        return userEscrows[user];
    }
    
    /**
     * @dev Update escrow fees
     * @param newEscrowFee New escrow fee in basis points
     * @param newDisputeFee New dispute fee in basis points
     */
    function updateFees(uint256 newEscrowFee, uint256 newDisputeFee) external onlyOwner {
        require(newEscrowFee <= 500, "EscrowContract: escrow fee too high"); // Max 5%
        require(newDisputeFee <= 1000, "EscrowContract: dispute fee too high"); // Max 10%
        
        escrowFee = newEscrowFee;
        disputeFee = newDisputeFee;
    }
}
