// Enhanced transaction tracking with integration
import { useEffect } from 'react';
import { useAccount } from 'wagmi';

// Global transaction history manager
class TransactionHistoryManager {
  constructor() {
    this.transactions = new Map();
    this.listeners = new Set();
  }

  addTransaction(tx) {
    const txWithId = {
      ...tx,
      id: tx.id || Date.now(),
      timestamp: tx.timestamp || new Date().toISOString(),
    };
    
    this.transactions.set(txWithId.id, txWithId);
    this.notifyListeners();
    
    return txWithId.id;
  }

  updateTransaction(id, updates) {
    const tx = this.transactions.get(id);
    if (tx) {
      const updated = { ...tx, ...updates };
      this.transactions.set(id, updated);
      this.notifyListeners();
    }
  }

  getTransactions(address) {
    return Array.from(this.transactions.values()).filter(tx => 
      !address || tx.address === address
    );
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners() {
    this.listeners.forEach(listener => listener());
  }
}

// Create global instance
if (typeof window !== 'undefined') {
  window.txHistory = new TransactionHistoryManager();
}

// Hook to use transaction history
export function useTransactionTracking() {
  const { address } = useAccount();

  const addTransaction = (tx) => {
    if (window.txHistory) {
      return window.txHistory.addTransaction({
        ...tx,
        address: address?.toLowerCase(),
      });
    }
    return null;
  };

  const updateTransaction = (id, updates) => {
    if (window.txHistory) {
      window.txHistory.updateTransaction(id, updates);
    }
  };

  const trackContractCall = async (fn, txType) => {
    const txId = addTransaction({
      type: txType,
      status: 'pending',
    });

    try {
      const result = await fn();
      
      if (result && result.hash) {
        updateTransaction(txId, {
          hash: result.hash,
          status: 'pending',
        });

        // Wait for confirmation
        if (result.wait) {
          const receipt = await result.wait();
          updateTransaction(txId, {
            hash: receipt.transactionHash,
            status: receipt.status === 1 ? 'success' : 'failed',
          });
        } else {
          updateTransaction(txId, {
            status: 'success',
          });
        }
      } else {
        updateTransaction(txId, {
          status: 'success',
        });
      }

      return result;
    } catch (error) {
      updateTransaction(txId, {
        status: 'failed',
        error: error.message,
      });
      throw error;
    }
  };

  return {
    addTransaction,
    updateTransaction,
    trackContractCall,
  };
}

export default useTransactionTracking;

