// Load environment variables from backend/.env explicitly so running from repo root works
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const path = require('path');

// Passport config - only load Google strategy when auth is enabled
if (process.env.DISABLE_AUTH !== 'true') {
  try {
    require('./auth/google');
  } catch (err) {
    // Log and continue; missing client ID will be noisy otherwise
    console.warn('Warning: failed to load Google auth strategy:', err.message);
  }
} else {
  console.log('DISABLE_AUTH=true — skipping Google OAuth setup');
}

const app = express();

// MongoDB connection - use modern API (no deprecated options)
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    // If DB is required for the app, exit so the process manager can restart appropriately
    // Comment this out if you want the app to run even without DB
    // process.exit(1);
  });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session config
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev_secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Serve static files (admin UI)
app.use(express.static(path.join(__dirname, 'public')));

// Authentication routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/admin.html');
  }
);

app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

// Middleware to restrict access
function ensureAuthenticated(req, res, next) {
  // If DISABLE_AUTH is set to 'true', skip authentication (local/dev only)
  if (process.env.DISABLE_AUTH === 'true') return next();

  if (req.isAuthenticated && req.isAuthenticated()) return next();
  res.redirect('/auth/google');
}

// API routes (protected)
app.use('/api/elements', ensureAuthenticated, require('./routes/elements'));
app.use('/api/pages', ensureAuthenticated, require('./routes/pages'));

// Fallback for admin.html: ensure auth
app.get('/admin.html', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Frontend fetch (public)
app.get('/api/page', async (req, res) => {
  const Element = require('./models/Element');
  const elements = await Element.find({}).sort({ position: 1 });
  res.json(elements);
});

// Home page: simple redirect to /admin.html
app.get('/', (req, res) => res.redirect('/admin.html'));

const PORT = process.env.PORT || 3000;

// Start server after DB connection established (best-effort). If DB isn't available,
// we still start the server but log a warning above.
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

// Global error handlers to aid debugging during local development
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
