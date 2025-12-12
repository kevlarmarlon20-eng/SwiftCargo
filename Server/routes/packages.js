import express from 'express';
import pool from '../db.js';
import Joi from 'joi';
import { getCoordinates, batchGetCoordinates } from '../utils/coordinates.js';

const router = express.Router();

// --- Validation Schemas ---
const trackingNumberSchema = Joi.object({
    trackingNumber: Joi.string().alphanum().required(),
});

const contactSchema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    message: Joi.string().required(),
});


const validate = (schema, property) => (req, res, next) => {
    const { error } = schema.validate(req[property]);
    if (error) {
        return res.status(400).json({ message: error.details[0].message });
    }
    next();
};

/**
 * Get public tracking information for a single package.
 * Includes coordinates for each history entry for real-time map tracking.
 */
router.get('/track/:trackingNumber', validate(trackingNumberSchema, 'params'), async (req, res) => {
  const { trackingNumber } = req.params;
  try {
    const result = await pool.query(
      `SELECT trackingnumber, sender, receiver, shipmentinfo, status, location, history
       FROM packages WHERE trackingnumber = $1`,
      [trackingNumber]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Package not found.' });
    }

    const row = result.rows[0];
    const history = row.history || [];

    // Geocode locations from history for map display
    const locationsToGeocode = [];
    history.forEach(item => {
      if (item.location && !locationsToGeocode.includes(item.location)) {
        locationsToGeocode.push(item.location);
      }
    });

    // Also geocode current location
    if (row.location && !locationsToGeocode.includes(row.location)) {
      locationsToGeocode.push(row.location);
    }

    // Get coordinates for all locations
    const coordinateMap = locationsToGeocode.length > 0
      ? await batchGetCoordinates(locationsToGeocode)
      : {};

    // Add coordinates to history entries
    const enrichedHistory = history.map(item => ({
      ...item,
      coordinates: coordinateMap[item.location] || null,
    }));

    // Map DB (snake_case) to API (camelCase) so the client receives what it expects
    const response = {
      trackingNumber: row.trackingnumber,
      sender: row.sender || null,
      receiver: row.receiver || null,
      shipmentInfo: row.shipmentinfo || null,
      status: row.status || null,
      location: row.location || null,
      coordinates: coordinateMap[row.location] || null,
      history: enrichedHistory,
    };

    res.status(200).json(response);
  } catch (err) {
    console.error('DB select error:', err);
    res.status(500).json({ message: 'Error fetching package information.' });
  }
});

/**
 * Endpoint for the contact form.
 */
router.post('/contact', validate(contactSchema, 'body'), async (req, res) => {
    const { name, email, message } = req.body;
    try {
      const result = await pool.query(
        'INSERT INTO contact_messages (name, email, message) VALUES ($1, $2, $3) RETURNING id',
        [name, email, message]
      );
      console.log(`Received message from ${name} (${email}): ${message}. Saved with id: ${result.rows[0].id}`);
      res.status(200).json({ message: 'Message received successfully.' });
    } catch (err) {
      console.error('DB insert error:', err);
      res.status(500).json({ message: 'Error saving message.' });
    }
  });

export default router;
