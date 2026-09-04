const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const dbPath = process.env.KINTREE_DB_PATH || path.join(__dirname, '..', 'kintree.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS kins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kin_id INTEGER NOT NULL REFERENCES kins(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE(kin_id, name)
  );

  CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kin_id INTEGER NOT NULL REFERENCES kins(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    relationship TEXT,
    notes TEXT,
    cover_photo_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    thumb_filename TEXT,
    caption TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS person_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    linked_person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(person_id, linked_person_id)
  );
`);

const photoColumns = db.prepare("PRAGMA table_info(photos)").all().map((c) => c.name);
if (!photoColumns.includes('thumb_filename')) {
  db.exec('ALTER TABLE photos ADD COLUMN thumb_filename TEXT');
}

const categoryIdColumn = db.prepare("PRAGMA table_info(people)").all().find((c) => c.name === 'category_id');
if (categoryIdColumn?.notnull) {
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec(`
    CREATE TABLE people_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
      relationship TEXT,
      notes TEXT,
      cover_photo_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO people_new (id, name, category_id, relationship, notes, cover_photo_id, created_at)
      SELECT id, name, category_id, relationship, notes, cover_photo_id, created_at FROM people;
    DROP TABLE people;
    ALTER TABLE people_new RENAME TO people;
  `);
  db.exec('PRAGMA foreign_keys = ON');
}

function generateKinCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function createKin() {
  let code;
  do {
    code = generateKinCode();
  } while (db.prepare('SELECT id FROM kins WHERE code = ?').get(code));

  const info = db.prepare('INSERT INTO kins (code) VALUES (?)').run(code);
  const kinId = info.lastInsertRowid;
  const insertCategory = db.prepare('INSERT INTO categories (kin_id, name, color, sort_order) VALUES (?, ?, ?, ?)');
  insertCategory.run(kinId, 'Family', '#e0724a', 0);
  insertCategory.run(kinId, 'Friends', '#4a90a4', 1);
  return { id: kinId, code };
}

// Existing installs predate the kins table — fold whatever data they already
// have into one newly generated kin so nothing is lost.
const categoryColumns = db.prepare("PRAGMA table_info(categories)").all().map((c) => c.name);
if (!categoryColumns.includes('kin_id')) {
  db.exec('PRAGMA foreign_keys = OFF');

  const existingCategories = db.prepare('SELECT * FROM categories').all();
  const existingPeople = db.prepare('SELECT * FROM people').all();

  let migratedKinId = null;
  if (existingCategories.length > 0 || existingPeople.length > 0) {
    const code = generateKinCode();
    const info = db.prepare('INSERT INTO kins (code) VALUES (?)').run(code);
    migratedKinId = info.lastInsertRowid;
    console.log(`Existing KinTree data migrated into a new kin. Kin code: ${code}`);
  }

  db.exec(`
    CREATE TABLE categories_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kin_id INTEGER NOT NULL REFERENCES kins(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(kin_id, name)
    );
  `);
  const insertCat = db.prepare(
    'INSERT INTO categories_new (id, kin_id, name, color, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  for (const c of existingCategories) insertCat.run(c.id, migratedKinId, c.name, c.color, c.sort_order);
  db.exec('DROP TABLE categories');
  db.exec('ALTER TABLE categories_new RENAME TO categories');

  db.exec(`
    CREATE TABLE people_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kin_id INTEGER NOT NULL REFERENCES kins(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
      relationship TEXT,
      notes TEXT,
      cover_photo_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const insertPerson = db.prepare(
    `INSERT INTO people_new (id, kin_id, name, category_id, relationship, notes, cover_photo_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const p of existingPeople) {
    insertPerson.run(p.id, migratedKinId, p.name, p.category_id, p.relationship, p.notes, p.cover_photo_id, p.created_at);
  }
  db.exec('DROP TABLE people');
  db.exec('ALTER TABLE people_new RENAME TO people');

  db.exec('PRAGMA foreign_keys = ON');
}

db.createKin = createKin;

module.exports = db;
