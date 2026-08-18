const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'kintree.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    relationship TEXT,
    notes TEXT,
    cover_photo_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    caption TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const defaultCategories = [
  { name: 'Family', color: '#e0724a', sort_order: 0 },
  { name: 'Friends', color: '#4a90a4', sort_order: 1 },
];

const existingCount = db.prepare('SELECT COUNT(*) AS c FROM categories').get().c;
if (existingCount === 0) {
  const insert = db.prepare('INSERT INTO categories (name, color, sort_order) VALUES (?, ?, ?)');
  for (const c of defaultCategories) insert.run(c.name, c.color, c.sort_order);
}

module.exports = db;
