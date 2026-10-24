require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Ensure db initialization
require('./db');

const authRouter = require('./routes/auth');
const pricingRouter = require('./routes/pricing');
const usersRouter = require('./routes/users');
const telemetryRouter = require('./routes/telemetry');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve Frontend Static Web Application
const frontendPath = path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/pricing', pricingRouter);
app.use('/api/admin/users', usersRouter);
app.use('/api/stats', telemetryRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'InkOver Studio Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Fallback to frontend index.html for root routes if requested
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 InkOver Backend running on: http://localhost:${PORT}`);
  console.log(`📡 API Endpoints available at: http://localhost:${PORT}/api`);
  console.log(`🌐 Serving Frontend from: ${frontendPath}`);
  console.log(`=================================================`);
});
