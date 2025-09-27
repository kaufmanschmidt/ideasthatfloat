const express = require('express');
const router = express.Router();
const Element = require('../models/Element');

// Get all elements
router.get('/', async (req, res) => {
  const elements = await Element.find().sort({ position: 1 });
  res.json(elements);
});

// Get single element
router.get('/:id', async (req, res) => {
  const el = await Element.findById(req.params.id);
  if (!el) return res.status(404).json({ error: 'Not found' });
  res.json(el);
});

// Create new element
router.post('/', async (req, res) => {
  const el = new Element(req.body);
  await el.save();
  res.status(201).json(el);
});

// Update element
router.put('/:id', async (req, res) => {
  const el = await Element.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!el) return res.status(404).json({ error: 'Not found' });
  res.json(el);
});

// Delete element
router.delete('/:id', async (req, res) => {
  const el = await Element.findByIdAndDelete(req.params.id);
  if (!el) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

module.exports = router;