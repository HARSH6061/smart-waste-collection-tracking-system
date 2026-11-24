const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// In serverless environments like Vercel, project root is read-only, so use /tmp
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION);
const DATA_DIR = isServerless ? '/tmp' : path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'waste.db');
const db = new Database(DB_PATH);

// Configure pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS bins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    state TEXT NOT NULL,
    city TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    height_cm REAL NOT NULL DEFAULT 100,
    threshold REAL NOT NULL DEFAULT 80,
    fill_percent REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bin_id INTEGER NOT NULL,
    distance_cm REAL NOT NULL,
    fill_percent REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bin_id) REFERENCES bins(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS trucks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT NOT NULL,
    driver_name TEXT NOT NULL,
    driver_phone TEXT NOT NULL,
    capacity_kg REAL NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS gps_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    truck_id INTEGER NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (truck_id) REFERENCES trucks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bin_id INTEGER,
    truck_id INTEGER,
    state TEXT,
    collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bin_id) REFERENCES bins(id) ON DELETE SET NULL,
    FOREIGN KEY (truck_id) REFERENCES trucks(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    state TEXT NOT NULL,
    city TEXT NOT NULL,
    bin_id INTEGER,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    lat REAL,
    lng REAL,
    status TEXT NOT NULL DEFAULT 'Open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bin_id) REFERENCES bins(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    truck_id INTEGER NOT NULL,
    stops_json TEXT NOT NULL,
    distance_km REAL NOT NULL,
    eta_minutes REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (truck_id) REFERENCES trucks(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_bins_state ON bins(state);
  CREATE INDEX IF NOT EXISTS idx_bins_fill ON bins(fill_percent);
  CREATE INDEX IF NOT EXISTS idx_readings_bin ON readings(bin_id);
  CREATE INDEX IF NOT EXISTS idx_gps_truck ON gps_history(truck_id);
  CREATE INDEX IF NOT EXISTS idx_complaints_state ON complaints(state);
  CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
  CREATE INDEX IF NOT EXISTS idx_collections_date ON collections(collected_at);
`);

module.exports = db;
