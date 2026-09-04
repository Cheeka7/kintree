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

test('POST /api/kins creates a new kin with a 6-digit numeric code', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/kins`, { method: 'POST' });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.match(body.code, /^\d{6}$/);
});

test('POST /api/kins seeds the new kin with default Family/Friends categories', async () => {
  const { code } = await (await fetch(`${ctx.baseUrl}/api/kins`, { method: 'POST' })).json();
  const categories = await (await fetch(`${ctx.baseUrl}/api/kins/${code}/categories`)).json();
  assert.deepEqual(
    categories.map((c) => c.name),
    ['Family', 'Friends']
  );
});

test('POST /api/kins generates distinct codes across calls', async () => {
  const codes = new Set();
  for (let i = 0; i < 10; i++) {
    const { code } = await (await fetch(`${ctx.baseUrl}/api/kins`, { method: 'POST' })).json();
    codes.add(code);
  }
  assert.equal(codes.size, 10);
});

test('GET /api/kins/:code/categories 404s for a code that was never generated', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/kins/123456/categories`);
  assert.equal(res.status, 404);
});

test('two kins never see each others data', async () => {
  const a = await (await fetch(`${ctx.baseUrl}/api/kins`, { method: 'POST' })).json();
  const b = await (await fetch(`${ctx.baseUrl}/api/kins`, { method: 'POST' })).json();

  const aCategories = await (await fetch(`${ctx.baseUrl}/api/kins/${a.code}/categories`)).json();
  await fetch(`${ctx.baseUrl}/api/kins/${a.code}/people`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Secret', category_id: aCategories[0].id }),
  });

  const bPeople = await (await fetch(`${ctx.baseUrl}/api/kins/${b.code}/people`)).json();
  assert.deepEqual(bPeople, []);
});
