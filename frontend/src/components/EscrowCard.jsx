import { useState } from 'react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { 
  Clock, 
  User, 
  DollarSign, 
  Shield, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const EscrowCard = ({ escrow, onView, onConfirm, onDispute }) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'Completed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Disputed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'Cancelled':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Active':
        return <Clock className="w-4 h-4" />;
      case 'Completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'Disputed':
        return <AlertTriangle className="w-4 h-4" />;
      case 'Cancelled':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm(escrow.escrowId);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDispute = async () => {
    setIsLoading(true);
    try {
      await onDispute(escrow.escrowId);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md dark:hover:shadow-lg transition-shadow"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Shield className="w-5 h-5 text-blue-600" />
          <span className="font-semibold text-gray-900 dark:text-gray-100">Escrow #{escrow.escrowId}</span>
        </div>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(escrow.status)}`}>
          {getStatusIcon(escrow.status)}
          <span className="ml-1">{escrow.status}</span>
        </span>
      </div>

      {/* Details */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Buyer</span>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {escrow.buyer?.slice(0, 6)}...{escrow.buyer?.slice(-4)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Seller</span>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {escrow.seller?.slice(0, 6)}...{escrow.seller?.slice(-4)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Amount</span>
          <div className="flex items-center space-x-1">
            <DollarSign className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {escrow.amount?.toLocaleString()}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Created</span>
          <span className="text-sm text-gray-900 dark:text-gray-100">
            {formatDistanceToNow(new Date(escrow.createdAt), { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* Confirmation Status */}
      {escrow.status === 'Active' && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Buyer Confirmed</span>
            <span className={`flex items-center space-x-1 ${
              escrow.buyerConfirmed ? 'text-green-600' : 'text-gray-400'
            }`}>
              {escrow.buyerConfirmed ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span>{escrow.buyerConfirmed ? 'Yes' : 'No'}</span>
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-gray-600 dark:text-gray-400">Seller Confirmed</span>
            <span className={`flex items-center space-x-1 ${
              escrow.sellerConfirmed ? 'text-green-600' : 'text-gray-400'
            }`}>
              {escrow.sellerConfirmed ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span>{escrow.sellerConfirmed ? 'Yes' : 'No'}</span>
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex space-x-2">
        <button
          onClick={() => router.push(`/escrow/${escrow.escrowId}`)}
          className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          aria-label={`View escrow ${escrow.escrowId} details`}
        >
          <Eye className="w-4 h-4" />
          <span>View</span>
        </button>
        
        {escrow.status === 'Active' && (
          <>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Confirm escrow completion"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{isLoading ? 'Confirming...' : 'Confirm'}</span>
            </button>
            <button
              onClick={handleDispute}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Create dispute for this escrow"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>{isLoading ? 'Disputing...' : 'Dispute'}</span>
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default EscrowCard;
