// Smart contract interaction utilities
import { ethers } from 'ethers';
import { useAccount, useWalletClient } from 'wagmi';
import { useState } from 'react';
import config from '../config/env';
import { showToast } from './toast';

/**
 * Convert wallet client to ethers signer
 * @param {Object} walletClient - Wallet client from wagmi
 * @returns {ethers.Signer|null} - Ethers signer or null
 */
function walletClientToSigner(walletClient) {
  if (!walletClient) return null;
  
  // For wagmi v2, we need to use window.ethereum or the wallet client's account
  // Since wagmi v2 uses viem internally, we'll use window.ethereum if available
  if (typeof window !== 'undefined' && window.ethereum) {
    const { account, chain } = walletClient;
    const network = {
      chainId: chain.id,
      name: chain.name,
      ensAddress: chain.contracts?.ensRegistry?.address,
    };
    const provider = new ethers.providers.Web3Provider(window.ethereum, network);
    const signer = provider.getSigner(account.address);
    return signer;
  }
  
  return null;
}

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
  'event DisputeCreated(uint256 indexed disputeId, uint256 indexed escrowId)',
];

/**
 * Hook for creating an escrow with ETH
 */
export function useCreateEscrowETH() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [isLoading, setIsLoading] = useState(false);
  
  const createEscrow = async (sellerAddress, arbitratorAddress, termsHash, amountETH) => {
    if (!address || !walletClient) {
      showToast.error('Please connect your wallet first');
      return;
    }

    const signer = walletClientToSigner(walletClient);
    if (!signer) {
      showToast.error('Failed to get signer');
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
  const { data: walletClient } = useWalletClient();
  const [isLoading, setIsLoading] = useState(false);

  const createEscrow = async (sellerAddress, arbitratorAddress, tokenAddress, amount, termsHash) => {
    if (!address || !walletClient) {
      showToast.error('Please connect your wallet first');
      return;
    }

    const signer = walletClientToSigner(walletClient);
    if (!signer) {
      showToast.error('Failed to get signer');
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
  const { data: walletClient } = useWalletClient();
  const [isLoading, setIsLoading] = useState(false);

  const confirmEscrow = async (escrowId) => {
    if (!address || !walletClient) {
      showToast.error('Please connect your wallet first');
      return;
    }

    const signer = walletClientToSigner(walletClient);
    if (!signer) {
      showToast.error('Failed to get signer');
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
  const { data: walletClient } = useWalletClient();
  const [isLoading, setIsLoading] = useState(false);

  const registerJuror = async (stakeAmount) => {
    if (!address || !walletClient) {
      showToast.error('Please connect your wallet first');
      return;
    }

    if (!config.contracts.disputeContract) {
      showToast.error('Dispute contract address not configured');
      return;
    }

    const signer = walletClientToSigner(walletClient);
    if (!signer) {
      showToast.error('Failed to get signer');
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
 * Hook for creating a dispute for an escrow
 */
export function useCreateDispute() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [isLoading, setIsLoading] = useState(false);

  const createDispute = async (escrowId, evidenceHash) => {
    if (!address || !walletClient) {
      showToast.error('Please connect your wallet first');
      return;
    }

    const signer = walletClientToSigner(walletClient);
    if (!signer) {
      showToast.error('Failed to get signer');
      return;
    }

    if (!config.contracts.escrowContract) {
      showToast.error('Escrow contract address not configured');
      return;
    }

    setIsLoading(true);
    try {
      // First, get escrow details to verify and get buyer/seller
      const escrowContract = new ethers.Contract(
        config.contracts.escrowContract,
        ESCROW_ABI,
        signer
      );

      const escrowData = await escrowContract.getEscrow(escrowId);
      
      // Verify user is buyer or seller
      const userAddr = address.toLowerCase();
      const buyerAddr = escrowData.buyer.toLowerCase();
      const sellerAddr = escrowData.seller.toLowerCase();
      
      if (userAddr !== buyerAddr && userAddr !== sellerAddr) {
        throw new Error('Only buyer or seller can create a dispute');
      }

      // Create dispute via EscrowContract (which will call DisputeContract)
      const tx = await escrowContract.createDispute(escrowId, evidenceHash);
      
      showToast.success(`Transaction submitted! Hash: ${tx.hash.slice(0, 10)}...`);
      
      const receipt = await tx.wait();
      
      // Extract dispute ID from EscrowDisputed event
      let disputeId = null;
      let event = null;
      
      if (receipt.events && receipt.events.length > 0) {
        event = receipt.events.find(e => e.event === 'EscrowDisputed');
      }
      
      // If not found in events, parse from logs
      if (!event && receipt.logs && receipt.logs.length > 0) {
        const iface = new ethers.utils.Interface(ESCROW_ABI);
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog(log);
            if (parsed && parsed.name === 'EscrowDisputed') {
              event = { args: parsed.args };
              break;
            }
          } catch (e) {
            // Not this log, continue
          }
        }
      }
      
      if (event) {
        disputeId = event.args.disputeId.toString();
      }

      // Also try to get dispute ID from DisputeCreated event if available
      if (!disputeId && config.contracts.disputeContract) {
        const disputeIface = new ethers.utils.Interface(DISPUTE_ABI);
        for (const log of receipt.logs) {
          try {
            const parsed = disputeIface.parseLog(log);
            if (parsed && parsed.name === 'DisputeCreated') {
              disputeId = parsed.args.disputeId.toString();
              break;
            }
          } catch (e) {
            // Not this log, continue
          }
        }
      }

      // Sync with backend
      try {
        const syncResponse = await fetch(`${config.apiUrl}/api/disputes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            escrowId: escrowId.toString(),
            buyer: escrowData.buyer,
            seller: escrowData.seller,
            evidenceHash: evidenceHash,
            onChainDisputeId: disputeId,
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            createdBy: address
          })
        });

        const syncData = await syncResponse.json();
        
        if (!syncData.success) {
          console.warn('Failed to sync dispute with backend:', syncData.message);
          showToast.error('Dispute created on-chain but failed to sync with backend');
        } else {
          showToast.success('Dispute created and synced successfully!');
        }
      } catch (syncError) {
        console.error('Error syncing dispute with backend:', syncError);
        showToast.error('Dispute created on-chain but failed to sync with backend');
      }
      
      return {
        receipt,
        disputeId,
        escrowId: escrowId.toString(),
        buyer: escrowData.buyer,
        seller: escrowData.seller
      };
    } catch (error) {
      console.error('Error creating dispute:', error);
      showToast.error('Failed to create dispute', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { createDispute, isLoading };
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

