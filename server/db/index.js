// DB abstraction layer. Today: node:sqlite (built into Node 22+, sync,
// zero-config, no native build step — avoids requiring Visual Studio build
// tools just to compile better-sqlite3 on Windows). To migrate to PostgreSQL
// later, swap this module's internals for a pg Pool and keep the same
// exported surface (get/all/run/transaction) so callers (services/routes)
// never need to change.
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'onefocus.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  // Defensive column additions for DBs created before a given field existed.
  // schema.sql above only covers fresh installs (CREATE TABLE IF NOT EXISTS).
  const columnAdditions = [
    `ALTER TABLE tasks ADD COLUMN reminded_at TEXT`,
  ];
  for (const sql of columnAdditions) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }
}

// node:sqlite's StatementSync.all()/get() require named params passed
// without a leading ':'/'@' — but bound via an object works with @name
// placeholders directly, matching better-sqlite3's calling convention.
function get(sql, params = {}) {
  return db.prepare(sql).get(params);
}
function all(sql, params = {}) {
  return db.prepare(sql).all(params);
}
function run(sql, params = {}) {
  return db.prepare(sql).run(params);
}
function transaction(fn) {
  return (...args) => {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  };
}

module.exports = { raw: db, migrate, get, all, run, transaction };
