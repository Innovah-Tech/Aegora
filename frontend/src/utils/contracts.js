// Smart contract interaction utilities
import { ethers } from 'ethers';
import { useAccount, useSigner } from 'wagmi';
import { useState } from 'react';
import config from '../config/env';
import { showToast } from './toast';

// EscrowContract ABI (minimal for interactions)
const ESCROW_ABI = [
  'function createEscrow(address seller, address arbitrator, string memory termsHash) external payable returns (uint256)',
  'function createEscrowERC20(address seller, address arbitrator, address tokenAddress, uint256 amount, string memory termsHash) external returns (uint256)',
  'function confirmCompletion(uint256 escrowId) external',
  'function createDispute(uint256 escrowId, string memory evidenceHash) external returns (uint256)',
  'function cancelEscrow(uint256 escrowId) external',
  'function getEscrow(uint256 escrowId) external view returns (tuple(address buyer, address seller, address arbitrator, uint256 amount, address tokenAddress, uint8 status, uint256 createdAt, uint256 completedAt, string termsHash, string evidenceHash, uint256 disputeId, bool buyerConfirmed, bool sellerConfirmed))',
  'event EscrowCreated(uint256 indexed escrowId, address indexed buyer, address indexed seller, uint256 amount, address tokenAddress)',
  'event EscrowCompleted(uint256 indexed escrowId, address indexed winner)',
  'event EscrowDisputed(uint256 indexed escrowId, uint256 indexed disputeId)',
];

// DisputeContract ABI (minimal)
const DISPUTE_ABI = [
  'function createDispute(uint256 escrowId, address buyer, address seller, string memory evidenceHash) external returns (uint256)',
  'function castVote(uint256 disputeId, bytes32 voteHash) external',
  'function revealVote(uint256 disputeId, uint8 vote, uint256 nonce) external',
  'function registerJuror(uint256 stake) external',
  'function unregisterJuror() external',
  'function getDispute(uint256 disputeId) external view returns (uint256, address, address, address[], uint8, uint256, uint256, string, uint256, uint256)',
];

/**
 * Hook for creating an escrow with ETH
 */
export function useCreateEscrowETH() {
  const { address } = useAccount();
  const { data: signer } = useSigner();
  const [isLoading, setIsLoading] = useState(false);
  
  const createEscrow = async (sellerAddress, arbitratorAddress, termsHash, amountETH) => {
    if (!address || !signer) {
      showToast.error('Please connect your wallet first');
      return;
    }

    if (!config.contracts.escrowContract) {
      showToast.error('Escrow contract address not configured');
      return;
    }

    setIsLoading(true);
    try {
      const ethersContract = new ethers.Contract(
        config.contracts.escrowContract,
        ESCROW_ABI,
        signer
      );

      const tx = await ethersContract.createEscrow(
        sellerAddress,
        arbitratorAddress || ethers.constants.AddressZero,
        termsHash,
        { value: ethers.utils.parseEther(amountETH.toString()) }
      );

      showToast.success(`Transaction submitted! Hash: ${tx.hash.slice(0, 10)}...`);
      
      const receipt = await tx.wait();
      
      // Extract escrow ID from EscrowCreated event
      // In ethers v5, events can be in receipt.events or we need to parse logs
      let event = null;
      if (receipt.events && receipt.events.length > 0) {
        event = receipt.events.find(e => e.event === 'EscrowCreated');
      }
      
      // If not found in events, parse from logs
      if (!event && receipt.logs && receipt.logs.length > 0) {
        const iface = new ethers.utils.Interface(ESCROW_ABI);
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog(log);
            if (parsed && parsed.name === 'EscrowCreated') {
              event = { args: parsed.args };
              break;
            }
          } catch (e) {
            // Not this log, continue
          }
        }
      }
      
      if (!event) {
        throw new Error('EscrowCreated event not found in transaction receipt');
      }
      
      const escrowId = event.args.escrowId.toString();
      const buyer = event.args.buyer;
      const seller = event.args.seller;
      const amount = event.args.amount.toString();
      const tokenAddress = event.args.tokenAddress;
      
      // Sync with backend
      try {
        const syncResponse = await fetch(`${config.apiUrl}/api/escrow`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            buyer: buyer,
            seller: seller,
            arbitrator: arbitratorAddress || null,
            amount: ethers.utils.formatEther(amount),
            tokenAddress: tokenAddress === ethers.constants.AddressZero ? null : tokenAddress,
            termsHash: termsHash,
            onChainEscrowId: escrowId,
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber
          })
        });

        const syncData = await syncResponse.json();
        
        if (!syncData.success) {
          console.warn('Failed to sync escrow with backend:', syncData.message);
          showToast.error('Escrow created on-chain but failed to sync with backend');
        } else {
          showToast.success('Escrow created and synced successfully!');
        }
      } catch (syncError) {
        console.error('Error syncing escrow with backend:', syncError);
        showToast.error('Escrow created on-chain but failed to sync with backend');
      }
      
      return {
        receipt,
        escrowId,
        buyer,
        seller,
        amount,
        tokenAddress
      };
    } catch (error) {
      console.error('Error creating escrow:', error);
      showToast.error('Failed to create escrow', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createEscrow,
    isLoading,
  };
}

