const express = require('express');
const router = express.Router();
const Page = require('../models/Page');

// Get all pages
router.get('/', async (req, res) => {
  const pages = await Page.find({}).sort({ position: 1 });
  res.json(pages);
});

// Get a single page by ID
router.get('/:id', async (req, res) => {
  const page = await Page.findById(req.params.id);
  if (!page) return res.status(404).json({ error: 'Page not found' });
  res.json(page);
});

// Helper to generate static HTML for a page
const fs = require('fs');
const path = require('path');
// helper to normalize slug
function normalizeSlug(s) {
  if (!s) return '';
  return s.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ensure uniqueness by appending a numeric suffix if needed
async function ensureUniqueSlug(base, idToIgnore) {
  let slug = normalizeSlug(base);
  let attempt = slug;
  let i = 1;
  while (true) {
    const q = { slug: attempt };
    if (idToIgnore) q._id = { $ne: idToIgnore };
    const exists = await Page.findOne(q).lean();
    if (!exists) return attempt;
    attempt = `${slug}-${i++}`;
  }
}
function generatePageHTML(page) {
  // Render sections as static HTML
  const sectionsHTML = (page.sections || []).map((section, idx) => {
    const width = section.widthDesktop || 100;
    return `<div class="section" id="section-${idx}" style="width:${width}%">
      <div class="section-content">${section.content || ''}</div>
    </div>`;
  }).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${page.title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin: 0; font-family: sans-serif; }
    .section { position: relative; margin: 2em auto; transition: all 0.5s; overflow: hidden; }
    .section-content { padding: 2em; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #0001; }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
</head>
<body>
  <div id="page">
    ${sectionsHTML}
  </div>
  <script>
    const sections = ${JSON.stringify(page.sections || [])};
    function getWidth(section) {
      const w = window.innerWidth;
      if (w < 600) return section.widthMobile;
      if (w < 900) return section.widthTablet;
      return section.widthDesktop;
    }
    function updateSectionWidths() {
      sections.forEach((section, idx) => {
        const el = document.getElementById('section-' + idx);
        if (el) el.style.width = getWidth(section) + '%';
      });
    }
    function setupGSAP(sections) {
      gsap.registerPlugin(ScrollTrigger);
      sections.forEach((section, idx) => {
        const el = document.getElementById('section-' + idx);
        let anim = { };
        let from = { x: section.startLocation.x, y: section.startLocation.y, opacity: 1, filter: 'none' };
        let to = { x: section.endLocation.x, y: section.endLocation.y, opacity: 1, filter: 'none' };
        if (section.transitionType === 'fade') {
          from.opacity = 0;
          to.opacity = 1;
        } else if (section.transitionType === 'blur') {
          from.filter = 'blur(10px)';
          to.filter = 'blur(0px)';
        }
        anim = { ...to, scrollTrigger: {
          trigger: el,
          start: 'top+' + section.scrollStart + ' top',
          end: 'top+' + section.transitionEnd + ' top',
          scrub: true
        }};
        gsap.fromTo(el, from, anim);
      });
    }
    window.addEventListener('resize', updateSectionWidths);
    setupGSAP(sections);
    updateSectionWidths();
  </script>
</body>
</html>`;
}

function writePageFile(page) {
  const html = generatePageHTML(page);
  try {
    const base = page.slug && page.slug.trim() ? page.slug.trim() : page.title;
    const filename = base.replace(/\s+/g, '-').toLowerCase() + '.html';
    // Write static pages to backend/public so they are served by Express
    const outDir = path.join(__dirname, '..', 'public');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, filename);
    fs.writeFileSync(outPath, html, 'utf8');
  } catch (err) {
    // Log and continue — static file generation is convenience, shouldn't block API
    console.error('Failed to write static page file:', err.message);
  }
}

// Generate the page into the frontend/ folder (for the client-facing site)
async function generatePageToFrontend(page) {
  if (!page) throw new Error('Page not provided');
  // Determine filename base (prefer slug)
  let base = '';
  if (page.slug && page.slug.trim()) base = page.slug.trim();
  else base = normalizeSlug(page.title) || `page-${Date.now()}`;
  const filename = (base.replace(/\s+/g, '-').toLowerCase()) + '.html';

  const html = generatePageHTML(page);
  const outDir = path.join(__dirname, '..', '..', 'frontend');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, filename);
  fs.writeFileSync(outPath, html, 'utf8');
  return `/frontend/${filename}`;
}

router.post('/:id/generate', async (req, res) => {
  try {
    const page = await Page.findById(req.params.id).lean();
    if (!page) return res.status(404).json({ error: 'Page not found' });
    const pathRel = await generatePageToFrontend(page);
    return res.json({ success: true, path: pathRel });
  } catch (err) {
    console.error('Failed to generate frontend page:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate page' });
  }
});

// Convenience GET endpoint for quick testing in browser
router.get('/:id/generate', async (req, res) => {
  try {
    const page = await Page.findById(req.params.id).lean();
    if (!page) return res.status(404).send('Page not found');
    const pathRel = await generatePageToFrontend(page);
    res.send(`Generated: ${pathRel}`);
  } catch (err) {
    console.error('Failed to generate frontend page (GET):', err);
    res.status(500).send('Failed to generate page: ' + (err.message || 'unknown error'));
  }
});

// Create a new page
router.post('/', async (req, res) => {
  const { title, slug: rawSlug, sections, position } = req.body;
  const slug = rawSlug ? normalizeSlug(rawSlug) : normalizeSlug(title);
  const uniqueSlug = await ensureUniqueSlug(slug);
  const page = new Page({ title, slug: uniqueSlug, sections, position });
  await page.save();
  writePageFile(page);
  res.status(201).json(page);
});

// Update a page
router.put('/:id', async (req, res) => {
  const { title, slug: rawSlug, sections, position } = req.body;
  const slugCandidate = rawSlug ? normalizeSlug(rawSlug) : normalizeSlug(title);
  const uniqueSlug = await ensureUniqueSlug(slugCandidate, req.params.id);
  const page = await Page.findByIdAndUpdate(
    req.params.id,
    { title, slug: uniqueSlug, sections, position },
    { new: true }
  );
  if (!page) return res.status(404).json({ error: 'Page not found' });
  writePageFile(page);
  res.json(page);
});

// Delete a page
router.delete('/:id', async (req, res) => {
  const page = await Page.findByIdAndDelete(req.params.id);
  if (!page) return res.status(404).json({ error: 'Page not found' });
  // Remove the static file
  try {
    const filename = page.title.replace(/\s+/g, '-').toLowerCase() + '.html';
    const outPath = path.join(__dirname, '..', 'public', filename);
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  } catch (err) {
    console.error('Failed to remove static page file:', err.message);
  }
  res.json({ success: true });
});

module.exports = router;
