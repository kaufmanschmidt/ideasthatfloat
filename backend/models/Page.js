const mongoose = require('mongoose');

const SectionSchema = new mongoose.Schema({
  scrollStart: { type: Number, required: true }, // px or %
  startLocation: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  endLocation: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  transitionType: {
    type: String,
    enum: ['move', 'fade', 'blur'],
    default: 'move',
  },
  transitionStart: { type: Number, required: true }, // px or %
  transitionEnd: { type: Number, required: true }, // px or %
  content: { type: String, required: true }, // rich text
  widthDesktop: { type: Number, required: true }, // %
  widthTablet: { type: Number, required: true }, // %
  widthMobile: { type: Number, required: true }, // %
});

const PageSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may only contain lowercase letters, numbers and single dashes between words']
    },
    sections: [SectionSchema],
    position: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Create a sparse unique index on slug
PageSchema.index({ slug: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Page', PageSchema);
