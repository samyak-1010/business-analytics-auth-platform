const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function getPoolConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'amboras',
  };
}

async function run() {
  const pool = new Pool(getPoolConfig());

  try {
    const sqlPath = path.resolve(process.cwd(), 'sql', 'init.sql');
    const initSql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(initSql);
    console.log('Database initialized successfully.');
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});
