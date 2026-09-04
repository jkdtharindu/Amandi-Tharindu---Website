import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query(text, params) {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}

/**
 * Run `fn` against a single client inside a transaction, committing on success
 * and rolling back on any throw.
 *
 * `query` above takes a fresh client per call, so multi-statement work that has
 * to be all-or-nothing (applying a migration and recording it, for instance)
 * needs this instead.
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // The connection is already unusable; the original error is the useful one.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function migrate(sql) {
  await query(sql);
}

/** Lets short-lived scripts exit instead of idling on an open pool. */
export async function closePool() {
  await pool.end();
}
