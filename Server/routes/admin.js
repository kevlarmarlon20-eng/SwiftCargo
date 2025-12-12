import express from 'express';
import { nanoid } from 'nanoid';
import pool from '../db.js';
import Joi from 'joi';

const router = express.Router();

// --- Validation Schemas ---
const packagePersonSchema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    phone: Joi.string().required(),
    address: Joi.string().required(),
  });
  
  const packageShipmentInfoSchema = Joi.object({
    origin: Joi.string().required(),
    destination: Joi.string().required(),
    weight: Joi.number().positive().required(),
    eta: Joi.date().iso().required(),
  });
  
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
  
  const updatePackageSchema = Joi.object({
      sender: packagePersonSchema.optional(),
      receiver: packagePersonSchema.optional(),
      shipmentinfo: packageShipmentInfoSchema.optional()
  });

// --- Validation Middleware ---
const validate = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ message: error.details[0].message });
    }
    next();
};

/**
 * Register a new package.
 */
router.post('/register-package', validate(registerPackageSchema), async (req, res) => {
    console.log('Received registration request for package.');
  
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
    const status = 'pending';
    const location = shipmentInfo.origin;
  
    const initialHistoryEntry = {
      status: 'Package Registered',
      location: location,
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
        status,
        location,
        JSON.stringify([initialHistoryEntry]),
      ]);
  
      console.log(`Package registered: ${trackingNumber}`);
      res.status(201).json({ trackingNumber, message: 'Package registered successfully.' });
    } catch (err) {
      console.error('DB insert error:', err);
      res.status(500).json({ message: 'Error saving package to the database.' });
    }
  });

/**
 * Update a package's status by adding a new history event.
 */
router.post('/update-status', validate(updateStatusSchema), async (req, res) => {
    const trackingNumber = req.body['tracking-number'];
    const newStatus = req.body['new-status'];
    const location = req.body.location;
    const description = req.body['update-description'];
  
    const newEntry = {
        status: newStatus,
        location,
        description,
        timestamp: new Date().toISOString(),
    };

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const updateSQL = `
            UPDATE packages
            SET
                status = $1,
                location = $2,
                history = history || $3::jsonb
            WHERE trackingnumber = $4
        `;
        
        const result = await client.query(updateSQL, [newStatus, location, JSON.stringify([newEntry]), trackingNumber]);

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Package not found.' });
        }

        await client.query('COMMIT');
        
        console.log(`Package ${trackingNumber} status updated to ${newStatus}.`);
        res.status(200).json({ message: `Package ${trackingNumber} status updated successfully.` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('DB update error:', err);
        res.status(500).json({ message: 'Error updating package status.' });
    } finally {
        client.release();
    }
  });

/**
 * Get a list of all packages (for admin).
 */
router.get('/admin/packages', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM packages ORDER BY trackingnumber');
      res.status(200).json(result.rows);
    } catch (err) {
      console.error('DB select all error:', err);
      res.status(500).json({ message: 'Error fetching packages.' });
    }
  });

/**
 * Update a package's core details (for admin).
 */
router.put('/admin/package/:trackingNumber', validate(updatePackageSchema), async (req, res) => {
    const { trackingNumber } = req.params;
    const { sender, receiver, shipmentinfo } = req.body;
  
    try {
      const setParts = [];
      const values = [];
      let idx = 1;
      if (sender) { setParts.push(`sender = $${idx}::jsonb`); values.push(JSON.stringify(sender)); idx++; }
      if (receiver) { setParts.push(`receiver = $${idx}::jsonb`); values.push(JSON.stringify(receiver)); idx++; }
      if (shipmentinfo) { setParts.push(`shipmentinfo = $${idx}::jsonb`); values.push(JSON.stringify(shipmentinfo)); idx++; }
      
      if (setParts.length === 0) {
        return res.status(400).json({ message: 'No updatable fields provided.' });
      }
  
      const sql = `UPDATE packages SET ${setParts.join(', ')} WHERE trackingnumber = $${idx}`;
      values.push(trackingNumber);
      const updateRes = await pool.query(sql, values);
  
      if (updateRes.rowCount === 0) {
        return res.status(404).json({ message: 'Package not found.' });
      }
      
      console.log(`Package ${trackingNumber} details updated.`);
      res.status(200).json({ message: 'Package updated successfully.' });
    } catch (err) {
      console.error('DB update package error:', err);
      res.status(500).json({ message: 'Error updating package details.' });
    }
  });

/**
 * Delete a package (for admin).
 */
router.delete('/admin/package/:trackingNumber', async (req, res) => {
    const { trackingNumber } = req.params;
    try {
      const del = await pool.query('DELETE FROM packages WHERE trackingnumber = $1', [trackingNumber]);
      if (del.rowCount === 0) {
        return res.status(404).json({ message: 'Package not found.' });
      }
      console.log(`Package ${trackingNumber} deleted.`);
      res.status(200).json({ message: 'Package deleted.' });
    } catch (err) {
      console.error('DB delete package error:', err);
      res.status(500).json({ message: 'Error deleting package.' });
    }
  });

export default router;
