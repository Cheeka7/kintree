const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');
const db = require('./db');

const UPLOADS_DIR = process.env.KINTREE_UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic']);
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext) || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

const asyncHandler = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Server error' });
  }
};

const THUMB_SIZE = 320;

async function generateThumbnail(filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  const thumbFilename = `${base}_thumb.webp`;
  try {
    await sharp(path.join(UPLOADS_DIR, filename))
      .rotate()
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover' })
      .webp({ quality: 82 })
      .toFile(path.join(UPLOADS_DIR, thumbFilename));
    return thumbFilename;
  } catch (err) {
    console.error(`Thumbnail generation failed for ${filename}:`, err.message);
    return null;
  }
}

function unlinkPhotoFiles(photo) {
  fs.unlink(path.join(UPLOADS_DIR, photo.filename), () => {});
  if (photo.thumb_filename) {
    fs.unlink(path.join(UPLOADS_DIR, photo.thumb_filename), () => {});
  }
}

// ---------- Categories ----------

app.get('/api/categories', asyncHandler((_req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all();
  res.json(categories);
}));

app.post('/api/categories', asyncHandler((req, res) => {
  const { name, color } = req.body;
  if (!name || !name.trim()) { res.status(400).json({ error: 'Name is required' }); return; }
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM categories').get().m;
  const info = db
    .prepare('INSERT INTO categories (name, color, sort_order) VALUES (?, ?, ?)')
    .run(name.trim(), color || '#7a7ac1', maxOrder + 1);
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(category);
}));

app.put('/api/categories/:id', asyncHandler((req, res) => {
  const { name, color } = req.body;
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) { res.status(404).json({ error: 'Category not found' }); return; }
  db.prepare('UPDATE categories SET name = ?, color = ? WHERE id = ?').run(
    name?.trim() || existing.name,
    color || existing.color,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id));
}));

app.delete('/api/categories/:id', asyncHandler((req, res) => {
  const peopleCount = db.prepare('SELECT COUNT(*) AS c FROM people WHERE category_id = ?').get(req.params.id).c;
  if (peopleCount > 0) {
    res.status(400).json({ error: 'Move or delete the people in this category first' });
    return;
  }
  const info = db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  if (info.changes === 0) { res.status(404).json({ error: 'Category not found' }); return; }
  res.status(204).end();
}));

// ---------- People ----------

const withPhotos = (person) => {
  const photos = db.prepare('SELECT * FROM photos WHERE person_id = ? ORDER BY created_at').all(person.id);
  return { ...person, photos };
};

app.get('/api/people', asyncHandler((_req, res) => {
  const people = db.prepare('SELECT * FROM people ORDER BY created_at').all();
  res.json(people.map(withPhotos));
}));

app.get('/api/people/:id', asyncHandler((req, res) => {
  const person = db.prepare('SELECT * FROM people WHERE id = ?').get(req.params.id);
  if (!person) { res.status(404).json({ error: 'Person not found' }); return; }
  res.json(withPhotos(person));
}));

app.post('/api/people', asyncHandler((req, res) => {
  const { name, category_id, relationship, notes } = req.body;
  if (!name || !name.trim()) { res.status(400).json({ error: 'Name is required' }); return; }
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(category_id);
  if (!category) { res.status(400).json({ error: 'Valid category_id is required' }); return; }
  const info = db
    .prepare('INSERT INTO people (name, category_id, relationship, notes) VALUES (?, ?, ?, ?)')
    .run(name.trim(), category_id, relationship?.trim() || null, notes?.trim() || null);
  res.status(201).json(withPhotos(db.prepare('SELECT * FROM people WHERE id = ?').get(info.lastInsertRowid)));
}));

app.put('/api/people/:id', asyncHandler((req, res) => {
  const existing = db.prepare('SELECT * FROM people WHERE id = ?').get(req.params.id);
  if (!existing) { res.status(404).json({ error: 'Person not found' }); return; }
  const { name, category_id, relationship, notes, cover_photo_id } = req.body;
  db.prepare(
    'UPDATE people SET name = ?, category_id = ?, relationship = ?, notes = ?, cover_photo_id = ? WHERE id = ?'
  ).run(
    name?.trim() || existing.name,
    category_id || existing.category_id,
    relationship !== undefined ? relationship?.trim() || null : existing.relationship,
    notes !== undefined ? notes?.trim() || null : existing.notes,
    cover_photo_id !== undefined ? cover_photo_id : existing.cover_photo_id,
    req.params.id
  );
  res.json(withPhotos(db.prepare('SELECT * FROM people WHERE id = ?').get(req.params.id)));
}));

app.delete('/api/people/:id', asyncHandler((req, res) => {
  const photos = db.prepare('SELECT filename, thumb_filename FROM photos WHERE person_id = ?').all(req.params.id);
  const info = db.prepare('DELETE FROM people WHERE id = ?').run(req.params.id);
  if (info.changes === 0) { res.status(404).json({ error: 'Person not found' }); return; }
  for (const p of photos) unlinkPhotoFiles(p);
  res.status(204).end();
}));

// ---------- Photos ----------

app.post('/api/people/:id/photos', upload.array('photos', 20), asyncHandler(async (req, res) => {
  const person = db.prepare('SELECT * FROM people WHERE id = ?').get(req.params.id);
  if (!person) { res.status(404).json({ error: 'Person not found' }); return; }
  const files = req.files || [];
  const insert = db.prepare('INSERT INTO photos (person_id, filename, thumb_filename, caption) VALUES (?, ?, ?, ?)');
  const inserted = [];
  for (const f of files) {
    const thumbFilename = await generateThumbnail(f.filename);
    const info = insert.run(req.params.id, f.filename, thumbFilename, req.body.caption?.trim() || null);
    inserted.push(db.prepare('SELECT * FROM photos WHERE id = ?').get(info.lastInsertRowid));
  }
  res.status(201).json(inserted);
}));

app.put('/api/photos/:id', asyncHandler((req, res) => {
  const existing = db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.id);
  if (!existing) { res.status(404).json({ error: 'Photo not found' }); return; }
  db.prepare('UPDATE photos SET caption = ? WHERE id = ?').run(req.body.caption?.trim() || null, req.params.id);
  res.json(db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.id));
}));

app.delete('/api/photos/:id', asyncHandler((req, res) => {
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.id);
  if (!photo) { res.status(404).json({ error: 'Photo not found' }); return; }
  db.prepare('DELETE FROM photos WHERE id = ?').run(req.params.id);
  db.prepare('UPDATE people SET cover_photo_id = NULL WHERE id = ? AND cover_photo_id = ?').run(
    photo.person_id,
    photo.id
  );
  unlinkPhotoFiles(photo);
  res.status(204).end();
}));

const FRONTEND_DIST = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get(/^(?!\/api|\/uploads).*/, (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`KinTree API listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
