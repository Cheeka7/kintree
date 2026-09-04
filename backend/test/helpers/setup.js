const fs = require('fs');
const os = require('os');
const path = require('path');

// A 1x1 transparent PNG, valid enough for sharp to process.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

function createTestServer() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kintree-test-'));
  process.env.KINTREE_DB_PATH = path.join(tmpRoot, 'test.db');
  process.env.KINTREE_UPLOADS_DIR = path.join(tmpRoot, 'uploads');

  // Fresh module instances per test file (each `node --test` file runs in its own process).
  const app = require('../../src/server');
  const db = require('../../src/db');

  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const resetDb = () => {
    db.exec('DELETE FROM person_links; DELETE FROM photos; DELETE FROM people; DELETE FROM categories; DELETE FROM kins;');
  };

  const createKin = async () => {
    const res = await fetch(`${baseUrl}/api/kins`, { method: 'POST' });
    const { code } = await res.json();
    return { code, base: `${baseUrl}/api/kins/${code}` };
  };

  const close = () =>
    new Promise((resolve) => {
      server.close(() => {
        db.close();
        fs.rmSync(tmpRoot, { recursive: true, force: true });
        resolve();
      });
    });

  return { baseUrl, db, resetDb, createKin, close };
}

const json = (res) => res.json();

module.exports = { createTestServer, TINY_PNG, json };
