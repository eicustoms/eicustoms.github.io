require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432/watchsite';
const poolOptions = {
  connectionString
};

if (process.env.DATABASE_SSL === 'true') {
  poolOptions.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolOptions);

const initDb = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id VARCHAR PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        message TEXT,
        custom_case TEXT,
        custom_bezel TEXT,
        custom_dial TEXT,
        custom_strap TEXT,
        custom_summary TEXT,
        received_at TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id VARCHAR PRIMARY KEY,
        author TEXT NOT NULL,
        service TEXT,
        image TEXT,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS gallery_metadata (
        filename TEXT PRIMARY KEY,
        display_name TEXT,
        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS image_optimizer_config (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        description TEXT,
        quality INT NOT NULL DEFAULT 80,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const result = await client.query('SELECT COUNT(*)::int AS count FROM image_optimizer_config');
    if (result.rows[0].count === 0) {
      await client.query(`
        INSERT INTO image_optimizer_config (filename, description, quality, active)
        VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)
      `, [
        'eitan1.jpg', 'About page portrait', 85, true,
        'herowatch.jpg', 'Homepage hero background', 85, true
      ]);
    }


    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database initialization failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  initDb
};
