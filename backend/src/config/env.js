/**
 * Environment variable validation
 * Ensures all required environment variables are set before starting the server
 */

const requiredEnvVars = {
  // Production required vars
  production: [
    'MONGODB_URI',
    'NODE_ENV'
  ],
  // Development required vars
  development: [],
  // Test required vars
  test: []
};

const optionalEnvVars = {
  // Backend optional vars
  PORT: '3001',
  IPFS_URL: 'http://localhost:5001',
  IPFS_GATEWAY: 'https://ipfs.io/ipfs/',
  IPFS_ENABLED: 'false',
  FRONTEND_URL: 'http://localhost:3000',
  FRONTEND_CORS: '',
  U2U_RPC_URL: 'https://rpc.u2u.xyz',
  JWT_SECRET: null // Will warn if not set
};

function validateEnvironment() {
  const env = process.env.NODE_ENV || 'development';
  const required = requiredEnvVars[env] || [];
  const errors = [];
  const warnings = [];

  // Check required variables
  for (const varName of required) {
    if (!process.env[varName]) {
      errors.push(`Required environment variable ${varName} is not set`);
    }
  }

  // Check optional variables with defaults
  for (const [varName, defaultValue] of Object.entries(optionalEnvVars)) {
    if (!process.env[varName] && defaultValue !== null) {
      process.env[varName] = defaultValue;
    } else if (!process.env[varName] && defaultValue === null) {
      warnings.push(`Optional environment variable ${varName} is not set (may cause issues)`);
    }
  }

  // Special validation for JWT_SECRET
  if (env === 'production' && !process.env.JWT_SECRET) {
    errors.push('JWT_SECRET is required in production environment');
  } else if (env !== 'production' && !process.env.JWT_SECRET) {
    const crypto = require('crypto');
    process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
    warnings.push('JWT_SECRET was auto-generated for development');
  }

  // Validate MongoDB URI format
  if (process.env.MONGODB_URI) {
    const mongoUriPattern = /^mongodb(\+srv)?:\/\//;
    if (!mongoUriPattern.test(process.env.MONGODB_URI)) {
      errors.push('MONGODB_URI format is invalid');
    }
  }

  // Validate port number
  if (process.env.PORT) {
    const port = parseInt(process.env.PORT, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push('PORT must be a number between 1 and 65535');
    }
  }

  // Validate CORS origins
  if (process.env.FRONTEND_CORS) {
    const origins = process.env.FRONTEND_CORS.split(',');
    for (const origin of origins) {
      try {
        new URL(origin.trim());
      } catch (e) {
        errors.push(`Invalid CORS origin: ${origin}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

module.exports = {
  validateEnvironment,
  requiredEnvVars,
  optionalEnvVars
};

