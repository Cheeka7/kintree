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

// ---------- Kins ----------

app.post('/api/kins', asyncHandler((_req, res) => {
  const kin = db.createKin();
  res.status(201).json({ code: kin.code });
}));

const kinRouter = express.Router({ mergeParams: true });

kinRouter.use((req, res, next) => {
  const kin = db.prepare('SELECT * FROM kins WHERE code = ?').get(req.params.code);
  if (!kin) { res.status(404).json({ error: 'Kin code not found' }); return; }
  req.kin = kin;
  next();
});

kinRouter.get('/', asyncHandler((req, res) => {
  res.json({ code: req.kin.code });
}));

// ---------- Categories ----------

kinRouter.get('/categories', asyncHandler((req, res) => {
  const categories = db.prepare('SELECT * FROM categories WHERE kin_id = ? ORDER BY sort_order, id').all(req.kin.id);
  res.json(categories);
}));

kinRouter.post('/categories', asyncHandler((req, res) => {
  const { name, color } = req.body;
  if (!name || !name.trim()) { res.status(400).json({ error: 'Name is required' }); return; }
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM categories WHERE kin_id = ?').get(req.kin.id).m;
  const info = db
    .prepare('INSERT INTO categories (kin_id, name, color, sort_order) VALUES (?, ?, ?, ?)')
    .run(req.kin.id, name.trim(), color || '#7a7ac1', maxOrder + 1);
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(category);
}));

kinRouter.put('/categories/:id', asyncHandler((req, res) => {
  const { name, color } = req.body;
  const existing = db.prepare('SELECT * FROM categories WHERE id = ? AND kin_id = ?').get(req.params.id, req.kin.id);
  if (!existing) { res.status(404).json({ error: 'Category not found' }); return; }
  db.prepare('UPDATE categories SET name = ?, color = ? WHERE id = ?').run(
    name?.trim() || existing.name,
    color || existing.color,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id));
}));

kinRouter.delete('/categories/:id', asyncHandler((req, res) => {
  const existing = db.prepare('SELECT * FROM categories WHERE id = ? AND kin_id = ?').get(req.params.id, req.kin.id);
  if (!existing) { res.status(404).json({ error: 'Category not found' }); return; }
  const peopleCount = db.prepare('SELECT COUNT(*) AS c FROM people WHERE category_id = ?').get(req.params.id).c;
  if (peopleCount > 0) {
    res.status(400).json({ error: 'Move or delete the people in this category first' });
    return;
  }
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.status(204).end();
}));

// ---------- People ----------

const getLinks = (personId) =>
  db
    .prepare(
      `SELECT p.id, p.name FROM person_links pl
       JOIN people p ON p.id = CASE WHEN pl.person_id = ? THEN pl.linked_person_id ELSE pl.person_id END
       WHERE pl.person_id = ? OR pl.linked_person_id = ?
       ORDER BY p.name`
    )
    .all(personId, personId, personId);

const withRelations = (person) => {
  const photos = db.prepare('SELECT * FROM photos WHERE person_id = ? ORDER BY created_at').all(person.id);
  const links = getLinks(person.id);
  return { ...person, photos, links };
};

kinRouter.get('/people', asyncHandler((req, res) => {
  const people = db.prepare('SELECT * FROM people WHERE kin_id = ? ORDER BY created_at').all(req.kin.id);
  res.json(people.map(withRelations));
}));

kinRouter.get('/people/:id', asyncHandler((req, res) => {
  const person = db.prepare('SELECT * FROM people WHERE id = ? AND kin_id = ?').get(req.params.id, req.kin.id);
  if (!person) { res.status(404).json({ error: 'Person not found' }); return; }
  res.json(withRelations(person));
}));

kinRouter.post('/people', asyncHandler((req, res) => {
  const { name, category_id, relationship, notes } = req.body;
  if (!name || !name.trim()) { res.status(400).json({ error: 'Name is required' }); return; }
  let categoryId = null;
  if (category_id !== undefined && category_id !== null && category_id !== '') {
    const category = db.prepare('SELECT * FROM categories WHERE id = ? AND kin_id = ?').get(category_id, req.kin.id);
    if (!category) { res.status(400).json({ error: 'Valid category_id is required' }); return; }
    categoryId = category_id;
  }
  const info = db
    .prepare('INSERT INTO people (kin_id, name, category_id, relationship, notes) VALUES (?, ?, ?, ?, ?)')
    .run(req.kin.id, name.trim(), categoryId, relationship?.trim() || null, notes?.trim() || null);
  res.status(201).json(withRelations(db.prepare('SELECT * FROM people WHERE id = ?').get(info.lastInsertRowid)));
}));

