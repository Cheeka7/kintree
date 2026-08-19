const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServer } = require('./helpers/setup');

let ctx;
let familyId;
let friendsId;

test.before(() => {
  ctx = createTestServer();
});

test.beforeEach(async () => {
  ctx.resetDb();
  const categories = await (await fetch(`${ctx.baseUrl}/api/categories`)).json();
  familyId = categories.find((c) => c.name === 'Family').id;
  friendsId = categories.find((c) => c.name === 'Friends').id;
});

test.after(() => ctx.close());

const createPerson = (data) =>
  fetch(`${ctx.baseUrl}/api/people`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

test('POST /api/people requires a name', async () => {
  const res = await createPerson({ category_id: familyId });
  assert.equal(res.status, 400);
});

test('POST /api/people requires an existing category_id', async () => {
  const res = await createPerson({ name: 'Bob', category_id: 999999 });
  assert.equal(res.status, 400);
});

test('POST /api/people creates a person with trimmed fields and no photos', async () => {
  const res = await createPerson({
    name: '  Bob  ',
    category_id: familyId,
    relationship: '  Uncle  ',
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.name, 'Bob');
  assert.equal(body.relationship, 'Uncle');
  assert.deepEqual(body.photos, []);
});

test('GET /api/people/:id returns 404 for a missing person', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/people/999999`);
  assert.equal(res.status, 404);
});

test('PUT /api/people/:id clears relationship and notes when sent empty strings', async () => {
  const created = await (
    await createPerson({ name: 'Cara', category_id: familyId, relationship: 'Aunt', notes: 'loves tea' })
  ).json();

  const res = await fetch(`${ctx.baseUrl}/api/people/${created.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ relationship: '', notes: '' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.relationship, null);
  assert.equal(body.notes, null);
  // name should be untouched since it wasn't part of the update payload
  assert.equal(body.name, 'Cara');
});

test('PUT /api/people/:id moves a person between categories', async () => {
  const created = await (await createPerson({ name: 'Dev', category_id: familyId })).json();

  const res = await fetch(`${ctx.baseUrl}/api/people/${created.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category_id: friendsId }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.category_id, friendsId);
});

test('PUT /api/people/:id on a missing id returns 404', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/people/999999`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'X' }),
  });
  assert.equal(res.status, 404);
});

test('PUT /api/people/:id rejects a category_id that does not exist', async () => {
  const created = await (await createPerson({ name: 'Eve', category_id: familyId })).json();

  const res = await fetch(`${ctx.baseUrl}/api/people/${created.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category_id: 999999 }),
  });

  // The person's category is a foreign key, so moving them to a category
  // that doesn't exist should be a rejected 400, the same validation POST applies.
  assert.equal(res.status, 400);
});

test('PUT /api/people/:id rejects a cover_photo_id that does not belong to the person', async () => {
  const created = await (await createPerson({ name: 'Frank', category_id: familyId })).json();

  const res = await fetch(`${ctx.baseUrl}/api/people/${created.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cover_photo_id: 999999 }),
  });

  assert.equal(res.status, 400);
});

test('DELETE /api/people/:id removes the person', async () => {
  const created = await (await createPerson({ name: 'Gina', category_id: familyId })).json();

  const del = await fetch(`${ctx.baseUrl}/api/people/${created.id}`, { method: 'DELETE' });
  assert.equal(del.status, 204);

  const get = await fetch(`${ctx.baseUrl}/api/people/${created.id}`);
  assert.equal(get.status, 404);
});

test('DELETE /api/people/:id on a missing id returns 404', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/people/999999`, { method: 'DELETE' });
  assert.equal(res.status, 404);
});
