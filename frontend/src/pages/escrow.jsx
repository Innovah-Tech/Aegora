import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Search, 
  Filter, 
  RefreshCw,
  Shield,
  DollarSign,
  Users,
  Clock
} from 'lucide-react';
import Navbar from '../components/Navbar';
import EscrowCard from '../components/EscrowCard';
import { StatsSkeleton, EscrowCardSkeleton } from '../components/Skeleton';
import { IPFSUpload } from '../components/IPFSUpload';
import config from '../config/env';
import { showToast } from '../utils/toast';
import { useCreateEscrowETH, useCreateDispute } from '../utils/contracts';
import { isValidIPFSHash } from '../utils/ipfs';

export default function EscrowPage() {
  const { address, isConnected } = useAccount();
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [termsHash, setTermsHash] = useState('');
  
  const { createEscrow, isLoading: isCreatingEscrow } = useCreateEscrowETH();
  const { createDispute, isLoading: isCreatingDispute } = useCreateDispute();

  useEffect(() => {
    fetchEscrows();
  }, []);

  const fetchEscrows = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const response = await fetch(`${config.apiUrl}/api/escrow`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed with status ${response.status}`);
      }
      const data = await response.json();
      
      if (data.success) {
        setEscrows(data.data);
      }
    } catch (error) {
      console.error('Error fetching escrows:', error);
      const errorMessage = error?.message || 'Failed to load escrows. Is the backend and MongoDB running?';
      setErrorMsg(errorMessage);
      showToast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const filteredEscrows = escrows.filter(escrow => {
    const matchesSearch = searchTerm === '' || 
      escrow.escrowId.toString().includes(searchTerm) ||
      escrow.buyer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      escrow.seller?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || escrow.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleViewEscrow = (escrow) => {
    // Navigate to escrow detail page
    console.log('View escrow:', escrow);
  };

  const handleConfirmEscrow = async (escrowId) => {
    try {
      const response = await fetch(`${config.apiUrl}/api/escrow/${escrowId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAddress: address
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        showToast.success('Escrow confirmed successfully!');
        fetchEscrows();
      } else {
        showToast.error(data.message || 'Error confirming escrow');
      }
    } catch (error) {
      console.error('Error confirming escrow:', error);
      showToast.error('Failed to confirm escrow', error);
    }
  };

  const handleDisputeEscrow = async (escrowId) => {
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
      await createDispute(escrowId, evidenceHash);
      
      showToast.success('Dispute created successfully!');
      fetchEscrows();
    } catch (error) {
      console.error('Error creating dispute:', error);
      showToast.error('Failed to create dispute', error);
    }
  };

  const handleCreateEscrow = async (e) => {
    e.preventDefault();
    
    if (!isConnected) {
      showToast.error('Please connect your wallet first');
      return;
    }

    const formData = new FormData(e.target);
    const sellerAddress = formData.get('sellerAddress');
    const amount = formData.get('amount');
    const description = formData.get('description');

    // Validate seller address
    if (!sellerAddress || !/^0x[a-fA-F0-9]{40}$/.test(sellerAddress)) {
      showToast.error('Please enter a valid seller address');
      return;
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      showToast.error('Please enter a valid amount');
      return;
    }

    // Validate or require terms hash
    if (!termsHash || !isValidIPFSHash(termsHash)) {
      showToast.error('Please upload terms document or provide IPFS hash');
      return;
    }

    try {
      // Use smart contract to create escrow
      const toastId = showToast.loading('Creating escrow...');
      
      await createEscrow(
        sellerAddress,
        null, // arbitrator (null for random selection)
        termsHash,
        amountNum
      );

      showToast.success('Escrow created successfully!');
      setShowCreateModal(false);
      setTermsHash('');
      e.target.reset();
      fetchEscrows();
    } catch (error) {
      console.error('Error creating escrow:', error);
      showToast.error('Failed to create escrow', error);
    }
  };

  const stats = {
    total: escrows.length,
    active: escrows.filter(e => e.status === 'Active').length,
    completed: escrows.filter(e => e.status === 'Completed').length,
    disputed: escrows.filter(e => e.status === 'Disputed').length
  };

  return (
    <>
      <Head>
        <title>Escrow - Aegora</title>
        <meta name="description" content="Manage your escrow transactions on Aegora" />
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
              <h1 className="text-3xl font-bold text-gray-900">Escrow</h1>
              <p className="text-gray-600 mt-2">Manage your secure transactions</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Create Escrow</span>
            </button>
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
                <Shield className="w-8 h-8 text-blue-600" />
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
                <Clock className="w-8 h-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
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
                <DollarSign className="w-8 h-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
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
                <Users className="w-8 h-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Disputed</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.disputed}</p>
                </div>
              </div>
            </motion.div>
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
                    placeholder="Search escrows..."
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
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                  <option value="Disputed">Disputed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
                
                <button
                  onClick={fetchEscrows}
                  disabled={loading}
                  className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>
          </div>

          {/* Escrows Grid */}
          {loading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <EscrowCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredEscrows.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No escrows found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Create your first escrow to get started.'
                }
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Escrow
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredEscrows.map((escrow, index) => (
                <motion.div
                  key={escrow.escrowId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <EscrowCard
                    escrow={escrow}
                    onView={handleViewEscrow}
                    onConfirm={handleConfirmEscrow}
                    onDispute={handleDisputeEscrow}
                  />
                </motion.div>
              ))}
            </div>
          )}

          {/* Create Escrow Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-lg p-6 w-full max-w-md mx-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Create New Escrow</h2>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleCreateEscrow} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Seller Address
                    </label>
                    <input
                      name="sellerAddress"
                      type="text"
                      placeholder="0x..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount (ETH)
                    </label>
                    <input
                      name="amount"
                      type="number"
                      step="0.001"
                      placeholder="0.1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      name="description"
                      placeholder="Describe the goods or services..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <IPFSUpload
                      label="Terms Document (IPFS)"
                      accept={{
                        'application/pdf': ['.pdf'],
                        'text/plain': ['.txt'],
                        'application/json': ['.json'],
                      }}
                      onUploadComplete={(hash) => {
                        if (hash) {
                          setTermsHash(hash);
                        }
                      }}
                    />
                    {termsHash && (
                      <p className="mt-2 text-xs text-green-600 dark:text-green-400">
                        ✓ Terms uploaded: {termsHash.slice(0, 20)}...
                      </p>
                    )}
                  </div>

                  <div className="flex space-x-4">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingEscrow || !termsHash}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCreatingEscrow ? 'Creating...' : 'Create Escrow'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
