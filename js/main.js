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
