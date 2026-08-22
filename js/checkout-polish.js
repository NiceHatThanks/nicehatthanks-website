// Sandbox-only visual polish layered after checkout-test.js.
(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get('checkoutTest') !== '1') return;

  const style = document.createElement('style');
  style.textContent = `
    .checkout-test-enabled .flavour-card[data-name="Nero"] .flavour-preview{
      background:#F5F0E6;
    }

    .checkout-test-enabled .custom-purchase-preview{
      background:#1C211B;
    }

    @media(min-width:981px){
      .checkout-test-enabled .flavour-card{grid-template-columns:142px minmax(0,1fr);min-height:170px;gap:22px;padding:18px}
      .checkout-test-enabled .flavour-preview{width:134px;height:134px;border-radius:18px}
      .checkout-test-enabled .flavour-card strong{font-size:1.02rem}
      .checkout-test-enabled .custom-purchase-card{grid-template-columns:150px minmax(0,1fr) auto;gap:22px;padding:18px}
      .checkout-test-enabled .custom-purchase-preview{width:150px;height:150px;border-radius:20px}
      .checkout-test-enabled .custom-purchase-copy strong{font-size:1.05rem}
    }

    @media(min-width:641px) and (max-width:980px){
      .checkout-test-enabled .flavour-card{grid-template-columns:108px minmax(0,1fr);min-height:142px;gap:18px;padding:16px}
      .checkout-test-enabled .flavour-preview{width:102px;height:102px;border-radius:16px}
      .checkout-test-enabled .custom-purchase-card{grid-template-columns:120px minmax(0,1fr) auto;gap:18px;padding:16px}
      .checkout-test-enabled .custom-purchase-preview{width:120px;height:120px;border-radius:18px}
    }

    @media(max-width:640px){
      .checkout-test-enabled .purchase-quantity-row{padding:12px 13px 13px;font-size:.88rem}
      .checkout-test-enabled .custom-purchase-quantity{font-size:.88rem}
      .checkout-test-enabled .mini-quantity-stepper{grid-template-columns:44px 42px 44px;border-width:2px}
      .checkout-test-enabled .mini-quantity-stepper button,
      .checkout-test-enabled .mini-quantity-stepper span{height:44px;font-size:1.08rem}
      .checkout-test-enabled .mini-quantity-stepper button{font-size:1.3rem}
    }
  `;
  document.head.appendChild(style);

  const productNames = [
    'Scoopy Compact',
    'Populated PCBA + mmWave',
    'Populated PCBA',
    'Scoopy',
  ];

  function tidyCartTitles() {
    document.querySelectorAll('.sandbox-cart-line-copy strong').forEach(title => {
      const text = title.textContent || '';
      for (const productName of productNames) {
        const suffix = ` · ${productName}`;
        if (text.endsWith(suffix)) {
          const configuration = text.slice(0, -suffix.length);
          title.textContent = `${productName} - ${configuration}`;
          break;
        }
      }
    });
  }

  function syncCustomPreviewFromMain() {
    const mainCanvas = document.getElementById('scoopyCanvas');
    const customPreview = document.querySelector('.custom-purchase-preview');
    if (!mainCanvas || !customPreview) return;

    const context = customPreview.getContext('2d');
    context.clearRect(0, 0, customPreview.width, customPreview.height);
    context.drawImage(mainCanvas, 0, 0, customPreview.width, customPreview.height);

    const summary = document.querySelector('.custom-purchase-colours');
    if (summary) {
      const lid = document.getElementById('lidName')?.textContent?.trim() || 'Vanilla';
      const base = document.getElementById('baseName')?.textContent?.trim() || 'Vanilla';
      const left = document.getElementById('button1Name')?.textContent?.trim() || 'Vanilla';
      const right = document.getElementById('button2Name')?.textContent?.trim() || 'Vanilla';
      summary.textContent = `${lid} lid · ${base} base · ${left} / ${right} buttons`;
    }
  }

  // Capture phase is intentional: the quantity controls stop propagation so a
  // normal bubbling listener never sees their clicks.
  document.body.addEventListener('click', event => {
    const randomiseButton = event.target.closest('.randomise-button');
    if (randomiseButton) {
      requestAnimationFrame(() => {
        const selectedVariant = document.querySelector('.variant-picker .variant-card.is-selected');
        if (selectedVariant) selectedVariant.click();
        requestAnimationFrame(syncCustomPreviewFromMain);
      });
      return;
    }

    const quantityButton = event.target.closest('.flavour-purchase .mini-quantity-stepper button');
    if (quantityButton) {
      const flavourCard = quantityButton.closest('.flavour-purchase')?.querySelector('.flavour-card');
      if (flavourCard) {
        requestAnimationFrame(() => flavourCard.click());
      }
    }
  }, true);

  tidyCartTitles();
  new MutationObserver(tidyCartTitles).observe(document.body, { childList: true, subtree: true });
})();
