const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

/**
 * Creates and configures the Express application.
 * Separated from server.js to support testing (import app without starting listener).
 */
function createApp() {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS — dynamically allow dashboard and landing urls
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [
        'http://localhost:5173', // Dashboard (Vite)
        'http://localhost:5174', // Landing (Vite)
      ];

  app.use(cors({
    origin: allowedOrigins,
    credentials: true,
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Cookie parsing
  app.use(cookieParser());

  // API routes
  app.use('/api', routes);

  // Global error handler (must be after routes)
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
