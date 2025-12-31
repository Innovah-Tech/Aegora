import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { 
  Scale, 
  Search, 
  Filter, 
  RefreshCw,
  AlertTriangle,
  Clock,
  CheckCircle,
  Users,
  Eye,
  Vote,
  Shield,
  Plus,
  XCircle
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { StatsSkeleton } from '../components/Skeleton';
import TransactionHistory from '../components/TransactionHistory';
import config from '../config/env';
import { showToast } from '../utils/toast';
import { useRegisterJuror } from '../utils/contracts';

export default function DisputesPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [showBecomeJurorModal, setShowBecomeJurorModal] = useState(false);
  const [jurorStake, setJurorStake] = useState('');
  const [currentJuror, setCurrentJuror] = useState(null);
  const [jurorStats, setJurorStats] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  
  const { registerJuror, isLoading: isRegistering } = useRegisterJuror();

  useEffect(() => {
    fetchDisputes();
    fetchJurorStats();
    if (address) {
      checkJurorStatus();
    }
  }, [address]);

  const fetchDisputes = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const response = await fetch(`${config.apiUrl}/api/disputes`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed with status ${response.status}`);
      }
      const data = await response.json();
      
      if (data.success) {
        setDisputes(data.data);
      }
    } catch (error) {
      console.error('Error fetching disputes:', error);
      const errorMessage = error?.message || 'Failed to load disputes. Is the backend and MongoDB running?';
      setErrorMsg(errorMessage);
      showToast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchJurorStats = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/jurors/stats/overview`);
      if (!response.ok) return;
      const data = await response.json();
      
      if (data.success) {
        setJurorStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching juror stats:', error);
    }
  };

  const filteredDisputes = disputes.filter(dispute => {
    const matchesSearch = searchTerm === '' || 
      dispute.disputeId.toString().includes(searchTerm) ||
      dispute.buyer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dispute.seller?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || dispute.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleViewDispute = (dispute) => {
    router.push(`/disputes/${dispute.disputeId}`);
  };

  const checkJurorStatus = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/jurors/${address}`);
      if (!response.ok) return setCurrentJuror(null);
      const data = await response.json();
      
      if (data.success) {
        setCurrentJuror(data.data);
      } else {
        setCurrentJuror(null);
      }
    } catch (error) {
      console.error('Error checking juror status:', error);
      setCurrentJuror(null);
    }
  };

  const handleBecomeJuror = async () => {
    if (!isConnected) {
      showToast.error('Please connect your wallet first');
      return;
    }

    const stakeAmount = parseFloat(jurorStake);
    if (!jurorStake || stakeAmount < 1000) {
      showToast.error('Minimum stake required is 1000 AEG tokens');
      return;
    }

    try {
      await registerJuror(stakeAmount);
      setShowBecomeJurorModal(false);
      setJurorStake('');
      checkJurorStatus();
    } catch (error) {
      console.error('Error registering as juror:', error);
    }
  };

  const handleUnregisterJuror = async () => {
    if (!isConnected) {
      showToast.error('Please connect your wallet first');
      return;
    }

    if (!confirm('Are you sure you want to unregister as a juror? Your stake will be returned.')) {
      return;
    }

    try {
      // This would call smart contract unregisterJuror
      // For now, use API
      const response = await fetch(`${config.apiUrl}/api/jurors/unregister`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: address
        })
      });

      const data = await response.json();

      if (data.success) {
        showToast.success('Successfully unregistered as a juror!');
        setCurrentJuror(null);
      } else {
        showToast.error(data.message || 'Error unregistering as juror');
      }
    } catch (error) {
      console.error('Error unregistering as juror:', error);
      showToast.error('Failed to unregister as juror', error);
    }
  };

  const handleVote = async (disputeId, vote) => {
    // Voting is now handled in the detail page with commit-reveal
    router.push(`/disputes/${disputeId}`);
  };

  const stats = {
    total: disputes.length,
    pending: disputes.filter(d => d.status === 'Pending').length,
    inProgress: disputes.filter(d => d.status === 'InProgress').length,
    resolved: disputes.filter(d => d.status === 'Resolved').length
  };

  const DisputeCard = ({ dispute }) => {
    const getStatusColor = (status) => {
      switch (status) {
        case 'Pending':
          return 'bg-yellow-100 text-yellow-800';
        case 'InProgress':
          return 'bg-blue-100 text-blue-800';
        case 'Resolved':
          return 'bg-green-100 text-green-800';
        case 'Cancelled':
          return 'bg-gray-100 text-gray-800';
        default:
          return 'bg-gray-100 text-gray-800';
      }
    };

    const getStatusIcon = (status) => {
      switch (status) {
        case 'Pending':
          return <Clock className="w-4 h-4" />;
        case 'InProgress':
          return <AlertTriangle className="w-4 h-4" />;
        case 'Resolved':
          return <CheckCircle className="w-4 h-4" />;
        case 'Cancelled':
          return <XCircle className="w-4 h-4" />;
        default:
          return <Clock className="w-4 h-4" />;
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Scale className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-900">Dispute #{dispute.disputeId}</span>
          </div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(dispute.status)}`}>
            {getStatusIcon(dispute.status)}
            <span className="ml-1">{dispute.status}</span>
          </span>
        </div>

        {/* Details */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Escrow ID</span>
            <span className="text-sm font-medium text-gray-900">#{dispute.escrowId}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Buyer</span>
            <span className="text-sm font-medium text-gray-900">
              {dispute.buyer?.slice(0, 6)}...{dispute.buyer?.slice(-4)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Seller</span>
            <span className="text-sm font-medium text-gray-900">
              {dispute.seller?.slice(0, 6)}...{dispute.seller?.slice(-4)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Jurors</span>
            <span className="text-sm font-medium text-gray-900">
              {dispute.jurors?.length || 0}
            </span>
          </div>
        </div>

        {/* Votes */}
        {dispute.status === 'InProgress' && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-600">Buyer Votes</span>
              <span className="text-green-600 font-medium">{dispute.votes?.buyerVotes || 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Seller Votes</span>
              <span className="text-blue-600 font-medium">{dispute.votes?.sellerVotes || 0}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-2">
          <button
            onClick={() => handleViewDispute(dispute)}
            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Eye className="w-4 h-4" />
            <span>View</span>
          </button>
          
          {dispute.status === 'InProgress' && dispute.jurors?.some(j => j.address === address?.toLowerCase()) && (
            <button
              onClick={() => handleVote(dispute.disputeId, 'Buyer')}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
            >
              <Vote className="w-4 h-4" />
              <span>Vote Buyer</span>
            </button>
          )}
          
          {dispute.status === 'InProgress' && dispute.jurors?.some(j => j.address === address?.toLowerCase()) && (
            <button
              onClick={() => handleVote(dispute.disputeId, 'Seller')}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              <Vote className="w-4 h-4" />
              <span>Vote Seller</span>
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <>
      <Head>
        <title>Disputes - Aegora</title>
        <meta name="description" content="Manage disputes and arbitration on Aegora" />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {errorMsg && (
            <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
              {errorMsg}
            </div>
          )}
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Disputes</h1>
              <p className="text-gray-600 mt-2">Manage arbitration and dispute resolution</p>
            </div>
            
            <div className="flex items-center space-x-4">
              {currentJuror ? (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2 px-3 py-2 bg-green-100 text-green-800 rounded-lg">
                    <Shield className="w-4 h-4" />
                    <span className="text-sm font-medium">Active Juror</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <div>Stake: {currentJuror.stake} AEG</div>
                    <div>Reputation: {currentJuror.reputation}</div>
                  </div>
                  <button
                    onClick={handleUnregisterJuror}
                    disabled={isRegistering}
                    className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                    aria-label="Unregister as juror"
                  >
                    {isRegistering ? 'Unregistering...' : 'Unregister'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowBecomeJurorModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Shield className="w-5 h-5" />
                  <span>Become a Juror</span>
                </button>
              )}
            </div>
          </div>

          {/* Stats */}
          {loading ? (
            <StatsSkeleton />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-lg shadow-sm"
            >
              <div className="flex items-center">
                <Scale className="w-8 h-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white p-6 rounded-lg shadow-sm"
            >
              <div className="flex items-center">
                <Clock className="w-8 h-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
                </div>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white p-6 rounded-lg shadow-sm"
            >
              <div className="flex items-center">
                <AlertTriangle className="w-8 h-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">In Progress</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.inProgress}</p>
                </div>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white p-6 rounded-lg shadow-sm"
            >
              <div className="flex items-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Resolved</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.resolved}</p>
                </div>
              </div>
            </motion.div>
          </div>
          )}

          {/* Juror Stats */}
          {jurorStats && (
            <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Juror Network</h3>
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{jurorStats.active}</div>
                  <div className="text-sm text-gray-600">Active Jurors</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{jurorStats.totalStake}</div>
                  <div className="text-sm text-gray-600">Total Stake (AEG)</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{jurorStats.avgReputation}</div>
                  <div className="text-sm text-gray-600">Avg Reputation</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{jurorStats.avgAccuracy}%</div>
                  <div className="text-sm text-gray-600">Avg Accuracy</div>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search disputes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="InProgress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
                
                <button
                  onClick={fetchDisputes}
                  disabled={loading}
                  className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>
          </div>

          {/* Disputes Grid */}
          {loading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredDisputes.length === 0 ? (
            <div className="text-center py-12">
              <Scale className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No disputes found</h3>
              <p className="text-gray-600">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filter criteria.'
                  : 'No disputes have been created yet.'
                }
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
                {filteredDisputes.map((dispute, index) => (
                  <DisputeCard key={dispute.disputeId} dispute={dispute} />
                ))}
              </div>
              
              {/* Transaction History */}
              <TransactionHistory />
            </>
          )}
        </div>

        {/* Become a Juror Modal */}
        {showBecomeJurorModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-lg p-6 w-full max-w-md mx-4"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Become a Juror</h2>
                <button
                  onClick={() => setShowBecomeJurorModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900">Juror Responsibilities</h4>
                      <ul className="text-sm text-blue-800 mt-2 space-y-1">
                        <li>• Review dispute evidence impartially</li>
                        <li>• Cast votes based on evidence</li>
                        <li>• Maintain high reputation through accurate decisions</li>
                        <li>• Earn rewards for correct votes</li>
                        <li>• Face penalties for incorrect votes</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stake Amount (AEG Tokens)
                  </label>
                  <input
                    type="number"
                    value={jurorStake}
                    onChange={(e) => setJurorStake(e.target.value)}
                    placeholder="1000"
                    min="1000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Minimum stake: 1,000 AEG tokens
                  </p>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-900">Important Notice</h4>
                      <p className="text-sm text-yellow-800 mt-1">
                        Your stake will be locked while you're an active juror. You can unregister at any time to retrieve your stake.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={() => setShowBecomeJurorModal(false)}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBecomeJuror}
                    disabled={isRegistering || !jurorStake || parseFloat(jurorStake) < 1000}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Register as juror"
                  >
                    {isRegistering ? 'Registering...' : 'Register as Juror'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </>
  );
}
