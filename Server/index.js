import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pool from './db.js';
import packagesRouter from './routes/packages.js';
import adminRouter from './routes/admin.js';

// Load environment variables from .env file
dotenv.config();

// --- Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 8080;

// --- Authentication Middleware ---
const ADMIN_SECRET_TOKEN = process.env.ADMIN_SECRET_TOKEN;

if (!ADMIN_SECRET_TOKEN) {
  console.error('CRITICAL ERROR: ADMIN_SECRET_TOKEN is not set in the environment variables.');
  process.exit(1);
}

const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: Missing or invalid token.' });
  }
  const token = authHeader.split(' ')[1];
  if (token !== ADMIN_SECRET_TOKEN) {
    return res.status(403).json({ message: 'Forbidden: Incorrect token.' });
  }
  next();
};

// --- General Middleware ---
app.use(express.json()); // To parse JSON bodies
app.use(express.static(path.join(__dirname, '..', 'Client'))); // Serve static files

// --- Static Page Routes ---
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'Client', 'admin.html'));
});
app.get('/track-result', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'Client', 'track-result.html'));
});


// --- API Endpoints ---
app.use('/', packagesRouter);
app.use('/', authenticateAdmin, adminRouter);


// --- Server Initialization ---
(async () => {
  try {
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
      console.log(`Admin panel available at http://localhost:${port}/admin`);
    });
  } catch (err) {
    console.error('Failed to initialize server:', err);
    process.exit(1);
  }
})();

// --- Graceful Shutdown ---
const shutdown = async () => {
  console.log('Shutting down server...');
  try {
    await pool.end();
    console.log('Postgres pool has ended.');
    process.exit(0);
  } catch (err) {
    console.error('Error closing Postgres pool:', err);
    process.exit(1);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);