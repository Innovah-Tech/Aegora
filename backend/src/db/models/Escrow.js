const mongoose = require('mongoose');

const escrowSchema = new mongoose.Schema({
  escrowId: {
    type: Number,
    required: true,
    unique: true
  },
  buyer: {
    type: String,
    required: true,
    lowercase: true
  },
  seller: {
    type: String,
    required: true,
    lowercase: true
  },
  arbitrator: {
    type: String,
    lowercase: true,
    default: null
  },
  amount: {
    type: Number,
    required: true
  },
  tokenAddress: {
    type: String,
    default: null
  },
  termsHash: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Active', 'Completed', 'Disputed', 'Cancelled'],
    default: 'Active'
  },
  buyerConfirmed: {
    type: Boolean,
    default: false
  },
  sellerConfirmed: {
    type: Boolean,
    default: false
  },
  evidenceHash: {
    type: String,
    default: null
  },
  evidenceDescription: {
    type: String,
    default: ''
  },
  completedAt: {
    type: Date,
    default: null
  },
  transactionHash: {
    type: String,
    default: null
  },
  blockNumber: {
    type: Number,
    default: null
  },
  timeline: [{
    action: {
      type: String,
      required: true
    },
    actor: {
      type: String,
      required: true,
      lowercase: true
    },
    details: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Add timeline event method
escrowSchema.methods.addTimelineEvent = function(action, actor, details) {
  this.timeline.push({
    action,
    actor,
    details,
    timestamp: new Date()
  });
};

// Index for efficient queries
escrowSchema.index({ buyer: 1 });
escrowSchema.index({ seller: 1 });
escrowSchema.index({ status: 1 });
escrowSchema.index({ createdAt: -1 });
escrowSchema.index({ transactionHash: 1 });

module.exports = mongoose.model('Escrow', escrowSchema);
