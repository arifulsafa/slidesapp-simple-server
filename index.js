/**
 * M1 Event logging API: accept events from the app and make them queryable.
 * - POST /events  → store event (body: { type, event, request_id, rank_position, feed_mode, gesture_action, ... })
 * - GET  /events  → query events (?type=voice &request_id=xxx &limit=50)
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

function log(level, msg, data = {}) {
  const ts = new Date().toISOString();
  const extra = Object.keys(data).length ? ` ${JSON.stringify(data)}` : '';
  console.log(`[${ts}] [${level}] ${msg}${extra}`);
}

app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    log('REQUEST', `${req.method} ${req.path}`, {
      status: res.statusCode,
      durationMs: duration,
      ...(req.method === 'GET' && Object.keys(req.query).length ? { query: req.query } : {}),
    });
  });
  next();
});

const events = [];

app.post('/events', (req, res) => {
  const payload = req.body;
  const record = {
    id: events.length + 1,
    ts: new Date().toISOString(),
    ...payload,
  };
  events.push(record);
  log('EVENT', 'Event stored', {
    id: record.id,
    type: payload.type,
    request_id: payload.request_id,
  });
  res.status(201).json({ ok: true, id: record.id });
});

app.get('/events', (req, res) => {
  const { type, request_id, limit = '100' } = req.query;
  let list = [...events];
  if (type) list = list.filter((e) => e.type === type);
  if (request_id) list = list.filter((e) => e.request_id === request_id);
  const n = Math.min(parseInt(limit, 10) || 100, 500);
  list = list.slice(-n).reverse();
  log('QUERY', 'Events returned', {
    type: type || null,
    request_id: request_id || null,
    limit: n,
    count: list.length,
  });
  res.json({ events: list });
});

app.use((err, req, res, next) => {
  log('ERROR', err.message, { stack: err.stack });
  res.status(500).json({ ok: false, error: err.message });
});

app.listen(PORT, () => {
  log('START', `Event server listening on port ${PORT}`);
  console.log('  POST /events  - log an event');
  console.log('  GET  /events  - query events (?type=&request_id=&limit=)');
});
