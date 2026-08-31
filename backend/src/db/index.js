import pg from 'pg';
import config from '../config/env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
});

export const query = (text, params) => pool.query(text, params);

export const getClient = () => pool.connect();

export const closePool = () => pool.end();

export default {
  pool,
  query,
  getClient,
  closePool,
};
