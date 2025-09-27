const mongoose = require('mongoose');

const ElementSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // e.g., 'heading', 'image', 'section'
    content: { type: String }, // e.g., text, image URL, etc.
    animation: { type: String }, // e.g., 'fromLeft', 'fadeIn'
    position: { type: Number, default: 0 }, // for ordering
    settings: { type: Object }, // any extra settings (optional)
  },
  { timestamps: true }
);

module.exports = mongoose.model('Element', ElementSchema);