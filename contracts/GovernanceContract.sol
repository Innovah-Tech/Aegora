// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";
import "./TokenAEG.sol";

/**
 * @title GovernanceContract
 * @dev AegoraDAO governance contract using OpenZeppelin Governor
 */
contract GovernanceContract is 
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    // Proposal types
    enum ProposalType {
        ParameterUpdate,
        ContractUpgrade,
        TreasuryManagement,
        IntegrationApproval,
        EmergencyAction
    }
    
    struct ProposalMetadata {
        ProposalType proposalType;
        string description;
        string ipfsHash;
        uint256 createdAt;
    }
    
    // Proposal ID => Metadata
    mapping(uint256 => ProposalMetadata) public proposalMetadata;
    
    // Events
    event ProposalCreatedWithMetadata(
        uint256 indexed proposalId,
        ProposalType proposalType,
        string description,
        string ipfsHash
    );
    
    constructor(
        TokenAEG _token,
        TimelockController _timelock,
        uint256 _votingDelay,
        uint256 _votingPeriod,
        uint256 _proposalThreshold,
        uint256 _quorumPercentage
    )
        Governor("AegoraDAO")
        GovernorSettings(_votingDelay, _votingPeriod, _proposalThreshold)
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(_quorumPercentage)
        GovernorTimelockControl(_timelock)
    {}
    
    /**
     * @dev Create a proposal with metadata
     * @param targets Array of target addresses
     * @param values Array of ETH values
     * @param calldatas Array of calldata
     * @param description Description of the proposal
     * @param proposalType Type of the proposal
     * @param ipfsHash IPFS hash of detailed proposal
     */
    function proposeWithMetadata(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        ProposalType proposalType,
        string memory ipfsHash
    ) public returns (uint256) {
        uint256 proposalId = propose(targets, values, calldatas, description);
        
        proposalMetadata[proposalId] = ProposalMetadata({
            proposalType: proposalType,
            description: description,
            ipfsHash: ipfsHash,
            createdAt: block.timestamp
        });
        
        emit ProposalCreatedWithMetadata(proposalId, proposalType, description, ipfsHash);
        
        return proposalId;
    }
    
    /**
     * @dev Create a parameter update proposal
     * @param targets Array of target addresses
     * @param values Array of ETH values
     * @param calldatas Array of calldata
     * @param description Description of the proposal
     * @param ipfsHash IPFS hash of detailed proposal
     */
    function proposeParameterUpdate(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        string memory ipfsHash
    ) external returns (uint256) {
        return proposeWithMetadata(
            targets,
            values,
            calldatas,
            description,
            ProposalType.ParameterUpdate,
            ipfsHash
        );
    }
    
    /**
     * @dev Create a contract upgrade proposal
     * @param targets Array of target addresses
     * @param values Array of ETH values
     * @param calldatas Array of calldata
     * @param description Description of the proposal
     * @param ipfsHash IPFS hash of detailed proposal
     */
    function proposeContractUpgrade(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        string memory ipfsHash
    ) external returns (uint256) {
        return proposeWithMetadata(
            targets,
            values,
            calldatas,
            description,
            ProposalType.ContractUpgrade,
            ipfsHash
        );
    }
    
    /**
     * @dev Create a treasury management proposal
     * @param targets Array of target addresses
     * @param values Array of ETH values
     * @param calldatas Array of calldata
     * @param description Description of the proposal
     * @param ipfsHash IPFS hash of detailed proposal
     */
    function proposeTreasuryManagement(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        string memory ipfsHash
    ) external returns (uint256) {
        return proposeWithMetadata(
            targets,
            values,
            calldatas,
            description,
            ProposalType.TreasuryManagement,
            ipfsHash
        );
    }
    
    /**
     * @dev Create an integration approval proposal
     * @param targets Array of target addresses
     * @param values Array of ETH values
     * @param calldatas Array of calldata
     * @param description Description of the proposal
     * @param ipfsHash IPFS hash of detailed proposal
     */
    function proposeIntegrationApproval(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        string memory ipfsHash
    ) external returns (uint256) {
        return proposeWithMetadata(
            targets,
            values,
            calldatas,
            description,
            ProposalType.IntegrationApproval,
            ipfsHash
        );
    }
    
    /**
     * @dev Create an emergency action proposal
     * @param targets Array of target addresses
     * @param values Array of ETH values
     * @param calldatas Array of calldata
     * @param description Description of the proposal
     * @param ipfsHash IPFS hash of detailed proposal
     */
    function proposeEmergencyAction(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        string memory ipfsHash
    ) external returns (uint256) {
        return proposeWithMetadata(
            targets,
            values,
            calldatas,
            description,
            ProposalType.EmergencyAction,
            ipfsHash
        );
    }
    
    /**
     * @dev Get proposal metadata
     * @param proposalId ID of the proposal
     */
    function getProposalMetadata(uint256 proposalId) external view returns (ProposalMetadata memory) {
        return proposalMetadata[proposalId];
    }
    
    /**
     * @dev Get proposal state with metadata
     * @param proposalId ID of the proposal
     */
    function getProposalState(uint256 proposalId) external view returns (
        uint8 proposalState,
        ProposalMetadata memory metadata
    ) {
        return (uint8(state(proposalId)), proposalMetadata[proposalId]);
    }
    
    /**
     * @dev Get voting power at a specific block
     * @param account Account to check
     * @param blockNumber Block number to check
     */
    function getVotingPower(address account, uint256 blockNumber) external view returns (uint256) {
        return getVotes(account, blockNumber);
    }
    
    /**
     * @dev Get current voting power
     * @param account Account to check
     */
    function getCurrentVotingPower(address account) external view returns (uint256) {
        return getVotes(account, block.number);
    }
    
    /**
     * @dev Check if account can propose
     * @param account Account to check
     */
    function canPropose(address account) external view returns (bool) {
        return getVotes(account, block.number) >= proposalThreshold();
    }
    
    /**
     * @dev Get proposal count by type
     * @param proposalType Type of proposal
     */
    function getProposalCountByType(ProposalType proposalType) external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 1; i <= proposalCount(); i++) {
            if (proposalMetadata[i].proposalType == proposalType) {
                count++;
            }
        }
        return count;
    }
    
    /**
     * @dev Get active proposals
     */
    function getActiveProposals() external view returns (uint256[] memory) {
        uint256 totalProposals = proposalCount();
        uint256[] memory activeProposals = new uint256[](totalProposals);
        uint256 activeCount = 0;
        
        for (uint256 i = 1; i <= totalProposals; i++) {
            if (state(i) == ProposalState.Active) {
                activeProposals[activeCount] = i;
                activeCount++;
            }
        }
        
        // Resize array to actual active count
        uint256[] memory result = new uint256[](activeCount);
        for (uint256 i = 0; i < activeCount; i++) {
            result[i] = activeProposals[i];
        }
        
        return result;
    }
    
    /**
     * @dev Returns the total number of proposals ever created
     * Uses OpenZeppelin's built-in proposal count tracking
     */
    function proposalCount() public view returns (uint256) {
        // OpenZeppelin Governor tracks proposals starting from 1
        // We need to find the highest proposal ID that exists
        // This is a simplified version - in production, consider caching this value
        uint256 count = 0;
        uint256 maxProposals = 1000; // Reasonable upper limit to prevent gas issues
        
        for (uint256 i = 1; i <= maxProposals; i++) {
            // Check if proposal exists by checking if metadata was created
            if (proposalMetadata[i].createdAt != 0) {
                count = i;
            } else {
                // If we hit a gap, we've found the end
                break;
            }
        }
        
        return count;
    }
    
    /**
     * @dev Override required functions
     */
    function votingDelay() public view override(IGovernor, GovernorSettings) returns (uint256) {
        return super.votingDelay();
    }
    
    function votingPeriod() public view override(IGovernor, GovernorSettings) returns (uint256) {
        return super.votingPeriod();
    }
    
    function quorum(uint256 blockNumber) public view override(IGovernor, GovernorVotesQuorumFraction) returns (uint256) {
        return super.quorum(blockNumber);
    }
    
    function state(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (ProposalState) {
        return super.state(proposalId);
    }
    
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public override(Governor, IGovernor) returns (uint256) {
        return super.propose(targets, values, calldatas, description);
    }
    
    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.proposalThreshold();
    }
    
    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
    }
    
    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }
    
    function _executor() internal view override(Governor, GovernorTimelockControl) returns (address) {
        return super._executor();
    }
    
    function supportsInterface(bytes4 interfaceId) public view override(Governor, GovernorTimelockControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
