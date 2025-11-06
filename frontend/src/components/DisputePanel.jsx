import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Scale, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Eye,
  Vote,
  FileText
} from 'lucide-react';

const DisputePanel = ({ dispute, onView, onVote }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Active':
        return 'bg-blue-100 text-blue-800';
      case 'Resolved':
        return 'bg-green-100 text-green-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Pending':
        return <Clock className="w-4 h-4" />;
      case 'Active':
        return <AlertTriangle className="w-4 h-4" />;
      case 'Resolved':
        return <CheckCircle className="w-4 h-4" />;
      case 'Rejected':
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

      {/* Dispute Info */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Escrow #{dispute.escrowId}</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Buyer:</span>
            <span className="ml-2 font-medium text-gray-900">{dispute.buyer}</span>
          </div>
          <div>
            <span className="text-gray-600">Seller:</span>
            <span className="ml-2 font-medium text-gray-900">{dispute.seller}</span>
          </div>
        </div>
      </div>

      {/* Evidence */}
      {dispute.evidence && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Evidence</h4>
          <p className="text-sm text-gray-600">{dispute.evidence.description}</p>
          {dispute.evidence.hash && (
            <p className="text-xs text-gray-500 mt-1 font-mono">{dispute.evidence.hash}</p>
          )}
        </div>
      )}

      {/* Timeline */}
      {dispute.timeline && dispute.timeline.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Activity</h4>
          <div className="space-y-2">
            {dispute.timeline.slice(-2).map((event, index) => (
              <div key={index} className="text-sm">
                <span className="font-medium text-gray-900">{event.action}</span>
                <span className="text-gray-600 ml-2">by {event.actor}</span>
                <span className="text-gray-500 ml-2 text-xs">
                  {new Date(event.timestamp).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex space-x-2">
        <button
          onClick={() => onView(dispute)}
          className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          aria-label={`View dispute ${dispute.disputeId} details`}
        >
          <Eye className="w-4 h-4" />
          <span>View Details</span>
        </button>
        
        {dispute.status === 'Active' && (
          <button
            onClick={() => onVote(dispute.disputeId, true)}
            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
            aria-label="Vote for buyer"
          >
            <Vote className="w-4 h-4" />
            <span>Vote For</span>
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default DisputePanel;
