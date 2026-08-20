// Nice Hat Thanks

// Keep the homepage clear that Scoopy is available in two enclosure sizes.
const dimensionCallout = document.querySelector('.dimension-callout');
if (dimensionCallout) {
  dimensionCallout.innerHTML = `
    <span class="dimension-value">32 × 32 × 16 mm</span>
    <span class="dimension-label">compact node · or 32 × 44 × 16 mm with mmWave presence</span>
  `;
}

const optionalPresence = Array.from(document.querySelectorAll('.product-grid article')).find(article =>
  article.querySelector('h3')?.textContent.trim() === 'Optional presence'
);
if (optionalPresence) {
  optionalPresence.querySelector('p').textContent =
    'Choose the 44 mm Presence enclosure to add mmWave sensing for room-aware automations that can detect still occupancy, not just motion.';
}

// Showcase both finished products on the homepage instead of making one replace the other.
const heroProduct = document.querySelector('.hero-product');
if (heroProduct) {
  const showcase = document.createElement('div');
  showcase.className = 'hero-showcase';
  showcase.innerHTML = `
    <article class="hero-variant">
      <div class="hero-variant-image"><img src="images/node-assembled.png" alt="Compact Scoopy Node"></div>
      <div class="hero-variant-copy"><strong>Scoopy Node</strong><span>32 × 32 × 16 mm</span></div>
    </article>
    <article class="hero-variant">
      <div class="hero-variant-image"><img src="images/radar-node-assembled.png" alt="Scoopy Node with mmWave presence"></div>
      <div class="hero-variant-copy"><strong>Scoopy Node + Presence</strong><span>32 × 44 × 16 mm · mmWave</span></div>
    </article>
  `;
  heroProduct.replaceWith(showcase);

  const style = document.createElement('style');
  style.textContent = `
    .hero-showcase{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-self:center;justify-self:end;width:min(560px,100%)}
    .hero-variant{margin:0;overflow:hidden;border-radius:24px;background:#1c211b;color:#f5f0e6}
    .hero-variant-image{aspect-ratio:1/1;overflow:hidden}
    .hero-variant-image img{width:100%;height:100%;object-fit:cover;transform:scale(1.25)}
    .hero-variant-copy{display:flex;flex-direction:column;gap:4px;padding:14px 16px 16px}
    .hero-variant-copy strong{font-size:.92rem}
    .hero-variant-copy span{color:rgba(245,240,230,.62);font-size:.74rem}
    @media(max-width:980px){.hero-showcase{justify-self:center;width:min(600px,100%)}}
    @media(max-width:640px){.hero-showcase{gap:9px}.hero-variant{border-radius:18px}.hero-variant-copy{padding:10px 11px 12px}.hero-variant-copy strong{font-size:.78rem}.hero-variant-copy span{font-size:.66rem}}
  `;
  document.head.appendChild(style);
}

// Show both internal layouts as well.
const insideImage = document.querySelector('.inside-image');
if (insideImage) {
  insideImage.style.aspectRatio = 'auto';
  insideImage.style.overflow = 'visible';
  insideImage.style.display = 'grid';
  insideImage.style.gridTemplateColumns = '1fr 1fr';
  insideImage.style.gap = '12px';
  insideImage.innerHTML = `
    <img src="images/node-exploded.PNG" alt="Exploded compact Scoopy Node" style="width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:22px;transform:none">
    <img src="images/radar-node-exploded.png" alt="Exploded Scoopy Node with mmWave presence" style="width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:22px;transform:none">
  `;
}
