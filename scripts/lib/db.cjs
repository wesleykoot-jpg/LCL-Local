/**
 * PostgreSQL connection pool utility for Node.js scripts
 * Provides efficient connection management for direct database access
 */

const { Pool } = require('pg');
require('dotenv').config();

let pool = null;

/**
 * Gets or creates a PostgreSQL connection pool
 * @returns {Pool} PostgreSQL connection pool
 */
function getPool() {
  if (!pool) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    // Extract project reference from Supabase URL
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0];

    pool = new Pool({
      host: `db.${projectRef}.supabase.co`,
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: serviceRoleKey,
      ssl: { rejectUnauthorized: false },
      // Connection pool settings
      max: 5, // Maximum number of connections
      idleTimeoutMillis: 30000, // Close idle connections after 30s
      connectionTimeoutMillis: 2000, // Fail fast if can't connect
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected pool error:', err);
    });

    console.log('PostgreSQL connection pool created');
  }

  return pool;
}

/**
 * Executes a query using the connection pool
 * @param {string} sql - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(sql, params = []) {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

/**
 * Executes a transaction with multiple queries
 * @param {Function} callback - Async function that receives a client
 * @returns {Promise<any>} Result from callback
 */
async function transaction(callback) {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Closes the connection pool
 * Call this when your script is done to allow it to exit
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('PostgreSQL connection pool closed');
  }
}

/**
 * Gets pool statistics
 * @returns {Object} Pool statistics
 */
function getPoolStats() {
  if (!pool) return null;
  
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}

module.exports = {
  getPool,
  query,
  transaction,
  closePool,
  getPoolStats,
};