kinRouter.put('/people/:id', asyncHandler((req, res) => {
  const existing = db.prepare('SELECT * FROM people WHERE id = ? AND kin_id = ?').get(req.params.id, req.kin.id);
  if (!existing) { res.status(404).json({ error: 'Person not found' }); return; }
  const { name, category_id, relationship, notes, cover_photo_id } = req.body;

  let categoryId = existing.category_id;
  if (category_id !== undefined) {
    if (category_id === null || category_id === '') {
      categoryId = null;
    } else {
      const category = db.prepare('SELECT * FROM categories WHERE id = ? AND kin_id = ?').get(category_id, req.kin.id);
      if (!category) { res.status(400).json({ error: 'Valid category_id is required' }); return; }
      categoryId = category_id;
    }
  }

  db.prepare(
    'UPDATE people SET name = ?, category_id = ?, relationship = ?, notes = ?, cover_photo_id = ? WHERE id = ?'
  ).run(
    name?.trim() || existing.name,
    categoryId,
    relationship !== undefined ? relationship?.trim() || null : existing.relationship,
    notes !== undefined ? notes?.trim() || null : existing.notes,
    cover_photo_id !== undefined ? cover_photo_id : existing.cover_photo_id,
    req.params.id
  );
  res.json(withRelations(db.prepare('SELECT * FROM people WHERE id = ?').get(req.params.id)));
}));

kinRouter.delete('/people/:id', asyncHandler((req, res) => {
  const existing = db.prepare('SELECT * FROM people WHERE id = ? AND kin_id = ?').get(req.params.id, req.kin.id);
  if (!existing) { res.status(404).json({ error: 'Person not found' }); return; }
  const photos = db.prepare('SELECT filename, thumb_filename FROM photos WHERE person_id = ?').all(req.params.id);
  db.prepare('DELETE FROM people WHERE id = ?').run(req.params.id);
  for (const p of photos) unlinkPhotoFiles(p);
  res.status(204).end();
}));

// ---------- Person links ----------

kinRouter.post('/people/:id/links', asyncHandler((req, res) => {
  const personId = Number(req.params.id);
  const linkedPersonId = Number(req.body.linked_person_id);

  const person = db.prepare('SELECT * FROM people WHERE id = ? AND kin_id = ?').get(personId, req.kin.id);
  if (!person) { res.status(404).json({ error: 'Person not found' }); return; }

  if (!linkedPersonId || linkedPersonId === personId) {
    res.status(400).json({ error: 'A valid, different linked_person_id is required' });
    return;
  }
  const linkedPerson = db.prepare('SELECT * FROM people WHERE id = ? AND kin_id = ?').get(linkedPersonId, req.kin.id);
  if (!linkedPerson) { res.status(400).json({ error: 'linked_person_id does not exist' }); return; }

  const [a, b] = [personId, linkedPersonId].sort((x, y) => x - y);
  db.prepare('INSERT OR IGNORE INTO person_links (person_id, linked_person_id) VALUES (?, ?)').run(a, b);
  res.status(201).json(withRelations(person));
}));

kinRouter.delete('/people/:id/links/:linkedId', asyncHandler((req, res) => {
  const personId = Number(req.params.id);
  const linkedPersonId = Number(req.params.linkedId);
  const person = db.prepare('SELECT id FROM people WHERE id = ? AND kin_id = ?').get(personId, req.kin.id);
  if (!person) { res.status(404).json({ error: 'Person not found' }); return; }

  const [a, b] = [personId, linkedPersonId].sort((x, y) => x - y);
  const info = db
    .prepare('DELETE FROM person_links WHERE person_id = ? AND linked_person_id = ?')
    .run(a, b);
  if (info.changes === 0) { res.status(404).json({ error: 'Link not found' }); return; }
  res.status(204).end();
}));

// ---------- Photos ----------

kinRouter.post('/people/:id/photos', upload.array('photos', 20), asyncHandler(async (req, res) => {
  const person = db.prepare('SELECT * FROM people WHERE id = ? AND kin_id = ?').get(req.params.id, req.kin.id);
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

const getOwnedPhoto = (photoId, kinId) =>
  db
    .prepare(
      `SELECT photos.* FROM photos
       JOIN people ON people.id = photos.person_id
       WHERE photos.id = ? AND people.kin_id = ?`
    )
    .get(photoId, kinId);

kinRouter.put('/photos/:id', asyncHandler((req, res) => {
  const existing = getOwnedPhoto(req.params.id, req.kin.id);
  if (!existing) { res.status(404).json({ error: 'Photo not found' }); return; }
  db.prepare('UPDATE photos SET caption = ? WHERE id = ?').run(req.body.caption?.trim() || null, req.params.id);
  res.json(db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.id));
}));

kinRouter.delete('/photos/:id', asyncHandler((req, res) => {
  const photo = getOwnedPhoto(req.params.id, req.kin.id);
  if (!photo) { res.status(404).json({ error: 'Photo not found' }); return; }
  db.prepare('DELETE FROM photos WHERE id = ?').run(req.params.id);
  db.prepare('UPDATE people SET cover_photo_id = NULL WHERE id = ? AND cover_photo_id = ?').run(
    photo.person_id,
    photo.id
  );
  unlinkPhotoFiles(photo);
  res.status(204).end();
}));

app.use('/api/kins/:code', kinRouter);

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
