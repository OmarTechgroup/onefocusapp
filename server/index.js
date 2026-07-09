require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const db = require('./db');

db.migrate();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', require('./routes'));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Serve the built PWA in production; in dev the Vue dev server proxies /api here instead.
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(200).send('OneFocus server running. Client not built yet — run `npm run dev` in /client.');
  });
});

const PORT = process.env.PORT || 3900;
app.listen(PORT, () => {
  console.log(`OneFocus server listening on http://localhost:${PORT}`);
  require('./scheduler').start();
});
