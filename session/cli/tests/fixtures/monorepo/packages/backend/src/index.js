const express = require('express');
const { validateEmail, formatDate } = require('@monorepo/shared');

const app = express();

app.get('/api/time', (req, res) => {
  res.json({ time: formatDate(new Date()) });
});

app.post('/api/validate-email', (req, res) => {
  const isValid = validateEmail(req.body.email);
  res.json({ valid: isValid });
});

module.exports = app;
