require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createLogger, format, transports } = require('winston');

const app = express();
const PORT = process.env.PORT || 3001;

// Logger setup
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.simple()
    })
  ]
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clipeos')
  .then(() => logger.info('Connected to MongoDB'))
  .catch(err => logger.error('MongoDB connection error:', err));

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Clipeos API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      clips: '/api/clips',
      analytics: '/api/analytics'
    }
  });
});

// Auth routes
app.use('/api/auth', require('./routes/auth'));

// Clip processing routes
app.use('/api/clips', require('./routes/clips'));

// Analytics routes
app.use('/api/analytics', require('./routes/analytics'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);

  // Initialize AI models
  setTimeout(() => {
    logger.info('Loading AI models for clip optimization...');
  }, 1000);
});

module.exports = app;