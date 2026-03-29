const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');
const { Pool } = require('pg');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const EVENT_TYPES = ['page_view', 'add_to_cart', 'remove_from_cart', 'checkout_started', 'purchase'];
const STORE_IDS = ['store_alpha', 'store_beta', 'store_gamma'];
const PRODUCTS = Array.from({ length: 20 }, (_, index) => `prod_${index + 1}`);
const BATCH_SIZE = 1000;
const TOTAL_EVENTS = Number(process.env.SEED_EVENT_COUNT || 25000);

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

function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomTimestampWithin90Days() {
  const now = Date.now();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  const offset = Math.floor(Math.random() * ninetyDaysMs);
  return new Date(now - offset).toISOString();
}

function getEventData(eventType) {
  if (eventType !== 'purchase') {
    return { product_id: pickRandom(PRODUCTS) };
  }

  const amount = Number((Math.random() * 180 + 20).toFixed(2));
  return {
    product_id: pickRandom(PRODUCTS),
    amount,
    currency: 'USD',
  };
}

function buildBatch(size) {
  const rows = [];
  // We'll make sure at least 2/3 of events are page_view, and every purchase is paired with a page_view
  const numPurchases = Math.floor(size / 3);
  const numPageViews = size - numPurchases;
  // First, generate page views
  for (let i = 0; i < numPageViews; i += 1) {
    rows.push({
      eventId: `evt_${crypto.randomUUID()}`,
      storeId: pickRandom(STORE_IDS),
      eventType: 'page_view',
      timestamp: randomTimestampWithin90Days(),
      data: JSON.stringify({ product_id: pickRandom(PRODUCTS) }),
    });
  }
  // Then, generate purchases, each with a paired page_view
  for (let i = 0; i < numPurchases; i += 1) {
    const storeId = pickRandom(STORE_IDS);
    const productId = pickRandom(PRODUCTS);
    const timestamp = randomTimestampWithin90Days();
    // Add a page_view for this purchase
    rows.push({
      eventId: `evt_${crypto.randomUUID()}`,
      storeId,
      eventType: 'page_view',
      timestamp,
      data: JSON.stringify({ product_id: productId }),
    });
    // Add the purchase
    rows.push({
      eventId: `evt_${crypto.randomUUID()}`,
      storeId,
      eventType: 'purchase',
      timestamp,
      data: JSON.stringify({ product_id: productId, amount: Number((Math.random() * 180 + 20).toFixed(2)), currency: 'USD' }),
    });
  }
  // Shuffle rows to randomize order
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  return rows.slice(0, size);
}

function buildInsertQuery(rows) {
  const values = [];
  const placeholders = rows
    .map((row, index) => {
      const base = index * 5;
      values.push(row.eventId, row.storeId, row.eventType, row.timestamp, row.data);
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}::jsonb)`;
    })
    .join(', ');

  const text = `
    INSERT INTO events (event_id, store_id, event_type, timestamp, data)
    VALUES ${placeholders}
    ON CONFLICT (event_id) DO NOTHING
  `;

  return { text, values };
}

async function run() {
  const pool = new Pool(getPoolConfig());

  try {
    let inserted = 0;

    while (inserted < TOTAL_EVENTS) {
      const currentBatchSize = Math.min(BATCH_SIZE, TOTAL_EVENTS - inserted);
      const rows = buildBatch(currentBatchSize);
      const query = buildInsertQuery(rows);
      await pool.query(query.text, query.values);
      inserted += currentBatchSize;
      console.log(`Seeded ${inserted}/${TOTAL_EVENTS} events`);
    }

    console.log('Seeding complete.');
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error('Failed to seed events:', error);
  process.exit(1);
});
