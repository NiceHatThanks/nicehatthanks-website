// Final shop option cleanup layered after shop.js.
(function () {
  const picker = document.querySelector('.variant-picker');
  const price = document.querySelector('.shop-price');
  const summary = document.querySelector('.buy-summary');
  if (!picker || !price || !summary) return;

  // Presence-first product naming/order: Scoopy is the default product,
  // Scoopy Compact is the smaller no-presence version.
  const presenceCard = picker.querySelector('[data-variant="presence"]');
  const compactCard = picker.querySelector('[data-variant="compact"]');
  const grid = picker.querySelector('.variant-grid');

  if (presenceCard && compactCard && grid) {
    const presenceName = presenceCard.querySelector('strong');
    const compactName = compactCard.querySelector('strong');
    if (presenceName) presenceName.textContent = 'Scoopy';
    if (compactName) compactName.textContent = 'Scoopy Compact';

    // Move Scoopy to the left while preserving shop.js click handlers.
    grid.insertBefore(presenceCard, compactCard);
  }

  const heading = picker.querySelector('.variant-heading h2');
  if (heading) heading.textContent = 'Choose your Scoopy';

  // Add board-only purchase options without mixing enclosure colours into them.
  if (!document.querySelector('.board-only-picker')) {
    const boardPicker = document.createElement('section');
    boardPicker.className = 'board-only-picker config-block';
    boardPicker.innerHTML = `
      <div class="variant-heading">
        <div>
          <h2>Boards only</h2>
          <p>Already printing your own enclosure? Buy the populated PCBA on its own.</p>
        </div>
        <span>For DIY builds</span>
      </div>
      <div class="variant-grid board-grid">
        <button type="button" class="variant-card board-card" disabled>
          <span><strong>Populated PCBA + mmWave</strong><small>ESP32-C3 board with LD2410C presence sensor</small></span>
          <b>£11.49</b>
        </button>
        <button type="button" class="variant-card board-card" disabled>
          <span><strong>Populated PCBA</strong><small>ESP32-C3 board without presence sensor</small></span>
          <b>£8.49</b>
        </button>
      </div>
      <p class="board-note">Board-only options will launch alongside the complete devices. Enclosure, USB cable and power supply are not included.</p>`;
    picker.insertAdjacentElement('afterend', boardPicker);
  }

  // Keep the lower summary explicit; shop.js only updates the dimension span.
  const summaryItems = summary.querySelector(':scope > div');
  const variantDescription = picker.querySelector('.variant-description');

  function syncSummary() {
    const selected = picker.querySelector('.variant-card.is-selected');
    const isPresence = selected?.dataset.variant === 'presence';

    if (summaryItems) {
      summaryItems.innerHTML = isPresence
        ? '<span>32 × 44 × 16 mm</span><span>mmWave presence</span><span>USB-C powered</span><span>ESPHome + Home Assistant</span><span>USB cable / power supply not included</span>'
        : '<span>32 × 32 × 16 mm</span><span>USB-C powered</span><span>ESPHome + Home Assistant</span><span>USB cable / power supply not included</span>';
    }

    if (variantDescription) {
      variantDescription.textContent = isPresence
        ? 'Scoopy combines physical controls, status LEDs and mmWave room presence.'
        : 'Scoopy Compact keeps the buttons and status LEDs in the smallest enclosure.';
    }
  }

  picker.querySelectorAll('[data-variant]').forEach(button => {
    button.addEventListener('click', () => requestAnimationFrame(syncSummary));
  });
  syncSummary();

  const style = document.createElement('style');
  style.textContent = `
    .board-only-picker{margin-top:20px}
    .board-only-picker .variant-heading{align-items:flex-start}
    .board-only-picker .variant-heading p{margin:6px 0 0;color:var(--muted);font-size:.9rem;line-height:1.5}
    .board-grid .board-card{opacity:1;cursor:default}
    .board-grid .board-card:disabled{opacity:1;color:inherit}
    .board-note{margin:14px 0 0;color:var(--muted);font-size:.82rem;line-height:1.5}
  `;
  document.head.appendChild(style);
})();

const checkoutStatusScript = document.createElement('script');
checkoutStatusScript.src = 'js/checkout-status.js?v=20260822-2';
document.body.appendChild(checkoutStatusScript);

const checkoutTestScript = document.createElement('script');
checkoutTestScript.src = 'js/checkout-test.js?v=20260822-3';
document.body.appendChild(checkoutTestScript);

const checkoutPolishScript = document.createElement('script');
checkoutPolishScript.src = 'js/checkout-polish.js?v=20260822-4';
document.body.appendChild(checkoutPolishScript);
