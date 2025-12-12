import express from 'express';
import { nanoid } from 'nanoid';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import Joi from 'joi';

// Load environment variables from .env file
dotenv.config();

// Since you're using ES Modules, __dirname is not available directly.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 8080;

// Postgres configuration via environment variables.
// Provide sensible defaults for local development but encourage using env vars.
const PG_CONFIG = {
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'swiftcargo',
};

const pool = new Pool(PG_CONFIG);

async function ensureDb() {
  // Attempt a simple query to see if the database exists / is reachable
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    // If database does not exist (Postgres error code 3D000), try to create it
    if (err && err.code === '3D000') {
      console.log(`Database ${PG_CONFIG.database} does not exist. Attempting to create it using maintenance DB.`);
      const adminDb = process.env.PGADMIN_DB || 'postgres';
      const adminConfig = { ...PG_CONFIG, database: adminDb };
      const adminPool = new Pool(adminConfig);
      try {
        // CREATE DATABASE cannot run inside a transaction in Postgres; pg runs single queries fine
        await adminPool.query(`CREATE DATABASE ${PG_CONFIG.database}`);
        console.log(`Database ${PG_CONFIG.database} created.`);
      } catch (createErr) {
        console.error('Error creating database:', createErr);
        throw createErr;
      } finally {
        await adminPool.end();
      }
    } else {
      // Unknown error — rethrow for the caller to handle
      throw err;
    }
  }

  // Create table if it doesn't exist. history is stored as JSONB array.
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS packages (
      trackingnumber VARCHAR(32) PRIMARY KEY,
      sender JSONB,
      receiver JSONB,
      shipmentinfo JSONB,
      status TEXT,
      location TEXT,
      history JSONB
    );
  `;
  await pool.query(createTableSQL);
}


// --- Authentication ---
// Use environment variable with a prototype fallback
const ADMIN_SECRET_TOKEN = process.env.ADMIN_SECRET_TOKEN || 'Waterside';

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

// --- Validation Schemas and Middleware ---

const registerPackageSchema = Joi.object({
    'sender-name': Joi.string().required(),
    'sender-email': Joi.string().email().required(),
    'sender-phone': Joi.string().required(),
    'sender-address': Joi.string().required(),
    'receiver-name': Joi.string().required(),
    'receiver-email': Joi.string().email().required(),
    'receiver-phone': Joi.string().required(),
    'receiver-address': Joi.string().required(),
    'origin': Joi.string().required(),
    'destination': Joi.string().required(),
    'weight': Joi.number().positive().required(),
    'eta': Joi.date().iso().required()
});

const updateStatusSchema = Joi.object({
    'tracking-number': Joi.string().required(),
    'new-status': Joi.string().valid('pending', 'in-transit', 'out-for-delivery', 'delivered', 'on-hold', 'cancelled').required(),
    'location': Joi.string().required(),
    'update-description': Joi.string().required()
});

const validate = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ message: error.details[0].message });
    }
    next();
};


// --- Middleware ---

// To parse JSON bodies (from fetch requests)
app.use(express.json());
// **ADDED:** To parse URL-encoded bodies (from standard form submissions)
app.use(express.urlencoded({ extended: true }));

// Serve static files (HTML, CSS, JS) from the 'Client' directory
app.use(express.static(path.join(__dirname, '..', 'Client')));

// --- Static Page Routes ---

// Route to serve your admin.html
app.get('/admin', (req, res) => {
  console.log('Admin page requested');
  res.sendFile(path.join(__dirname, '..', 'Client', 'admin.html'));
});

// Route to serve your track-result.html
app.get('/track-result', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'Client', 'track-result.html'));
});

// --- API Endpoints ---

/**
 * Endpoint to register a new package.
 * **UPDATED** to accept all new fields from the new form.
 */
app.post('/register-package', authenticateAdmin, validate(registerPackageSchema), async (req, res) => {
  console.log('Received registration request:', req.body);

  const sender = {
    name: req.body['sender-name'],
    email: req.body['sender-email'],
    phone: req.body['sender-phone'],
    address: req.body['sender-address'],
  };

  const receiver = {
    name: req.body['receiver-name'],
    email: req.body['receiver-email'],
    phone: req.body['receiver-phone'],
    address: req.body['receiver-address'],
  };

  const shipmentInfo = {
    origin: req.body.origin,
    destination: req.body.destination,
    weight: req.body.weight,
    eta: req.body.eta,
  };

  const trackingNumber = `SC${nanoid(10).toUpperCase()}`;

  const initialHistoryEntry = {
    status: 'Package Registered',
    location: shipmentInfo.origin,
    description: 'Shipment information received and registered.',
    timestamp: new Date().toISOString(),
  };

  const insertSQL = `
    INSERT INTO packages (trackingnumber, sender, receiver, shipmentinfo, status, location, history)
    VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $6, $7::jsonb)
  `;

  try {
    await pool.query(insertSQL, [
      trackingNumber,
      JSON.stringify(sender),
      JSON.stringify(receiver),
      JSON.stringify(shipmentInfo),
      'pending',
      shipmentInfo.origin,
      JSON.stringify([initialHistoryEntry]),
    ]);

    console.log(`Package registered: ${trackingNumber}`);
    res.status(201).json({ trackingNumber, message: 'Package registered successfully.' });
  } catch (err) {
    console.error('DB insert error:', err);
    res.status(500).json({ message: 'Error saving package.' });
  }
});

/**
 * Endpoint to update a package's status.
 * **UPDATED** to accept all fields from the update form.
 */
app.post('/update-status', authenticateAdmin, validate(updateStatusSchema), async (req, res) => {
  console.log('Received update request:', req.body);

  const trackingNumber = req.body['tracking-number'];
  const status = req.body['new-status'];
  const location = req.body.location;
  const description = req.body['update-description'];

  try {
    // Fetch existing history
    const selectRes = await pool.query('SELECT history FROM packages WHERE trackingnumber = $1', [trackingNumber]);
    if (selectRes.rowCount === 0) return res.status(404).json({ message: 'Package not found.' });

    const existingHistory = selectRes.rows[0].history || [];
    const newEntry = {
      status,
      location,
      description,
      timestamp: new Date().toISOString(),
    };

    const updatedHistory = [...existingHistory, newEntry];

    const updateSQL = `
      UPDATE packages
      SET status = $1, location = $2, history = $3::jsonb
      WHERE trackingnumber = $4
    `;

    await pool.query(updateSQL, [status, location, JSON.stringify(updatedHistory), trackingNumber]);

    res.status(200).json({ message: `Package ${trackingNumber} status updated successfully.` });
  } catch (err) {
    console.error('DB update error:', err);
    res.status(500).json({ message: 'Error updating package.' });
  }
});

/**
 * Endpoint to get a package's status and history. (No changes needed)
 */
app.get('/track/:trackingNumber', async (req, res) => {
  const { trackingNumber } = req.params;
  try {
    const result = await pool.query('SELECT * FROM packages WHERE trackingnumber = $1', [trackingNumber]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Package not found.' });

    // Return row with JSON fields parsed already by pg
    const row = result.rows[0];
    res.status(200).json({
      trackingNumber: row.trackingnumber,
      sender: row.sender,
      receiver: row.receiver,
      shipmentInfo: row.shipmentinfo,
      status: row.status,
      location: row.location,
      history: row.history,
    });
  } catch (err) {
    console.error('DB select error:', err);
    res.status(500).json({ message: 'Error fetching package.' });
  }
});

/**
 * Endpoint for the contact form.
 */
app.post('/contact', (req, res) => {
  const { name, email, message } = req.body;
  console.log(`Received message from ${name} (${email}):`);
  console.log(`Message: ${message}`);
  // In a real app, you'd email this or save it.
  res.status(200).json({ message: 'Message received successfully.' });
});

// --- Start Server ---

// Initialize DB then start server
(async () => {
  try {
    await ensureDb();
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
      console.log(`Admin panel available at http://localhost:${port}/admin`);
    });
  } catch (err) {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  }
})();

// Graceful shutdown for Postgres pool
const shutdown = async () => {
  console.log('Shutting down server...');
  try {
    await pool.end();
    console.log('Postgres pool has ended.');
  } catch (err) {
    console.error('Error closing Postgres pool:', err);
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);