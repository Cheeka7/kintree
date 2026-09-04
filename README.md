# KinTree

A relationship chart for the people around a central subject — grouped into
categories (Family, Friends, or any others you add), each with photos.

## Stack

- **Frontend:** React + TypeScript + Vite, Tailwind CSS. Renders the chart as
  an SVG radial diagram: the subject in the center, categories as the inner
  ring, people as the outer ring, each with a circular photo.
- **Backend:** Node.js + Express + SQLite (`better-sqlite3`), with `multer`
  handling photo uploads to `backend/uploads/`. This is the single source of
  truth — anyone hitting the server sees the same live data.

## First-time setup

```bash
npm run install:all
```

## Development

Runs the API (port 4000) and the Vite dev server (port 5173, proxying `/api`
and `/uploads` to the backend) together:

```bash
npm run dev
```

Open http://localhost:5173

## Production (single server, reachable by others on your network)

```bash
npm start
```

This builds the frontend and serves it directly from the Express server on
port 4000 (`PORT` env var to change it), so anyone who can reach that
machine's IP — e.g. `http://<your-ip>:4000` — sees the same data.

## Kin codes

Each chart lives behind a 6-digit kin code, so the server can host many
independent charts without them seeing each other's data. On first visit,
create a new kin to get a fresh code (save it — it's the only way back in) or
enter an existing one to open that chart. Share a code with someone else and
they see and edit the same live chart.

## Data

- SQLite database: `backend/kintree.db`
- Uploaded photos: `backend/uploads/`

Back up those two locations to preserve everything.