/**
 * Hook for creating an escrow with ERC20 token
 */
export function useCreateEscrowERC20() {
  const { address } = useAccount();
  const { data: signer } = useSigner();
  const [isLoading, setIsLoading] = useState(false);

  const createEscrow = async (sellerAddress, arbitratorAddress, tokenAddress, amount, termsHash) => {
    if (!address || !signer) {
      showToast.error('Please connect your wallet first');
      return;
    }

    if (!config.contracts.escrowContract) {
      showToast.error('Escrow contract address not configured');
      return;
    }

    setIsLoading(true);
    try {
      const ethersContract = new ethers.Contract(
        config.contracts.escrowContract,
        ESCROW_ABI,
        signer
      );

      // First approve token spending
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function approve(address spender, uint256 amount) external returns (bool)'],
        signer
      );

      const approveTx = await tokenContract.approve(
        config.contracts.escrowContract,
        amount
      );
      await approveTx.wait();

      // Then create escrow
      const tx = await ethersContract.createEscrowERC20(
        sellerAddress,
        arbitratorAddress || ethers.constants.AddressZero,
        tokenAddress,
        amount,
        termsHash
      );

      showToast.success(`Transaction submitted! Hash: ${tx.hash.slice(0, 10)}...`);
      
      const receipt = await tx.wait();
      
      // Extract escrow ID from EscrowCreated event
      // In ethers v5, events can be in receipt.events or we need to parse logs
      let event = null;
      if (receipt.events && receipt.events.length > 0) {
        event = receipt.events.find(e => e.event === 'EscrowCreated');
      }
      
      // If not found in events, parse from logs
      if (!event && receipt.logs && receipt.logs.length > 0) {
        const iface = new ethers.utils.Interface(ESCROW_ABI);
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog(log);
            if (parsed && parsed.name === 'EscrowCreated') {
              event = { args: parsed.args };
              break;
            }
          } catch (e) {
            // Not this log, continue
          }
        }
      }
      
      if (!event) {
        throw new Error('EscrowCreated event not found in transaction receipt');
      }
      
      const escrowId = event.args.escrowId.toString();
      const buyer = event.args.buyer;
      const seller = event.args.seller;
      const escrowAmount = event.args.amount.toString();
      const escrowTokenAddress = event.args.tokenAddress;
      
      // Sync with backend
      try {
        // Get token decimals for proper formatting
        const tokenDecimals = await tokenContract.decimals();
        const formattedAmount = ethers.utils.formatUnits(escrowAmount, tokenDecimals);
        
        const syncResponse = await fetch(`${config.apiUrl}/api/escrow`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            buyer: buyer,
            seller: seller,
            arbitrator: arbitratorAddress || null,
            amount: formattedAmount,
            tokenAddress: escrowTokenAddress,
            termsHash: termsHash,
            onChainEscrowId: escrowId,
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber
          })
        });

        const syncData = await syncResponse.json();
        
        if (!syncData.success) {
          console.warn('Failed to sync escrow with backend:', syncData.message);
          showToast.error('Escrow created on-chain but failed to sync with backend');
        } else {
          showToast.success('Escrow created and synced successfully!');
        }
      } catch (syncError) {
        console.error('Error syncing escrow with backend:', syncError);
        showToast.error('Escrow created on-chain but failed to sync with backend');
      }
      
      return {
        receipt,
        escrowId,
        buyer,
        seller,
        amount: escrowAmount,
        tokenAddress: escrowTokenAddress
      };
    } catch (error) {
      console.error('Error creating escrow:', error);
      showToast.error('Failed to create escrow', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { createEscrow, isLoading };
}

/**
 * Hook for confirming escrow completion
 */
export function useConfirmEscrow() {
  const { address } = useAccount();
  const { data: signer } = useSigner();
  const [isLoading, setIsLoading] = useState(false);

  const confirmEscrow = async (escrowId) => {
    if (!address || !signer) {
      showToast.error('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    try {
      const ethersContract = new ethers.Contract(
        config.contracts.escrowContract,
        ESCROW_ABI,
        signer
      );

      const tx = await ethersContract.confirmCompletion(escrowId);
      showToast.success(`Transaction submitted! Hash: ${tx.hash.slice(0, 10)}...`);
      
      const receipt = await tx.wait();
      showToast.success('Escrow confirmed successfully!');
      
      return receipt;
    } catch (error) {
      console.error('Error confirming escrow:', error);
      showToast.error('Failed to confirm escrow', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { confirmEscrow, isLoading };
}

/**
 * Hook for registering as a juror
 */
export function useRegisterJuror() {
  const { address } = useAccount();
  const { data: signer } = useSigner();
  const [isLoading, setIsLoading] = useState(false);

  const registerJuror = async (stakeAmount) => {
    if (!address || !signer) {
      showToast.error('Please connect your wallet first');
      return;
    }

    if (!config.contracts.disputeContract) {
      showToast.error('Dispute contract address not configured');
      return;
    }

    setIsLoading(true);
    try {
      const ethersContract = new ethers.Contract(
        config.contracts.disputeContract,
        DISPUTE_ABI,
        signer
      );

      // First approve token spending
      const tokenContract = new ethers.Contract(
        config.contracts.tokenAEG,
        ['function approve(address spender, uint256 amount) external returns (bool)'],
        signer
      );

      const approveTx = await tokenContract.approve(
        config.contracts.disputeContract,
        ethers.utils.parseEther(stakeAmount.toString())
      );
      await approveTx.wait();

      // Then register
      const tx = await ethersContract.registerJuror(
        ethers.utils.parseEther(stakeAmount.toString())
      );

      showToast.success(`Transaction submitted! Hash: ${tx.hash.slice(0, 10)}...`);
      
      const receipt = await tx.wait();
      showToast.success('Successfully registered as a juror!');
      
      return receipt;
    } catch (error) {
      console.error('Error registering as juror:', error);
      showToast.error('Failed to register as juror', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { registerJuror, isLoading };
}

/**
 * Generate vote hash for commit-reveal scheme
 */
export function generateVoteHash(vote, nonce) {
  return ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(['uint8', 'uint256'], [vote, nonce])
  );
}

/**
 * Generate random nonce for voting
 */
export function generateNonce() {
  return ethers.utils.randomBytes(32);
}

export {
  ESCROW_ABI,
  DISPUTE_ABI,
};

