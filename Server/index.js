import express from 'express';
import { nanoid } from 'nanoid';
import path from 'path';
import { fileURLToPath } from 'url';

// Since you're using ES Modules, __dirname is not available directly.
// This is the standard way to replicate its functionality.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

// In-memory "database" to store package information for this example.
// In a real application, you would use a proper database like MongoDB or PostgreSQL.
let packages = {};

// --- Middleware ---

// To parse JSON bodies from incoming requests.
app.use(express.json());

// To serve your static client-side files (HTML, CSS, JS).
// This resolves to C:\Users\Waterside\Desktop\SwiftCargo\Client
app.use(express.static(path.join(__dirname, '..', 'Client')));

app.get('/admin', (req, res) => {
  console.log('Admin page requested');
  res.sendFile(path.join(__dirname, '..', 'Client', 'admin.html'));
});

app.get('/track-result', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'Client', 'track-result.html'));
});

// --- API Endpoints ---

/**
 * Endpoint to register a new package.
 * It generates a unique tracking number using nanoid.
 */
app.post('/register-package', (req, res) => {
  console.log('Received request body:', req.body); // Log the request body
  const { sender, receiver } = req.body;

  if (!sender || !receiver || !sender.name || !receiver.name) {
    return res.status(400).json({ message: 'Sender and Receiver information is required.' });
  }

  const trackingNumber = nanoid(12); // Generates a 12-character unique ID.

  // Store the new package details.
  packages[trackingNumber] = {
    sender,
    receiver,
    status: 'Registered',
    location: sender.address,
    history: [{ status: 'Registered', location: sender.address, timestamp: new Date() }],
  };

  console.log(`Package registered: ${trackingNumber}`, packages[trackingNumber]);

  // Send the new tracking number back to the client.
  res.status(201).json({ trackingNumber });
});

/**
 * Endpoint to update a package's status.
 */
app.post('/update-status', (req, res) => {
  const { trackingNumber, status, location } = req.body;

  if (!packages[trackingNumber]) {
    return res.status(404).json({ message: 'Package not found.' });
  }

  // Update the package status and location
  packages[trackingNumber].status = status;
  packages[trackingNumber].location = location;
  // Add a new entry to the package's history
  packages[trackingNumber].history.push({ status, location, timestamp: new Date() });

  console.log(`Package ${trackingNumber} updated:`, packages[trackingNumber]);

  res.status(200).json({ message: `Package ${trackingNumber} status updated successfully.` });
});

/**
 * Endpoint to get a package's status and history.
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

app.post('/send-message', (req, res) => {
  const { name, email, subject, message } = req.body;
  console.log(`Received message from ${name} (${email}):`);
  console.log(`Subject: ${subject}`);
  console.log(`Message: ${message}`);
  res.status(200).json({ message: 'Message received successfully.' });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});