const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema({
  disputeId: {
    type: Number,
    required: true,
    unique: true
  },
  escrowId: {
    type: Number,
    required: true
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
  jurors: [{
    address: {
      type: String,
      required: true,
      lowercase: true
    },
    stake: {
      type: Number,
      required: true
    },
    vote: {
      type: String,
      enum: ['None', 'Buyer', 'Seller'],
      default: 'None'
    },
    hasVoted: {
      type: Boolean,
      default: false
    }
  }],
  status: {
    type: String,
    enum: ['Pending', 'InProgress', 'Resolved', 'Cancelled'],
    default: 'Pending'
  },
  evidence: {
    hash: {
      type: String,
      required: true
    },
    description: String,
    files: [{
      name: String,
      hash: String,
      size: Number,
      type: String
    }]
  },
  votes: {
    buyerVotes: {
      type: Number,
      default: 0
    },
    sellerVotes: {
      type: Number,
      default: 0
    },
    totalStake: {
      type: Number,
      default: 0
    }
  },
  resolution: {
    winner: {
      type: String,
      lowercase: true
    },
    reason: String,
    resolvedAt: Date
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
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: String
  }],
  transactionHash: {
    type: String,
    default: null
  },
  blockNumber: {
    type: Number,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
disputeSchema.index({ disputeId: 1 });
disputeSchema.index({ escrowId: 1 });
disputeSchema.index({ buyer: 1 });
disputeSchema.index({ seller: 1 });
disputeSchema.index({ status: 1 });
disputeSchema.index({ transactionHash: 1 });
disputeSchema.index({ createdAt: -1 });

// Middleware
disputeSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Methods
disputeSchema.methods.addTimelineEvent = function(action, actor, details = '') {
  this.timeline.push({
    action,
    actor,
    details,
    timestamp: new Date()
  });
  return this.save();
};

disputeSchema.methods.updateVote = function(jurorAddress, vote) {
  const juror = this.jurors.find(j => j.address === jurorAddress.toLowerCase());
  if (juror) {
    juror.vote = vote;
    juror.hasVoted = true;
    
    if (vote === 'Buyer') {
      this.votes.buyerVotes += 1;
    } else if (vote === 'Seller') {
      this.votes.sellerVotes += 1;
    }
    
    return this.save();
  }
  throw new Error('Juror not found');
};

disputeSchema.methods.resolveDispute = function(winner, reason = '') {
  this.status = 'Resolved';
  this.resolution.winner = winner.toLowerCase();
  this.resolution.reason = reason;
  this.resolution.resolvedAt = new Date();
  
  this.addTimelineEvent('Dispute Resolved', 'system', `Winner: ${winner}, Reason: ${reason}`);
  
  return this.save();
};

// Static methods
disputeSchema.statics.findByUser = function(userAddress) {
  return this.find({
    $or: [
      { buyer: userAddress.toLowerCase() },
      { seller: userAddress.toLowerCase() }
    ]
  }).sort({ createdAt: -1 });
};

disputeSchema.statics.findByJuror = function(jurorAddress) {
  return this.find({
    'jurors.address': jurorAddress.toLowerCase()
  }).sort({ createdAt: -1 });
};

disputeSchema.statics.getActiveDisputes = function() {
  return this.find({
    status: { $in: ['Pending', 'InProgress'] }
  }).sort({ createdAt: -1 });
};

disputeSchema.statics.getDisputeStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

module.exports = mongoose.model('Dispute', disputeSchema);
