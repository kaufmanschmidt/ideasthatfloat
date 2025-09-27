require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const path = require('path');

// Passport config
require('./auth/google');

const app = express();

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
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
  if (req.isAuthenticated()) return next();
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
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));