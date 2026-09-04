const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServer } = require('./helpers/setup');

let ctx;
let base;

test.before(() => {
  ctx = createTestServer();
});

test.beforeEach(async () => {
  ctx.resetDb();
  ({ base } = await ctx.createKin());
});

test.after(() => ctx.close());

test('GET /api/kins/:code/categories returns the seeded defaults ordered by sort_order', async () => {
  const res = await fetch(`${base}/categories`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(
    body.map((c) => c.name),
    ['Family', 'Friends']
  );
});

test('GET /api/kins/:code/categories 404s for an unknown kin code', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/kins/000000/categories`);
  assert.equal(res.status, 404);
});

test('POST /api/kins/:code/categories creates a category and appends it after existing sort_order', async () => {
  const res = await fetch(`${base}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Colleagues', color: '#123456' }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.name, 'Colleagues');
  assert.equal(body.color, '#123456');
  assert.equal(body.sort_order, 2);
});

test('POST /api/kins/:code/categories rejects a blank name', async () => {
  const res = await fetch(`${base}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '   ', color: '#123456' }),
  });
  assert.equal(res.status, 400);
});

test('PUT /api/kins/:code/categories/:id updates name and color', async () => {
  const created = await (
    await fetch(`${base}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Work', color: '#000000' }),
    })
  ).json();

  const res = await fetch(`${base}/categories/${created.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Colleagues', color: '#ffffff' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.name, 'Colleagues');
  assert.equal(body.color, '#ffffff');
});

test('PUT /api/kins/:code/categories/:id on a missing id returns 404', async () => {
  const res = await fetch(`${base}/categories/999999`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'X' }),
  });
  assert.equal(res.status, 404);
});

test('DELETE /api/kins/:code/categories/:id is blocked while it still has people', async () => {
  const categories = await (await fetch(`${base}/categories`)).json();
  const family = categories.find((c) => c.name === 'Family');

  await fetch(`${base}/people`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Alice', category_id: family.id }),
  });

  const res = await fetch(`${base}/categories/${family.id}`, { method: 'DELETE' });
  assert.equal(res.status, 400);

  const stillThere = await fetch(`${base}/categories`);
  assert.equal((await stillThere.json()).some((c) => c.id === family.id), true);
});

test('DELETE /api/kins/:code/categories/:id succeeds once it has no people', async () => {
  const categories = await (await fetch(`${base}/categories`)).json();
  const friends = categories.find((c) => c.name === 'Friends');

  const res = await fetch(`${base}/categories/${friends.id}`, { method: 'DELETE' });
  assert.equal(res.status, 204);

  const remaining = await (await fetch(`${base}/categories`)).json();
  assert.equal(remaining.some((c) => c.id === friends.id), false);
});

test('DELETE /api/kins/:code/categories/:id on a missing id returns 404', async () => {
  const res = await fetch(`${base}/categories/999999`, { method: 'DELETE' });
  assert.equal(res.status, 404);
});

test('a category created in one kin is invisible in another', async () => {
  await fetch(`${base}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Coworkers', color: '#123456' }),
  });

  const other = await ctx.createKin();
  const categories = await (await fetch(`${other.base}/categories`)).json();
  assert.equal(
    categories.some((c) => c.name === 'Coworkers'),
    false
  );
});
