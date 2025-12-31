// Escrow Detail Page Component
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  ExternalLink,
  User,
  DollarSign,
  FileText,
  Eye,
  Check,
  X
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import { showToast } from '../../utils/toast';
import { useConfirmEscrow, useCreateDispute } from '../../utils/contracts';
import { isValidIPFSHash } from '../../utils/ipfs';
import config from '../../config/env';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { formatDistanceToNow } from 'date-fns';

export default function EscrowDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { address, isConnected } = useAccount();
  const [escrow, setEscrow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { confirmEscrow, isLoading: isConfirming } = useConfirmEscrow();
  const { createDispute, isLoading: isCreatingDispute } = useCreateDispute();

  useEffect(() => {
    if (id) {
      fetchEscrowDetails();
    }
  }, [id]);

  const fetchEscrowDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${config.apiUrl}/api/escrow/${id}`);
      if (!response.ok) {
        throw new Error('Escrow not found');
      }
      
      const data = await response.json();
      if (data.success) {
        setEscrow(data.data);
      } else {
        throw new Error(data.message || 'Failed to load escrow');
      }
    } catch (error) {
      console.error('Error fetching escrow:', error);
      setError(error.message);
      showToast.error('Failed to load escrow details', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    try {
      await confirmEscrow(id);
      fetchEscrowDetails(); // Refresh
    } catch (error) {
      console.error('Error confirming escrow:', error);
    }
  };

  const handleDispute = async () => {
    if (!isConnected) {
      showToast.error('Please connect your wallet first');
      return;
    }

    const evidenceHash = prompt('Enter IPFS hash of evidence (or upload file first):');
    if (!evidenceHash || !isValidIPFSHash(evidenceHash)) {
      showToast.error('Please provide a valid IPFS hash');
      return;
    }

    try {
      showToast.loading('Creating dispute...');
      
      // Create dispute on-chain
      await createDispute(id, evidenceHash);
      
      showToast.success('Dispute created successfully!');
      fetchEscrowDetails(); // Refresh
    } catch (error) {
      console.error('Error creating dispute:', error);
      showToast.error('Failed to create dispute', error);
    }
  };

  const formatAddress = (addr) => {
    if (!addr) return 'N/A';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'Completed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'Disputed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'Cancelled':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Active':
        return <Clock className="w-5 h-5" />;
      case 'Completed':
        return <CheckCircle className="w-5 h-5" />;
      case 'Disputed':
        return <AlertTriangle className="w-5 h-5" />;
      case 'Cancelled':
        return <XCircle className="w-5 h-5" />;
      default:
        return <Clock className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <>
        <Head>
          <title>Loading Escrow - Aegora</title>
        </Head>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <Navbar />
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center py-12">
              <Clock className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading escrow details...</span>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error || !escrow) {
    return (
      <>
        <Head>
          <title>Escrow Not Found - Aegora</title>
        </Head>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <Navbar />
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
              <h2 className="text-xl font-bold text-red-900 dark:text-red-100 mb-2">
                Escrow Not Found
              </h2>
              <p className="text-red-800 dark:text-red-200">{error}</p>
              <button
                onClick={() => router.push('/escrow')}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Back to Escrows
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const isBuyer = address?.toLowerCase() === escrow.buyer?.toLowerCase();
  const isSeller = address?.toLowerCase() === escrow.seller?.toLowerCase();
  const canConfirm = isBuyer || isSeller;
  const canDispute = escrow.status === 'Active' && canConfirm;

  return (
    <>
      <Head>
        <title>Escrow #{escrow.escrowId} - Aegora</title>
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back Button */}
          <button
            onClick={() => router.back()}
            className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-6"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>

          {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <Shield className="w-6 h-6 text-blue-600" />
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    Escrow #{escrow.escrowId}
                  </h1>
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(escrow.status)}`}>
                  {getStatusIcon(escrow.status)}
                  <span className="ml-2">{escrow.status}</span>
                </span>
              </div>
            </div>

            {/* Key Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="flex items-center space-x-3">
                <User className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Buyer</p>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatAddress(escrow.buyer)}
                    </span>
                    <CopyToClipboard
                      text={escrow.buyer}
                      onCopy={() => showToast.success('Address copied')}
                    >
                      <button
                        className="text-gray-400 hover:text-gray-600"
                        aria-label="Copy buyer address"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </CopyToClipboard>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <User className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Seller</p>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatAddress(escrow.seller)}
                    </span>
                    <CopyToClipboard
                      text={escrow.seller}
                      onCopy={() => showToast.success('Address copied')}
                    >
                      <button
                        className="text-gray-400 hover:text-gray-600"
                        aria-label="Copy seller address"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </CopyToClipboard>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <DollarSign className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Amount</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {escrow.amount?.toLocaleString()} {escrow.tokenAddress ? 'tokens' : 'ETH'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Created</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatDistanceToNow(new Date(escrow.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Confirmation Status */}
          {escrow.status === 'Active' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Confirmation Status
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Buyer Confirmed</span>
                  {escrow.buyerConfirmed ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Seller Confirmed</span>
                  {escrow.sellerConfirmed ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Terms */}
          {escrow.termsHash && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
                  <FileText className="w-5 h-5" />
                  <span>Terms</span>
                </h3>
                <a
                  href={`${config.ipfsGateway}${escrow.termsHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 text-sm flex items-center space-x-1"
                  aria-label="View terms on IPFS"
                >
                  <span>View on IPFS</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <p className="text-sm font-mono text-gray-600 dark:text-gray-400 break-all">
                {escrow.termsHash}
              </p>
            </div>
          )}

          {/* Timeline */}
          {escrow.timeline && escrow.timeline.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Timeline
              </h3>
              <div className="space-y-3">
                {escrow.timeline.map((event, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-2" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {event.action}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        by {formatAddress(event.actor)} • {new Date(event.timestamp).toLocaleString()}
                      </p>
                      {event.details && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {event.details}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {escrow.status === 'Active' && canConfirm && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Actions
              </h3>
              <div className="flex flex-col sm:flex-row gap-4">
                {!escrow.buyerConfirmed && isBuyer && (
                  <button
                    onClick={handleConfirm}
                    disabled={isConfirming}
                    className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Confirm escrow completion"
                  >
                    <Check className="w-5 h-5" />
                    <span>{isConfirming ? 'Confirming...' : 'Confirm Completion'}</span>
                  </button>
                )}
                {!escrow.sellerConfirmed && isSeller && (
                  <button
                    onClick={handleConfirm}
                    disabled={isConfirming}
                    className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Confirm escrow completion"
                  >
                    <Check className="w-5 h-5" />
                    <span>{isConfirming ? 'Confirming...' : 'Confirm Completion'}</span>
                  </button>
                )}
                {canDispute && (
                  <button
                    onClick={handleDispute}
                    className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    aria-label="Create dispute"
                  >
                    <AlertTriangle className="w-5 h-5" />
                    <span>Create Dispute</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

