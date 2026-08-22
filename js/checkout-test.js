// Hidden sandbox checkout UI. Only active with ?checkoutTest=1.
(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get('checkoutTest') !== '1') return;

  const buyButton = document.querySelector('.buy-button');
  const summary = document.querySelector('.buy-summary');
  const price = document.querySelector('.shop-price');
  const status = document.querySelector('.shop-status');
  const picker = document.querySelector('.variant-picker');
  const boardPicker = document.querySelector('.board-only-picker');
  if (!buyButton || !summary || !price || !picker) return;

  document.body.classList.add('checkout-test-enabled');
  if (status) status.textContent = 'Sandbox checkout';

  const productInfo = {
    scoopy: { unitPence: 1599, label: 'Scoopy' },
    scoopy_compact: { unitPence: 1249, label: 'Scoopy Compact' },
    pcba_mmwave: { unitPence: 1149, label: 'Populated PCBA + mmWave' },
    pcba: { unitPence: 849, label: 'Populated PCBA' },
  };

  const variantCards = Array.from(picker.querySelectorAll('[data-variant]'));
  const boardCards = boardPicker ? Array.from(boardPicker.querySelectorAll('.board-card')) : [];
  const flavourBlock = document.querySelector('[aria-labelledby="flavour-heading"]');
  const customBlock = document.querySelector('.custom-block');
  const summaryItems = summary.querySelector(':scope > div');
  const variantDescription = picker.querySelector('.variant-description');

  if (boardCards[0]) boardCards[0].dataset.product = 'pcba_mmwave';
  if (boardCards[1]) boardCards[1].dataset.product = 'pcba';
  boardCards.forEach(card => card.removeAttribute('disabled'));

  let selectedProduct = picker.querySelector('[data-variant="compact"].is-selected')
    ? 'scoopy_compact'
    : 'scoopy';

  function showColourControls(show) {
    if (flavourBlock) flavourBlock.hidden = !show;
    if (customBlock) customBlock.hidden = !show;
  }

  function selectBoard(card) {
    const productKey = card.dataset.product;
    if (!productInfo[productKey]) return;

    selectedProduct = productKey;
    variantCards.forEach(item => item.classList.remove('is-selected'));
    boardCards.forEach(item => item.classList.toggle('is-selected', item === card));
    showColourControls(false);

    const info = productInfo[productKey];
    price.textContent = `£${(info.unitPence / 100).toFixed(2)}`;
    if (summaryItems) {
      summaryItems.innerHTML = productKey === 'pcba_mmwave'
        ? '<span>Populated PCBA</span><span>LD2410C mmWave presence</span><span>ESP32-C3</span><span>Enclosure / USB cable / power supply not included</span>'
        : '<span>Populated PCBA</span><span>ESP32-C3</span><span>No presence sensor</span><span>Enclosure / USB cable / power supply not included</span>';
    }
    if (variantDescription) {
      variantDescription.textContent = 'Board-only purchase selected. Enclosure colour choices are not included.';
    }
    updateButtonLabel();
  }

  boardCards.forEach(card => card.addEventListener('click', () => selectBoard(card)));

  variantCards.forEach(card => {
    card.addEventListener('click', () => {
      selectedProduct = card.dataset.variant === 'compact' ? 'scoopy_compact' : 'scoopy';
      boardCards.forEach(item => item.classList.remove('is-selected'));
      showColourControls(true);
      requestAnimationFrame(updateButtonLabel);
    });
  });

  const controls = document.createElement('div');
  controls.className = 'checkout-test-controls';
  controls.innerHTML = `
    <div class="checkout-test-notice"><strong>Stripe sandbox</strong><span>Test payments only · no real money will be taken</span></div>
    <div class="quantity-control">
      <span class="quantity-label">Quantity</span>
      <div class="quantity-stepper" aria-label="Quantity">
        <button type="button" class="quantity-minus" aria-label="Decrease quantity">−</button>
        <input class="quantity-input" type="number" min="1" max="10" step="1" value="1" inputmode="numeric" aria-label="Quantity">
        <button type="button" class="quantity-plus" aria-label="Increase quantity">+</button>
      </div>
    </div>`;
  buyButton.insertAdjacentElement('beforebegin', controls);

  const quantityInput = controls.querySelector('.quantity-input');
  const minusButton = controls.querySelector('.quantity-minus');
  const plusButton = controls.querySelector('.quantity-plus');

  function quantity() {
    const value = Number.parseInt(quantityInput.value, 10);
    return Number.isInteger(value) ? Math.min(10, Math.max(1, value)) : 1;
  }

  function setQuantity(value) {
    quantityInput.value = String(Math.min(10, Math.max(1, value)));
    updateButtonLabel();
  }

  function updateButtonLabel() {
    const info = productInfo[selectedProduct];
    if (!info) return;
    const qty = quantity();
    const total = (info.unitPence * qty / 100).toFixed(2);
    buyButton.textContent = `Checkout ${qty} · £${total} · sandbox`;
  }

  minusButton.addEventListener('click', () => setQuantity(quantity() - 1));
  plusButton.addEventListener('click', () => setQuantity(quantity() + 1));
  quantityInput.addEventListener('change', () => setQuantity(quantity()));
  quantityInput.addEventListener('input', updateButtonLabel);

  buyButton.disabled = false;
  const oldNote = summary.querySelector(':scope > p:last-child');
  if (oldNote) oldNote.textContent = 'Sandbox checkout is enabled for this test URL only.';

  const error = document.createElement('p');
  error.className = 'checkout-test-error';
  error.hidden = true;
  buyButton.insertAdjacentElement('afterend', error);

  function currentColours() {
    return {
      lid: document.getElementById('lidName')?.textContent?.trim(),
      base: document.getElementById('baseName')?.textContent?.trim(),
      leftButton: document.getElementById('button1Name')?.textContent?.trim(),
      rightButton: document.getElementById('button2Name')?.textContent?.trim(),
    };
  }

  function saveConfiguration() {
    const saved = {
      product: selectedProduct,
      quantity: quantity(),
      colours: currentColours(),
    };
    sessionStorage.setItem('nicehatthanksCheckoutTest', JSON.stringify(saved));
  }

  function restoreConfiguration() {
    let saved;
    try {
      saved = JSON.parse(sessionStorage.getItem('nicehatthanksCheckoutTest') || 'null');
    } catch {
      return;
    }
    if (!saved || !productInfo[saved.product]) return;

    setQuantity(Number(saved.quantity) || 1);

    if (saved.product === 'pcba_mmwave' || saved.product === 'pcba') {
      const boardCard = boardCards.find(card => card.dataset.product === saved.product);
      if (boardCard) selectBoard(boardCard);
      return;
    }

    const wantedVariant = saved.product === 'scoopy_compact' ? 'compact' : 'presence';
    const variantCard = variantCards.find(card => card.dataset.variant === wantedVariant);
    if (variantCard) variantCard.click();

    const parts = {
      lid: saved.colours?.lid,
      base: saved.colours?.base,
      button1: saved.colours?.leftButton,
      button2: saved.colours?.rightButton,
    };
    Object.entries(parts).forEach(([part, name]) => {
      if (!name) return;
      const swatch = Array.from(document.querySelectorAll(`.swatch-row[data-part="${part}"] .swatch`))
        .find(item => item.dataset.name === name);
      if (swatch) swatch.click();
    });
  }

  buyButton.addEventListener('click', async () => {
    error.hidden = true;
    const body = {
      product: selectedProduct,
      quantity: quantity(),
    };
    if (selectedProduct === 'scoopy' || selectedProduct === 'scoopy_compact') {
      body.colours = currentColours();
    }

    saveConfiguration();
    buyButton.disabled = true;
    const previousText = buyButton.textContent;
    buyButton.textContent = 'Opening Stripe Checkout…';

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || 'Unable to start checkout.');
      window.location.assign(data.url);
    } catch (checkoutError) {
      console.error('Unable to start sandbox checkout', checkoutError);
      error.textContent = checkoutError.message || 'Unable to start sandbox checkout.';
      error.hidden = false;
      buyButton.disabled = false;
      buyButton.textContent = previousText;
    }
  });

  const style = document.createElement('style');
  style.textContent = `
    .checkout-test-enabled .board-grid .board-card{cursor:pointer}
    .checkout-test-enabled .board-card.is-selected{outline:3px solid var(--text);outline-offset:2px}
    .checkout-test-controls{margin:20px 0 14px;display:grid;gap:14px}
    .checkout-test-notice{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 14px;border:2px dashed var(--text);border-radius:14px;font-size:.85rem}
    .checkout-test-notice span{color:var(--muted);text-align:right}
    .quantity-control{display:flex;align-items:center;justify-content:space-between;gap:16px}
    .quantity-label{font-weight:800}
    .quantity-stepper{display:grid;grid-template-columns:42px 58px 42px;align-items:center;border:2px solid var(--text);border-radius:999px;overflow:hidden;background:#fff}
    .quantity-stepper button,.quantity-stepper input{height:40px;border:0;background:transparent;color:var(--text);font:inherit;font-weight:800;text-align:center}
    .quantity-stepper button{cursor:pointer;font-size:1.2rem}
    .quantity-stepper input{width:100%;appearance:textfield;-moz-appearance:textfield}
    .quantity-stepper input::-webkit-outer-spin-button,.quantity-stepper input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
    .checkout-test-error{margin:10px 0 0;font-size:.88rem;font-weight:700}
    @media(max-width:520px){.checkout-test-notice{align-items:flex-start;flex-direction:column}.checkout-test-notice span{text-align:left}}
  `;
  document.head.appendChild(style);

  restoreConfiguration();
  updateButtonLabel();
})();
