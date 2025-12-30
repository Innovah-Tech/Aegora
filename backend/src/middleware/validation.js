const Joi = require('joi');

/**
 * Validation middleware factory
 * @param {Object} schema - Joi schema object
 * @param {string} property - Property to validate (body, query, params)
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    // Replace request property with validated and sanitized value
    req[property] = value;
    next();
  };
};

// Common validation schemas
const schemas = {
  // Ethereum address validation
  ethereumAddress: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/)
    .required()
    .messages({
      'string.pattern.base': 'must be a valid Ethereum address'
    }),

  // Positive integer
  positiveInteger: Joi.number().integer().positive().required(),

  // Positive number
  positiveNumber: Joi.number().positive().required(),

  // IPFS hash (basic validation)
  ipfsHash: Joi.string()
    .pattern(/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z0-9]{50,})$/)
    .required(),

  // Pagination
  pagination: {
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0)
  }
};

// Escrow validation schemas
const escrowSchemas = {
  create: Joi.object({
    buyer: schemas.ethereumAddress,
    seller: schemas.ethereumAddress,
    arbitrator: Joi.string()
      .pattern(/^0x[a-fA-F0-9]{40}$/)
      .allow(null, '')
      .optional(),
    amount: schemas.positiveNumber,
    tokenAddress: Joi.string()
      .pattern(/^0x[a-fA-F0-9]{40}$/)
      .allow(null, '')
      .optional(),
    termsHash: schemas.ipfsHash,
    onChainEscrowId: Joi.number().integer().positive().optional(),
    transactionHash: Joi.string()
      .pattern(/^0x[a-fA-F0-9]{64}$/)
      .optional(),
    blockNumber: Joi.number().integer().positive().optional()
  }),

  confirm: Joi.object({
    userAddress: schemas.ethereumAddress
  }),

  dispute: Joi.object({
    userAddress: schemas.ethereumAddress,
    evidenceHash: schemas.ipfsHash,
    evidenceDescription: Joi.string().max(1000).optional()
  }),

  list: Joi.object({
    status: Joi.string()
      .valid('Active', 'Completed', 'Disputed', 'Cancelled')
      .optional(),
    user: schemas.ethereumAddress.optional(),
    ...schemas.pagination
  })
};

// Dispute validation schemas
const disputeSchemas = {
  create: Joi.object({
    escrowId: schemas.positiveInteger,
    userAddress: schemas.ethereumAddress,
    evidenceHash: schemas.ipfsHash,
    evidenceDescription: Joi.string().max(1000).optional()
  }),

  vote: Joi.object({
    disputeId: schemas.positiveInteger,
    voteHash: Joi.string()
      .pattern(/^0x[a-fA-F0-9]{64}$/)
      .required(),
    vote: Joi.string().valid('Buyer', 'Seller').optional(),
    nonce: Joi.string().when('vote', {
      is: Joi.exist(),
      then: Joi.required(),
      otherwise: Joi.optional()
    })
  }),

  list: Joi.object({
    status: Joi.string()
      .valid('Pending', 'InProgress', 'Resolved', 'Cancelled')
      .optional(),
    user: schemas.ethereumAddress.optional(),
    ...schemas.pagination
  })
};

// Reputation validation schemas
const reputationSchemas = {
  getUser: Joi.object({
    userAddress: schemas.ethereumAddress
  })
};

// Juror validation schemas
const jurorSchemas = {
  register: Joi.object({
    stake: schemas.positiveNumber
  })
};

module.exports = {
  validate,
  schemas,
  escrowSchemas,
  disputeSchemas,
  reputationSchemas,
  jurorSchemas
};

