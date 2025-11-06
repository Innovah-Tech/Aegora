// Transaction History Hook and Component
import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, XCircle, ExternalLink, Copy } from 'lucide-react';
import { showToast } from '../utils/toast';
import config from '../config/env';
import { CopyToClipboard } from 'react-copy-to-clipboard';

export function useTransactionHistory() {
  const { address } = useAccount();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (address && typeof window !== 'undefined' && window.txHistory) {
      fetchTransactions();
      const unsubscribe = window.txHistory.subscribe(() => {
        fetchTransactions();
      });
      return unsubscribe;
    }
  }, [address]);

  const fetchTransactions = () => {
    try {
      setLoading(true);
      if (typeof window !== 'undefined' && window.txHistory) {
        const txs = window.txHistory.getTransactions(address?.toLowerCase());
        setTransactions(txs.sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        ));
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    transactions,
    loading,
    refresh: fetchTransactions,
  };
}

export function TransactionHistory({ className = '' }) {
  const { address } = useAccount();
  const { transactions, loading } = useTransactionHistory();

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'success':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const formatAddress = (addr) => {
    if (!addr) return 'N/A';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const explorerUrl = (hash) => {
    return `${config.explorerUrl}/tx/${hash}`;
  };

  if (!address) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        <p className="text-gray-500 dark:text-gray-400 text-center">
          Connect your wallet to view transaction history
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Transaction History
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {transactions.length} transactions
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Clock className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No transactions yet</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {transactions.map((tx) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
              role="listitem"
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                {getStatusIcon(tx.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {tx.type || 'Transaction'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(tx.status)}`}>
                      {tx.status}
                    </span>
                  </div>
                  {tx.hash && (
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                        {formatAddress(tx.hash)}
                      </span>
                      <CopyToClipboard
                        text={tx.hash}
                        onCopy={() => showToast.success('Hash copied to clipboard')}
                      >
                        <button
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          aria-label="Copy transaction hash"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </CopyToClipboard>
                      {tx.hash && (
                        <a
                          href={explorerUrl(tx.hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          aria-label="View on explorer"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {new Date(tx.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TransactionHistory;

