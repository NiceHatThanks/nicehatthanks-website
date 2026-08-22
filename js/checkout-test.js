// Hidden sandbox multi-item cart. Only active with ?checkoutTest=1.
(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get('checkoutTest') !== '1') return;

  const buyButton = document.querySelector('.buy-button');
  const summary = document.querySelector('.buy-summary');
  const price = document.querySelector('.shop-price');
  const status = document.querySelector('.shop-status');
  const picker = document.querySelector('.variant-picker');
  const boardPicker = document.querySelector('.board-only-picker');
  const customBlock = document.querySelector('.custom-block');
  const mainCanvas = document.getElementById('scoopyCanvas');
  if (!buyButton || !summary || !price || !picker || !customBlock) return;

  document.body.classList.add('checkout-test-enabled');
  if (status) status.textContent = 'Sandbox checkout';

  const maxCartUnits = 10;
  const storageKey = 'nicehatthanksSandboxCartV2';
  const productInfo = {
    scoopy: { unitPence: 1599, label: 'Scoopy', needsColours: true },
    scoopy_compact: { unitPence: 1249, label: 'Scoopy Compact', needsColours: true },
    pcba_mmwave: { unitPence: 1149, label: 'Populated PCBA + mmWave', needsColours: false },
    pcba: { unitPence: 849, label: 'Populated PCBA', needsColours: false },
  };

  const colourByHex = new Map([
    ['#d789a6', 'Strawberry'],
    ['#7d947e', 'Pistachio'],
    ['#e9e1cf', 'Vanilla'],
    ['#b77a4c', 'Fudge'],
    ['#666862', 'Ash'],
    ['#242622', 'Nero'],
    ['#a9c9de', 'Bubblegum'],
    ['#b9a8ce', 'Violet'],
  ]);

  const variantCards = Array.from(picker.querySelectorAll('[data-variant]'));
  const flavourCards = Array.from(document.querySelectorAll('.flavour-card'));
  const boardCards = boardPicker ? Array.from(boardPicker.querySelectorAll('.board-card')) : [];
  if (boardCards[0]) boardCards[0].dataset.product = 'pcba_mmwave';
  if (boardCards[1]) boardCards[1].dataset.product = 'pcba';

  let cart = [];
  const registeredSteppers = [];

  function selectedScoopyProduct() {
    return picker.querySelector('[data-variant="compact"].is-selected')
      ? 'scoopy_compact'
      : 'scoopy';
  }

  function currentColours() {
    return {
      lid: document.getElementById('lidName')?.textContent?.trim() || 'Vanilla',
      base: document.getElementById('baseName')?.textContent?.trim() || 'Vanilla',
      leftButton: document.getElementById('button1Name')?.textContent?.trim() || 'Vanilla',
      rightButton: document.getElementById('button2Name')?.textContent?.trim() || 'Vanilla',
    };
  }

  function colourName(hex) {
    return colourByHex.get(String(hex || '').toLowerCase()) || 'Vanilla';
  }

  function houseItem(card) {
    return {
      product: selectedScoopyProduct(),
      configuration: card.dataset.name || 'Custom mix',
      colours: {
        lid: colourName(card.dataset.lid),
        base: colourName(card.dataset.base),
        leftButton: colourName(card.dataset.button1),
        rightButton: colourName(card.dataset.button2),
      },
    };
  }

  function customItem() {
    return {
      product: selectedScoopyProduct(),
      configuration: 'Custom mix',
      colours: currentColours(),
    };
  }

  function boardItem(card) {
    return { product: card.dataset.product };
  }

  function itemKey(item) {
    if (!item || !productInfo[item.product]) return '';
    if (!productInfo[item.product].needsColours) return item.product;
    const colours = item.colours || {};
    return [item.product, colours.lid, colours.base, colours.leftButton, colours.rightButton].join('|');
  }

  function lineFor(item) {
    const key = itemKey(item);
    return cart.find(line => itemKey(line) === key);
  }

  function quantityFor(item) {
    return lineFor(item)?.quantity || 0;
  }

  function totalUnits() {
    return cart.reduce((sum, line) => sum + line.quantity, 0);
  }

  function totalPence() {
    return cart.reduce((sum, line) => sum + productInfo[line.product].unitPence * line.quantity, 0);
  }

  const error = document.createElement('p');
  error.className = 'checkout-test-error';
  error.hidden = true;
  buyButton.insertAdjacentElement('afterend', error);

  function showError(message) {
    error.textContent = message;
    error.hidden = false;
  }

  function clearError() {
    error.hidden = true;
    error.textContent = '';
  }

  function saveState() {
    const state = {
      cart,
      product: selectedScoopyProduct(),
      colours: currentColours(),
    };
    sessionStorage.setItem(storageKey, JSON.stringify(state));
  }

  function changeCart(item, delta) {
    clearError();
    const key = itemKey(item);
    if (!key || !productInfo[item.product]) return;

    const index = cart.findIndex(line => itemKey(line) === key);
    if (delta > 0 && totalUnits() >= maxCartUnits) {
      showError(`Sandbox cart is currently limited to ${maxCartUnits} units per checkout.`);
      return;
    }

    if (index >= 0) {
      const nextQuantity = cart[index].quantity + delta;
      if (nextQuantity <= 0) {
        cart.splice(index, 1);
      } else {
        cart[index] = {
          ...cart[index],
          ...item,
          quantity: Math.min(maxCartUnits, nextQuantity),
        };
      }
    } else if (delta > 0) {
      cart.push({ ...item, quantity: 1 });
    }

    saveState();
    renderCart();
  }

  function buildStepper(getItem, register = true) {
    const stepper = document.createElement('div');
    stepper.className = 'mini-quantity-stepper';
    stepper.innerHTML = `
      <button type="button" class="mini-quantity-minus" aria-label="Decrease quantity">−</button>
      <span class="mini-quantity-value" aria-live="polite">0</span>
      <button type="button" class="mini-quantity-plus" aria-label="Increase quantity">+</button>`;

    const minus = stepper.querySelector('.mini-quantity-minus');
    const value = stepper.querySelector('.mini-quantity-value');
    const plus = stepper.querySelector('.mini-quantity-plus');

    const stopAndChange = delta => event => {
      event.preventDefault();
      event.stopPropagation();
      changeCart(getItem(), delta);
    };
    minus.addEventListener('click', stopAndChange(-1));
    plus.addEventListener('click', stopAndChange(1));

    const registration = { getItem, minus, value, plus };
    if (register) registeredSteppers.push(registration);
    return { element: stepper, registration };
  }

  function wrapPurchaseCard(card, getItem, className) {
    const wrapper = document.createElement('div');
    wrapper.className = `purchase-card-wrap ${className}`;
    card.parentNode.insertBefore(wrapper, card);
    wrapper.appendChild(card);

    const row = document.createElement('div');
    row.className = 'purchase-quantity-row';
    row.innerHTML = '<span>Quantity</span>';
    row.appendChild(buildStepper(getItem).element);
    wrapper.appendChild(row);
    return wrapper;
  }

  flavourCards.forEach(card => {
    wrapPurchaseCard(card, () => houseItem(card), 'flavour-purchase');
  });

  boardCards.forEach(card => {
    wrapPurchaseCard(card, () => boardItem(card), 'board-purchase');
  });

  const customPurchase = document.createElement('div');
  customPurchase.className = 'custom-purchase-card';
  customPurchase.innerHTML = `
    <canvas class="custom-purchase-preview" width="260" height="260" aria-label="Preview of current custom colour mix"></canvas>
    <div class="custom-purchase-copy">
      <strong>Custom mix</strong>
      <span class="custom-purchase-colours"></span>
    </div>
    <div class="custom-purchase-quantity"><span>Quantity</span></div>`;
  customPurchase.querySelector('.custom-purchase-quantity').appendChild(buildStepper(customItem).element);
  const customHeading = customBlock.querySelector('.config-heading-row');
  if (customHeading) customHeading.insertAdjacentElement('afterend', customPurchase);
  else customBlock.prepend(customPurchase);

  const customPreview = customPurchase.querySelector('.custom-purchase-preview');
  const customColourSummary = customPurchase.querySelector('.custom-purchase-colours');

  function updateCustomPreview() {
    const colours = currentColours();
    customColourSummary.textContent = `${colours.lid} lid · ${colours.base} base · ${colours.leftButton} / ${colours.rightButton} buttons`;
    if (!mainCanvas || !customPreview) return;
    const context = customPreview.getContext('2d');
    context.clearRect(0, 0, customPreview.width, customPreview.height);
    context.drawImage(mainCanvas, 0, 0, customPreview.width, customPreview.height);
  }

  const cartPanel = document.createElement('section');
  cartPanel.className = 'sandbox-cart-panel';
  cartPanel.innerHTML = `
    <div class="sandbox-cart-heading">
      <div><strong>Your sandbox cart</strong><span>Up to ${maxCartUnits} units while we test checkout</span></div>
      <b class="sandbox-cart-total">£0.00</b>
    </div>
    <div class="sandbox-cart-lines"></div>`;

  const firstSummaryParagraph = summary.querySelector('p');
  if (firstSummaryParagraph) firstSummaryParagraph.insertAdjacentElement('beforebegin', cartPanel);
  else buyButton.insertAdjacentElement('beforebegin', cartPanel);

  const sandboxNotice = document.createElement('div');
  sandboxNotice.className = 'checkout-test-notice';
  sandboxNotice.innerHTML = '<strong>Stripe sandbox</strong><span>Test payments only · no real money will be taken</span>';
  cartPanel.insertAdjacentElement('beforebegin', sandboxNotice);

  const cartLines = cartPanel.querySelector('.sandbox-cart-lines');
  const cartTotal = cartPanel.querySelector('.sandbox-cart-total');

  function productLineTitle(line) {
    const product = productInfo[line.product];
    return line.configuration
      ? `${line.configuration} · ${product.label}`
      : product.label;
  }

  function productLineDetail(line) {
    if (!line.colours) return 'Board only';
    return `Lid ${line.colours.lid} · Base ${line.colours.base} · Left ${line.colours.leftButton} · Right ${line.colours.rightButton}`;
  }

  function renderRegisteredSteppers() {
    registeredSteppers.forEach(control => {
      const quantity = quantityFor(control.getItem());
      control.value.textContent = String(quantity);
      control.minus.disabled = quantity <= 0;
      control.plus.disabled = totalUnits() >= maxCartUnits;
    });
  }

  function renderCartLines() {
    cartLines.replaceChildren();
    if (!cart.length) {
      const empty = document.createElement('p');
      empty.className = 'sandbox-cart-empty';
      empty.textContent = 'Your cart is empty. Use the + controls beside any flavour, custom mix or board.';
      cartLines.appendChild(empty);
      return;
    }

    cart.forEach(line => {
      const row = document.createElement('div');
      row.className = 'sandbox-cart-line';

      const copy = document.createElement('div');
      copy.className = 'sandbox-cart-line-copy';
      const title = document.createElement('strong');
      title.textContent = productLineTitle(line);
      const detail = document.createElement('span');
      detail.textContent = productLineDetail(line);
      copy.append(title, detail);

      const priceCopy = document.createElement('div');
      priceCopy.className = 'sandbox-cart-line-price';
      const lineTotal = (productInfo[line.product].unitPence * line.quantity / 100).toFixed(2);
      priceCopy.innerHTML = `<b>£${lineTotal}</b>`;

      const cartStepper = buildStepper(() => line, false);
      cartStepper.registration.value.textContent = String(line.quantity);
      cartStepper.registration.minus.disabled = line.quantity <= 0;
      cartStepper.registration.plus.disabled = totalUnits() >= maxCartUnits;
      priceCopy.appendChild(cartStepper.element);

      row.append(copy, priceCopy);
      cartLines.appendChild(row);
    });
  }

  function renderCart() {
    renderRegisteredSteppers();
    renderCartLines();
    updateCustomPreview();

    const units = totalUnits();
    const total = (totalPence() / 100).toFixed(2);
    cartTotal.textContent = `£${total}`;
    buyButton.disabled = units === 0;
    buyButton.textContent = units
      ? `Checkout ${units} item${units === 1 ? '' : 's'} · £${total} · sandbox`
      : 'Add something to your cart';
  }

  const oldNote = summary.querySelector(':scope > p:last-child');
  if (oldNote) oldNote.textContent = 'Sandbox checkout is enabled for this test URL only.';

  function restoreState() {
    let saved;
    try {
      saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    } catch {
      return;
    }
    if (!saved || !Array.isArray(saved.cart)) return;

    let restoredUnits = 0;
    cart = saved.cart.filter(line => {
      if (!line || !productInfo[line.product]) return false;
      const quantity = Number(line.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) return false;
      restoredUnits += quantity;
      return restoredUnits <= maxCartUnits;
    }).map(line => ({ ...line, quantity: Math.min(maxCartUnits, Number(line.quantity)) }));

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

  variantCards.forEach(card => {
    card.addEventListener('click', () => requestAnimationFrame(() => {
      saveState();
      renderCart();
    }));
  });

  [...flavourCards, ...Array.from(document.querySelectorAll('.swatch'))].forEach(control => {
    control.addEventListener('click', () => requestAnimationFrame(() => {
      saveState();
      renderCart();
    }));
  });

  buyButton.addEventListener('click', async () => {
    clearError();
    if (!cart.length) return;

    saveState();
    buyButton.disabled = true;
    const previousText = buyButton.textContent;
    buyButton.textContent = 'Opening Stripe Checkout…';

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || 'Unable to start checkout.');
      window.location.assign(data.url);
    } catch (checkoutError) {
      console.error('Unable to start sandbox checkout', checkoutError);
      showError(checkoutError.message || 'Unable to start sandbox checkout.');
      buyButton.disabled = false;
      buyButton.textContent = previousText;
    }
  });

  const style = document.createElement('style');
  style.textContent = `
    .checkout-test-enabled .purchase-card-wrap{min-width:0;display:grid;gap:7px}
    .checkout-test-enabled .purchase-card-wrap .flavour-card,.checkout-test-enabled .purchase-card-wrap .board-card{width:100%}
    .checkout-test-enabled .purchase-quantity-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 7px 4px;font-size:.78rem;font-weight:750;color:var(--muted)}
    .mini-quantity-stepper{display:grid;grid-template-columns:30px 30px 30px;align-items:center;border:1px solid var(--border);border-radius:999px;overflow:hidden;background:rgba(255,255,255,.42);color:var(--text)}
    .mini-quantity-stepper button,.mini-quantity-stepper span{display:grid;place-items:center;height:30px;border:0;background:transparent;color:inherit;font:inherit;font-weight:850;text-align:center}
    .mini-quantity-stepper button{cursor:pointer;font-size:1rem}
    .mini-quantity-stepper button:disabled{opacity:.28;cursor:not-allowed}
    .custom-purchase-card{display:grid;grid-template-columns:92px minmax(0,1fr) auto;align-items:center;gap:16px;margin:0 0 20px;padding:15px;border:1px solid var(--border);border-radius:20px;background:rgba(255,255,255,.12)}
    .custom-purchase-preview{display:block;width:92px;height:92px;border-radius:15px;background:rgba(255,255,255,.14)}
    .custom-purchase-copy{display:flex;min-width:0;flex-direction:column;gap:6px}
    .custom-purchase-copy strong{font-size:.98rem}
    .custom-purchase-copy span{color:var(--muted);font-size:.76rem;line-height:1.4}
    .custom-purchase-quantity{display:flex;flex-direction:column;align-items:flex-end;gap:7px;color:var(--muted);font-size:.76rem;font-weight:750}
    .checkout-test-notice{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:2px 0 14px;padding:12px 14px;border:2px dashed var(--text);border-radius:14px;font-size:.85rem}
    .checkout-test-notice span{color:var(--muted);text-align:right}
    .sandbox-cart-panel{margin:0 0 18px;padding:18px;border:1px solid var(--border);border-radius:18px;background:rgba(255,255,255,.22)}
    .sandbox-cart-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:12px;border-bottom:1px solid var(--border)}
    .sandbox-cart-heading>div{display:flex;flex-direction:column;gap:4px}
    .sandbox-cart-heading strong{font-size:.98rem}
    .sandbox-cart-heading span{color:var(--muted);font-size:.76rem}
    .sandbox-cart-total{font-size:1.08rem;white-space:nowrap}
    .sandbox-cart-lines{display:grid;gap:0}
    .sandbox-cart-empty{margin:14px 0 0!important;text-align:left!important;font-size:.8rem!important}
    .sandbox-cart-line{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid var(--border)}
    .sandbox-cart-line:last-child{padding-bottom:0;border-bottom:0}
    .sandbox-cart-line-copy{display:flex;min-width:0;flex-direction:column;gap:4px}
    .sandbox-cart-line-copy strong{font-size:.86rem}
    .sandbox-cart-line-copy span{color:var(--muted);font-size:.72rem;line-height:1.35}
    .sandbox-cart-line-price{display:flex;align-items:center;gap:10px}
    .sandbox-cart-line-price>b{font-size:.84rem;white-space:nowrap}
    .checkout-test-enabled .buy-button{opacity:1;cursor:pointer}
    .checkout-test-enabled .buy-button:disabled{opacity:.48;cursor:not-allowed}
    .checkout-test-error{margin:10px 0 0!important;font-size:.88rem!important;font-weight:700;text-align:left!important;color:var(--text)!important}
    @media(max-width:640px){
      .custom-purchase-card{grid-template-columns:74px minmax(0,1fr);gap:12px}.custom-purchase-preview{width:74px;height:74px}.custom-purchase-quantity{grid-column:1/-1;flex-direction:row;align-items:center;justify-content:space-between}.sandbox-cart-line{grid-template-columns:1fr}.sandbox-cart-line-price{justify-content:space-between}.checkout-test-notice{align-items:flex-start;flex-direction:column}.checkout-test-notice span{text-align:left}
    }
  `;
  document.head.appendChild(style);

  restoreState();
  requestAnimationFrame(renderCart);
})();