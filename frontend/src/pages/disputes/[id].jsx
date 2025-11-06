// Dispute Detail Page Component
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Scale,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  ExternalLink,
  User,
  Users,
  Vote,
  FileText,
  Eye,
  Shield
} from 'lucide-react';
import Navbar from '../components/Navbar';
import CommitRevealVoting from '../components/CommitRevealVoting';
import { showToast } from '../utils/toast';
import config from '../config/env';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { formatDistanceToNow } from 'date-fns';

export default function DisputeDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { address, isConnected } = useAccount();
  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (id) {
      fetchDisputeDetails();
    }
  }, [id]);

  const fetchDisputeDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${config.apiUrl}/api/disputes/${id}`);
      if (!response.ok) {
        throw new Error('Dispute not found');
      }
      
      const data = await response.json();
      if (data.success) {
        setDispute(data.data);
      } else {
        throw new Error(data.message || 'Failed to load dispute');
      }
    } catch (error) {
      console.error('Error fetching dispute:', error);
      setError(error.message);
      showToast.error('Failed to load dispute details', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVoteComplete = () => {
    fetchDisputeDetails(); // Refresh after voting
  };

  const formatAddress = (addr) => {
    if (!addr) return 'N/A';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'InProgress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'Resolved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'Cancelled':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Pending':
        return <Clock className="w-5 h-5" />;
      case 'InProgress':
        return <AlertTriangle className="w-5 h-5" />;
      case 'Resolved':
        return <CheckCircle className="w-5 h-5" />;
      case 'Cancelled':
        return <XCircle className="w-5 h-5" />;
      default:
        return <Clock className="w-5 h-5" />;
    }
  };

  const isJuror = dispute?.jurors?.some(j => {
    const jurorAddr = typeof j === 'string' ? j : j.address;
    return jurorAddr?.toLowerCase() === address?.toLowerCase();
  });

  if (loading) {
    return (
      <>
        <Head>
          <title>Loading Dispute - Aegora</title>
        </Head>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <Navbar />
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center py-12">
              <Clock className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading dispute details...</span>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error || !dispute) {
    return (
      <>
        <Head>
          <title>Dispute Not Found - Aegora</title>
        </Head>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <Navbar />
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
              <h2 className="text-xl font-bold text-red-900 dark:text-red-100 mb-2">
                Dispute Not Found
              </h2>
              <p className="text-red-800 dark:text-red-200">{error}</p>
              <button
                onClick={() => router.push('/disputes')}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Back to Disputes
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Dispute #{dispute.disputeId} - Aegora</title>
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
                  <Scale className="w-6 h-6 text-blue-600" />
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    Dispute #{dispute.disputeId}
                  </h1>
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(dispute.status)}`}>
                  {getStatusIcon(dispute.status)}
                  <span className="ml-2">{dispute.status}</span>
                </span>
              </div>
            </div>

            {/* Key Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="flex items-center space-x-3">
                <Shield className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Escrow ID</p>
                  <button
                    onClick={() => router.push(`/escrow/${dispute.escrowId}`)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    #{dispute.escrowId}
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Users className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Jurors</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {dispute.jurors?.length || 0}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <User className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Buyer</p>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatAddress(dispute.buyer)}
                    </span>
                    <CopyToClipboard
                      text={dispute.buyer}
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
                      {formatAddress(dispute.seller)}
                    </span>
                    <CopyToClipboard
                      text={dispute.seller}
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
            </div>
          </div>

          {/* Voting Status */}
          {dispute.status === 'InProgress' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Voting Status
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Buyer Votes</span>
                  <span className="text-xl font-bold text-green-600">
                    {dispute.buyerVotes || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Seller Votes</span>
                  <span className="text-xl font-bold text-blue-600">
                    {dispute.sellerVotes || 0}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Commit-Reveal Voting */}
          {dispute.status === 'InProgress' && isJuror && (
            <div className="mb-6">
              <CommitRevealVoting dispute={dispute} onVoteComplete={handleVoteComplete} />
            </div>
          )}

          {/* Evidence */}
          {dispute.evidence?.hash && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
                  <FileText className="w-5 h-5" />
                  <span>Evidence</span>
                </h3>
                <a
                  href={`${config.ipfsGateway}${dispute.evidence.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 text-sm flex items-center space-x-1"
                  aria-label="View evidence on IPFS"
                >
                  <span>View on IPFS</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              {dispute.evidence.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {dispute.evidence.description}
                </p>
              )}
              <p className="text-sm font-mono text-gray-600 dark:text-gray-400 break-all">
                {dispute.evidence.hash}
              </p>
            </div>
          )}

          {/* Jurors List */}
          {dispute.jurors && dispute.jurors.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Selected Jurors
              </h3>
              <div className="space-y-2">
                {dispute.jurors.map((juror, index) => {
                  const jurorAddr = typeof juror === 'string' ? juror : juror.address;
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
                          {formatAddress(jurorAddr)}
                        </span>
                        {jurorAddr?.toLowerCase() === address?.toLowerCase() && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 rounded text-xs font-medium">
                            You
                          </span>
                        )}
                      </div>
                      <CopyToClipboard
                        text={jurorAddr}
                        onCopy={() => showToast.success('Address copied')}
                      >
                        <button
                          className="text-gray-400 hover:text-gray-600"
                          aria-label="Copy juror address"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </CopyToClipboard>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Timeline */}
          {dispute.timeline && dispute.timeline.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Timeline
              </h3>
              <div className="space-y-3">
                {dispute.timeline.map((event, index) => (
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
        </div>
      </div>
    </>
  );
}

