const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const db = require('./db');
const logger = require('./utils/logger');
const { validateEnvironment } = require('./config/env');

// Validate environment variables before starting
const envValidation = validateEnvironment();
if (!envValidation.valid) {
  logger.error('Environment validation failed:');
  envValidation.errors.forEach(error => logger.error(`  - ${error}`));
  process.exit(1);
}

// Log warnings
if (envValidation.warnings.length > 0) {
  logger.warn('Environment validation warnings:');
  envValidation.warnings.forEach(warning => logger.warn(`  - ${warning}`));
}

// Import routes
const disputeRoutes = require('./routes/disputes');
const escrowRoutes = require('./routes/escrow');
const reputationRoutes = require('./routes/reputation');
const jurorRoutes = require('./routes/jurors');
const p2pRoutes = require('./routes/p2p');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS whitelist: support comma-separated FRONTEND_CORS or single FRONTEND_URL
const rawCors = process.env.FRONTEND_CORS || process.env.FRONTEND_URL || 'http://localhost:3000,http://localhost:3002';
const allowedOrigins = rawCors.split(',').map(s => s.trim()).filter(Boolean);
logger.info(`CORS allowed origins: ${allowedOrigins.join(', ')}`);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g., curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
    return callback(new Error(msg), false);
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Mock data endpoints (for development without database)
app.get('/api/escrow/stats/overview', (req, res) => {
  res.json({
    success: true,
    data: {
      total: 0,
      active: 0,
      completed: 0,
      disputed: 0,
      byStatus: []
    }
  });
});

app.get('/api/disputes/stats/overview', (req, res) => {
  res.json({
    success: true,
    data: {
      total: 0,
      pending: 0,
      resolved: 0,
      byStatus: []
    }
  });
});

app.get('/api/reputation/stats/overview', (req, res) => {
  res.json({
    success: true,
    data: {
      totalUsers: 0,
      averageScore: 0,
      topPerformers: []
    }
  });
});

app.get('/api/jurors/stats/overview', (req, res) => {
  res.json({
    success: true,
    data: {
      active: 0,
      inactive: 0,
      total: 0,
      totalStake: 0,
      avgReputation: 0,
      avgAccuracy: 0
    }
  });
});

// API routes
app.use('/api/disputes', disputeRoutes);
app.use('/api/escrow', escrowRoutes);
app.use('/api/reputation', reputationRoutes);
app.use('/api/jurors', jurorRoutes);
app.use('/api/p2p', p2pRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      details: err.details
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing authentication token'
    });
  }
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    // Connect to database (optional for development)
    const connected = await db.connect();
    if (connected === false) {
      logger.warn('Database connection failed, running in mock mode: connection not established');
    } else {
      logger.info('Database connected successfully');
    }
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`Aegora Backend API server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
