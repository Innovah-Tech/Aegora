import { useState, useEffect } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { Lock, Unlock, Vote, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { showToast } from '../utils/toast';
import { generateVoteHash, generateNonce, DISPUTE_ABI } from '../utils/contracts';
import config from '../config/env';

/**
 * Convert wallet client to ethers signer
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

export function CommitRevealVoting({ dispute, onVoteComplete }) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [phase, setPhase] = useState('commit'); // 'commit' or 'reveal'
  const [hasCommitted, setHasCommitted] = useState(false);
  const [vote, setVote] = useState(null); // 'buyer' or 'seller'
  const [nonce, setNonce] = useState(null);
  const [voteHash, setVoteHash] = useState(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [commitTimeRemaining, setCommitTimeRemaining] = useState(null);
  const [revealTimeRemaining, setRevealTimeRemaining] = useState(null);

  useEffect(() => {
    // Check if user is a juror
    const isJuror = dispute.jurors?.some(j => 
      (typeof j === 'string' ? j : j.address)?.toLowerCase() === address?.toLowerCase()
    );
    
    if (!isJuror) {
      setPhase('none');
      return;
    }

    // Determine phase based on dispute timing
    // This would need to be calculated from dispute.createdAt and voting periods
    // For now, assume we're in commit phase initially
    checkVotingPhase();
  }, [dispute, address]);

  const checkVotingPhase = async () => {
    // Check contract state to determine phase
    try {
      if (!walletClient || !config.contracts.disputeContract) return;
      
      const signer = walletClientToSigner(walletClient);
      if (!signer) return;
      
      const contract = new ethers.Contract(
        config.contracts.disputeContract,
        DISPUTE_ABI,
        signer
      );

      // Check if user has committed
      // This would require reading from contract events or state
      // For now, assume commit phase
      setPhase('commit');
    } catch (error) {
      console.error('Error checking voting phase:', error);
    }
  };

  const handleCommitVote = async (selectedVote) => {
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

    setIsCommitting(true);
    try {
      const newNonce = generateNonce();
      const hash = generateVoteHash(selectedVote === 'buyer' ? 1 : 2, ethers.BigNumber.from(newNonce));
      
      const contract = new ethers.Contract(
        config.contracts.disputeContract,
        DISPUTE_ABI,
        signer
      );

      const tx = await contract.castVote(dispute.disputeId, hash);
      showToast.success(`Vote committed! Hash: ${tx.hash.slice(0, 10)}...`);
      
      await tx.wait();
      
      // Store vote and nonce in localStorage for reveal phase
      localStorage.setItem(`vote_${dispute.disputeId}_${address}`, JSON.stringify({
        vote: selectedVote,
        nonce: ethers.BigNumber.from(newNonce).toString(),
        hash: hash
      }));

      setVote(selectedVote);
      setNonce(ethers.BigNumber.from(newNonce).toString());
      setVoteHash(hash);
      setHasCommitted(true);
      setPhase('reveal');
      
      showToast.success('Vote committed successfully! You can reveal it after the commit period.');
    } catch (error) {
      console.error('Error committing vote:', error);
      showToast.error('Failed to commit vote', error);
    } finally {
      setIsCommitting(false);
    }
  };

  const handleRevealVote = async () => {
    if (!address || !walletClient) {
      showToast.error('Please connect your wallet first');
      return;
    }

    if (!vote || !nonce) {
      showToast.error('Vote data not found. You must commit a vote first.');
      return;
    }

    const signer = walletClientToSigner(walletClient);
    if (!signer) {
      showToast.error('Failed to get signer');
      return;
    }

    setIsRevealing(true);
    try {
      const contract = new ethers.Contract(
        config.contracts.disputeContract,
        DISPUTE_ABI,
        signer
      );

      const voteValue = vote === 'buyer' ? 1 : 2;
      const tx = await contract.revealVote(
        dispute.disputeId,
        voteValue,
        nonce
      );

      showToast.success(`Vote revealed! Hash: ${tx.hash.slice(0, 10)}...`);
      
      await tx.wait();
      showToast.success('Vote revealed successfully!');
      
      // Clear stored vote
      localStorage.removeItem(`vote_${dispute.disputeId}_${address}`);
      
      if (onVoteComplete) {
        onVoteComplete();
      }
    } catch (error) {
      console.error('Error revealing vote:', error);
      showToast.error('Failed to reveal vote', error);
    } finally {
      setIsRevealing(false);
    }
  };

  // Check for stored vote
  useEffect(() => {
    if (address && dispute.disputeId) {
      const stored = localStorage.getItem(`vote_${dispute.disputeId}_${address}`);
      if (stored) {
        try {
          const { vote: storedVote, nonce: storedNonce, hash: storedHash } = JSON.parse(stored);
          setVote(storedVote);
          setNonce(storedNonce);
          setVoteHash(storedHash);
          setHasCommitted(true);
          setPhase('reveal');
        } catch (e) {
          console.error('Error parsing stored vote:', e);
        }
      }
    }
  }, [address, dispute.disputeId]);

  if (phase === 'none') {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {phase === 'commit' ? 'Commit Phase' : 'Reveal Phase'}
        </h3>
        {phase === 'commit' ? (
          <Lock className="w-5 h-5 text-blue-600" />
        ) : (
          <Unlock className="w-5 h-5 text-green-600" />
        )}
      </div>

      {phase === 'commit' && !hasCommitted ? (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-100">Commit Phase</h4>
                <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                  Your vote is encrypted and cannot be seen by others. You'll reveal it later.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleCommitVote('buyer')}
              disabled={isCommitting}
              className="flex flex-col items-center justify-center p-6 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Vote for buyer"
            >
              <Vote className="w-8 h-8 text-green-600 mb-2" />
              <span className="font-medium text-gray-900 dark:text-gray-100">Vote Buyer</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">Side with buyer</span>
            </button>

            <button
              onClick={() => handleCommitVote('seller')}
              disabled={isCommitting}
              className="flex flex-col items-center justify-center p-6 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Vote for seller"
            >
              <Vote className="w-8 h-8 text-blue-600 mb-2" />
              <span className="font-medium text-gray-900 dark:text-gray-100">Vote Seller</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">Side with seller</span>
            </button>
          </div>

          {isCommitting && (
            <div className="flex items-center justify-center space-x-2 text-blue-600">
              <Clock className="w-5 h-5 animate-spin" />
              <span>Committing vote...</span>
            </div>
          )}
        </div>
      ) : phase === 'reveal' && hasCommitted ? (
        <div className="space-y-4">
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-green-900 dark:text-green-100">Vote Committed</h4>
                <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                  Your vote has been committed. Reveal it now to finalize your decision.
                </p>
                {voteHash && (
                  <p className="text-xs text-green-700 dark:text-green-300 mt-2 font-mono break-all">
                    Hash: {voteHash.slice(0, 20)}...
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Your Committed Vote:</span>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100 capitalize">
                {vote === 'buyer' ? '👤 Buyer' : '💼 Seller'}
              </span>
            </div>
          </div>

          <button
            onClick={handleRevealVote}
            disabled={isRevealing}
            className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Reveal vote"
          >
            <Unlock className="w-5 h-5" />
            <span>{isRevealing ? 'Revealing...' : 'Reveal Vote'}</span>
          </button>

          {isRevealing && (
            <div className="flex items-center justify-center space-x-2 text-green-600">
              <Clock className="w-5 h-5 animate-spin" />
              <span>Revealing vote...</span>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default CommitRevealVoting;

