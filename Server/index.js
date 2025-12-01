import express from 'express';
import { nanoid } from 'nanoid';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Since you're using ES Modules, __dirname is not available directly.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'db.json');

const app = express();
const port = process.env.PORT || 8080;

// In-memory "database"
let packages = {};

// --- Database Functions ---
const loadPackages = () => {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf8');
      packages = JSON.parse(data);
      console.log('Database loaded successfully.');
    } else {
      console.log('No database file found, starting with an empty one.');
    }
  } catch (error) {
    console.error('Error loading database:', error);
  }
};

const savePackages = () => {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(packages, null, 2));
    console.log('Database saved successfully.');
  } catch (error) {
    console.error('Error saving database:', error);
  }
};


// --- Authentication ---
const ADMIN_SECRET_TOKEN = 'Waterside'; // In a real app, use environment variables!

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
app.post('/register-package', authenticateAdmin, (req, res) => {
  console.log('Received registration request:', req.body);

  // Destructure all fields from the request body.
  // Assumes your client-side JS will send JSON matching these keys.
  // If using standard form post, keys will be like 'sender-name', etc.
  // This code handles both JSON (assuming client.js formats it)
  // and form-urlencoded (accessing 'sender-name' etc.).

  const sender = {
    name: req.body['sender-name'] || req.body.sender?.name,
    email: req.body['sender-email'] || req.body.sender?.email,
    phone: req.body['sender-phone'] || req.body.sender?.phone,
    address: req.body['sender-address'] || req.body.sender?.address,
  };

  const receiver = {
    name: req.body['receiver-name'] || req.body.receiver?.name,
    email: req.body['receiver-email'] || req.body.receiver?.email,
    phone: req.body['receiver-phone'] || req.body.receiver?.phone,
    address: req.body['receiver-address'] || req.body.receiver?.address,
  };

  const shipmentInfo = {
    origin: req.body.origin,
    destination: req.body.destination,
    weight: req.body.weight,
    eta: req.body.eta,
  };

  // Validation
  if (
    !sender.name ||
    !receiver.name ||
    !shipmentInfo.origin ||
    !shipmentInfo.destination
  ) {
    return res.status(400).json({
      message: 'Missing required fields: sender, receiver, origin, or destination.',
    });
  }

  const trackingNumber = `SC${nanoid(10).toUpperCase()}`; // e.g., SC12345ABCDE

  // Store the new package details
  packages[trackingNumber] = {
    trackingNumber,
    sender,
    receiver,
    shipmentInfo, // **ADDED**
    status: 'Pending', // More descriptive initial status
    location: shipmentInfo.origin,
    history: [
      {
        status: 'Package Registered',
        location: shipmentInfo.origin,
        description: 'Shipment information received and registered.',
        timestamp: new Date(),
      },
    ],
  };
  savePackages();

  console.log(`Package registered: ${trackingNumber}`, packages[trackingNumber]);

  // Send the new tracking number back to the client
  res.status(201).json({ trackingNumber, message: "Package registered successfully." });
});

/**
 * Endpoint to update a package's status.
 * **UPDATED** to accept all fields from the update form.
 */
app.post('/update-status', authenticateAdmin, (req, res) => {
  console.log('Received update request:', req.body);

  // Use bracket notation to handle kebab-case names from the HTML form
  const trackingNumber = req.body['tracking-number'];
  const status = req.body['new-status'];
  const location = req.body.location;
  const description = req.body['update-description'];

  if (!trackingNumber || !status || !location || !description) {
    return res.status(400).json({
      message: 'Missing required fields: trackingNumber, status, location, or description.',
    });
  }

  if (!packages[trackingNumber]) {
    return res.status(404).json({ message: 'Package not found.' });
  }

  // Update the package's current status and location
  packages[trackingNumber].status = status;
  packages[trackingNumber].location = location;

  // Add a new entry to the package's history
  packages[trackingNumber].history.push({
    status,
    location,
    description, // **ADDED**
    timestamp: new Date(),
  });
  savePackages();

  console.log(`Package ${trackingNumber} updated:`, packages[trackingNumber]);

  res.status(200).json({
    message: `Package ${trackingNumber} status updated successfully.`,
  });
});

/**
 * Endpoint to get a package's status and history. (No changes needed)
 */
app.get('/track/:trackingNumber', (req, res) => {
  const { trackingNumber } = req.params;
  const packageInfo = packages[trackingNumber];

  if (packageInfo) {
    res.status(200).json(packageInfo);
  } else {
    res.status(404).json({ message: 'Package not found.' });
  }
});

/**
 * Endpoint for the contact form. (No changes needed)
 */
app.post('/send-message', (req, res) => {
  const { name, email, subject, message } = req.body;
  console.log(`Received message from ${name} (${email}):`);
  console.log(`Subject: ${subject}`);
  console.log(`Message: ${message}`);
  // In a real app, you'd email this or save it.
  res.status(200).json({ message: 'Message received successfully.' });
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

app.listen(port, () => {
  loadPackages();
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`Admin panel available at http://localhost:${port}/admin`);
});