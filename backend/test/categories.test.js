const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServer } = require('./helpers/setup');

let ctx;

test.before(() => {
  ctx = createTestServer();
});

test.beforeEach(() => {
  ctx.resetDb();
});

test.after(() => ctx.close());

test('GET /api/categories returns the seeded defaults ordered by sort_order', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/categories`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(
    body.map((c) => c.name),
    ['Family', 'Friends']
  );
});

test('POST /api/categories creates a category and appends it after existing sort_order', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/categories`, {
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

test('POST /api/categories rejects a blank name', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '   ', color: '#123456' }),
  });
  assert.equal(res.status, 400);
});

test('PUT /api/categories/:id updates name and color', async () => {
  const created = await (
    await fetch(`${ctx.baseUrl}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Work', color: '#000000' }),
    })
  ).json();

  const res = await fetch(`${ctx.baseUrl}/api/categories/${created.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Colleagues', color: '#ffffff' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.name, 'Colleagues');
  assert.equal(body.color, '#ffffff');
});

test('PUT /api/categories/:id on a missing id returns 404', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/categories/999999`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'X' }),
  });
  assert.equal(res.status, 404);
});

test('DELETE /api/categories/:id is blocked while it still has people', async () => {
  const categories = await (await fetch(`${ctx.baseUrl}/api/categories`)).json();
  const family = categories.find((c) => c.name === 'Family');

  await fetch(`${ctx.baseUrl}/api/people`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Alice', category_id: family.id }),
  });

  const res = await fetch(`${ctx.baseUrl}/api/categories/${family.id}`, { method: 'DELETE' });
  assert.equal(res.status, 400);

  const stillThere = await fetch(`${ctx.baseUrl}/api/categories`);
  assert.equal((await stillThere.json()).some((c) => c.id === family.id), true);
});

test('DELETE /api/categories/:id succeeds once it has no people', async () => {
  const categories = await (await fetch(`${ctx.baseUrl}/api/categories`)).json();
  const friends = categories.find((c) => c.name === 'Friends');

  const res = await fetch(`${ctx.baseUrl}/api/categories/${friends.id}`, { method: 'DELETE' });
  assert.equal(res.status, 204);

  const remaining = await (await fetch(`${ctx.baseUrl}/api/categories`)).json();
  assert.equal(remaining.some((c) => c.id === friends.id), false);
});

test('DELETE /api/categories/:id on a missing id returns 404', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/categories/999999`, { method: 'DELETE' });
  assert.equal(res.status, 404);
});
