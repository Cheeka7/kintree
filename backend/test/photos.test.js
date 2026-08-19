const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServer, TINY_PNG } = require('./helpers/setup');

let ctx;
let familyId;

test.before(() => {
  ctx = createTestServer();
});

test.beforeEach(async () => {
  ctx.resetDb();
  const categories = await (await fetch(`${ctx.baseUrl}/api/categories`)).json();
  familyId = categories.find((c) => c.name === 'Family').id;
});

test.after(() => ctx.close());

const createPerson = async (name) => {
  const res = await fetch(`${ctx.baseUrl}/api/people`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, category_id: familyId }),
  });
  return res.json();
};

const uploadPng = (personId, filename = 'photo.png') => {
  const form = new FormData();
  form.append('photos', new Blob([TINY_PNG], { type: 'image/png' }), filename);
  return fetch(`${ctx.baseUrl}/api/people/${personId}/photos`, { method: 'POST', body: form });
};

test('POST /api/people/:id/photos on a missing person returns 404', async () => {
  const res = await uploadPng(999999);
  assert.equal(res.status, 404);
});

test('POST /api/people/:id/photos accepts an image and generates a thumbnail', async () => {
  const person = await createPerson('Holly');
  const res = await uploadPng(person.id);
  assert.equal(res.status, 201);
  const [photo] = await res.json();
  assert.equal(photo.person_id, person.id);
  assert.ok(photo.thumb_filename, 'expected a thumbnail to be generated');

  const served = await fetch(`${ctx.baseUrl}/uploads/${photo.filename}`);
  assert.equal(served.status, 200);
});

test('POST /api/people/:id/photos rejects a disallowed file type with a 4xx, not a 500', async () => {
  const person = await createPerson('Ivan');
  const form = new FormData();
  form.append('photos', new Blob([Buffer.from('not an image')], { type: 'text/plain' }), 'notes.txt');

  const res = await fetch(`${ctx.baseUrl}/api/people/${person.id}/photos`, { method: 'POST', body: form });

  assert.ok(res.status >= 400 && res.status < 500, `expected a 4xx validation error, got ${res.status}`);
});

test('PUT /api/photos/:id updates the caption', async () => {
  const person = await createPerson('Jade');
  const [photo] = await (await uploadPng(person.id)).json();

  const res = await fetch(`${ctx.baseUrl}/api/photos/${photo.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caption: 'Birthday party' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.caption, 'Birthday party');
});

test('PUT /api/photos/:id on a missing id returns 404', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/photos/999999`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caption: 'x' }),
  });
  assert.equal(res.status, 404);
});

test('DELETE /api/photos/:id clears cover_photo_id when the deleted photo was the cover', async () => {
  const person = await createPerson('Kabir');
  const [photo] = await (await uploadPng(person.id)).json();

  await fetch(`${ctx.baseUrl}/api/people/${person.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cover_photo_id: photo.id }),
  });

  const del = await fetch(`${ctx.baseUrl}/api/photos/${photo.id}`, { method: 'DELETE' });
  assert.equal(del.status, 204);

  const updated = await (await fetch(`${ctx.baseUrl}/api/people/${person.id}`)).json();
  assert.equal(updated.cover_photo_id, null);
});

test('DELETE /api/people/:id cascades to delete their photos', async () => {
  const person = await createPerson('Leah');
  const [photo] = await (await uploadPng(person.id)).json();

  await fetch(`${ctx.baseUrl}/api/people/${person.id}`, { method: 'DELETE' });

  const res = await fetch(`${ctx.baseUrl}/api/photos/${photo.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caption: 'still there?' }),
  });
  assert.equal(res.status, 404);
});

test('DELETE /api/photos/:id on a missing id returns 404', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/photos/999999`, { method: 'DELETE' });
  assert.equal(res.status, 404);
});
