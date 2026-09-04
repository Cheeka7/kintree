const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServer } = require('./helpers/setup');

let ctx;
let base;
let familyId;

test.before(() => {
  ctx = createTestServer();
});

test.beforeEach(async () => {
  ctx.resetDb();
  ({ base } = await ctx.createKin());
  const categories = await (await fetch(`${base}/categories`)).json();
  familyId = categories.find((c) => c.name === 'Family').id;
});

test.after(() => ctx.close());

const createPerson = async (name) => {
  const res = await fetch(`${base}/people`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, category_id: familyId }),
  });
  return res.json();
};

const addLink = (id, linkedId) =>
  fetch(`${base}/people/${id}/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ linked_person_id: linkedId }),
  });

test('POST /api/people/:id/links creates a link visible from both sides', async () => {
  const alice = await createPerson('Alice');
  const bob = await createPerson('Bob');

  const res = await addLink(alice.id, bob.id);
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.deepEqual(
    body.links.map((l) => l.id),
    [bob.id]
  );

  const bobRes = await fetch(`${base}/people/${bob.id}`);
  const bobBody = await bobRes.json();
  assert.deepEqual(
    bobBody.links.map((l) => l.id),
    [alice.id]
  );
});

test('POST /api/people/:id/links is idempotent for the same pair', async () => {
  const alice = await createPerson('Alice');
  const bob = await createPerson('Bob');

  await addLink(alice.id, bob.id);
  const res = await addLink(bob.id, alice.id);
  assert.equal(res.status, 201);

  const aliceBody = await (await fetch(`${base}/people/${alice.id}`)).json();
  assert.equal(aliceBody.links.length, 1);
});

test('POST /api/people/:id/links rejects linking a person to themselves', async () => {
  const alice = await createPerson('Alice');
  const res = await addLink(alice.id, alice.id);
  assert.equal(res.status, 400);
});

test('POST /api/people/:id/links rejects a linked_person_id that does not exist', async () => {
  const alice = await createPerson('Alice');
  const res = await addLink(alice.id, 999999);
  assert.equal(res.status, 400);
});

test('POST /api/people/:id/links on a missing person returns 404', async () => {
  const bob = await createPerson('Bob');
  const res = await addLink(999999, bob.id);
  assert.equal(res.status, 404);
});

test('DELETE /api/people/:id/links/:linkedId removes the link from both sides', async () => {
  const alice = await createPerson('Alice');
  const bob = await createPerson('Bob');
  await addLink(alice.id, bob.id);

  const res = await fetch(`${base}/people/${alice.id}/links/${bob.id}`, { method: 'DELETE' });
  assert.equal(res.status, 204);

  const aliceBody = await (await fetch(`${base}/people/${alice.id}`)).json();
  const bobBody = await (await fetch(`${base}/people/${bob.id}`)).json();
  assert.equal(aliceBody.links.length, 0);
  assert.equal(bobBody.links.length, 0);
});

test('DELETE /api/people/:id/links/:linkedId on a missing link returns 404', async () => {
  const alice = await createPerson('Alice');
  const bob = await createPerson('Bob');
  const res = await fetch(`${base}/people/${alice.id}/links/${bob.id}`, { method: 'DELETE' });
  assert.equal(res.status, 404);
});

test('POST /api/people/:id/links rejects linking to a person from a different kin', async () => {
  const alice = await createPerson('Alice');

  const other = await ctx.createKin();
  const otherCategories = await (await fetch(`${other.base}/categories`)).json();
  const outsider = await (
    await fetch(`${other.base}/people`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Outsider', category_id: otherCategories[0].id }),
    })
  ).json();

  const res = await addLink(alice.id, outsider.id);
  assert.equal(res.status, 400);
});

test('DELETE /api/people/:id cascades to remove that person from their links', async () => {
  const alice = await createPerson('Alice');
  const bob = await createPerson('Bob');
  await addLink(alice.id, bob.id);

  await fetch(`${base}/people/${alice.id}`, { method: 'DELETE' });

  const bobBody = await (await fetch(`${base}/people/${bob.id}`)).json();
  assert.equal(bobBody.links.length, 0);
});
