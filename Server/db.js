import { Pool } from 'pg';

// --- Database Configuration ---
const PG_CONFIG = {
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'swiftcargo',
};

const pool = new Pool(PG_CONFIG);

export default pool;
