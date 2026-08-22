// UK shipping estimate shown in both the public cart preview and Stripe sandbox cart.
(function () {
  const params = new URLSearchParams(window.location.search);
  const isSandbox = params.get('checkoutTest') === '1';

  function parsePence(text) {
    const value = Number.parseFloat(String(text || '').replace(/[^0-9.]/g, ''));
    return Number.isFinite(value) ? Math.round(value * 100) : 0;
  }

  function shippingForCart(subtotalPence, totalUnits, assembledUnits) {
    if (!totalUnits) return null;

    // More than three enclosed devices are treated as a Small Parcel.
    if (assembledUnits > 3) {
      return {
        amountPence: 365,
        name: 'Royal Mail Tracked 48 - Small Parcel',
        note: 'Tracked delivery · usually 2-3 working days',
      };
    }

    // Orders worth more than £20 use Tracked 48 for the higher compensation cover.
    if (subtotalPence > 2000) {
      return {
        amountPence: 285,
        name: 'Royal Mail Tracked 48 - Large Letter',
        note: 'Tracked delivery · usually 2-3 working days',
      };
    }

    return {
      amountPence: 155,
      name: 'Royal Mail 2nd Class - Large Letter',
      note: 'UK delivery · usually 2-3 working days',
    };
  }

  function cartState(panel) {
    const rows = Array.from(panel.querySelectorAll('.sandbox-cart-line'));
    let subtotalPence = 0;
    let totalUnits = 0;
    let assembledUnits = 0;

    rows.forEach(row => {
      subtotalPence += parsePence(row.querySelector('.sandbox-cart-line-price > b')?.textContent);
      const quantity = Number.parseInt(row.querySelector('.sandbox-cart-line-price .mini-quantity-value')?.textContent || '0', 10) || 0;
      totalUnits += quantity;

      const title = row.querySelector('.sandbox-cart-line-copy strong')?.textContent || '';
      if (title.includes('Scoopy')) assembledUnits += quantity;
    });

    return { subtotalPence, totalUnits, assembledUnits };
  }

  function ensureShippingRow(panel) {
    let row = panel.querySelector('.shop-shipping-row');
    if (row) return row;

    row = document.createElement('div');
    row.className = 'shop-shipping-row';
    row.innerHTML = `
      <div>
        <strong class="shop-shipping-name">UK postage</strong>
        <span class="shop-shipping-note"></span>
      </div>
      <b class="shop-shipping-price"></b>`;
    panel.querySelector('.sandbox-cart-lines')?.insertAdjacentElement('afterend', row);
    return row;
  }

  function setText(element, text) {
    if (element && element.textContent !== text) element.textContent = text;
  }

  function updateShipping() {
    const panel = document.querySelector('.sandbox-cart-panel');
    if (!panel) return;

    const { subtotalPence, totalUnits, assembledUnits } = cartState(panel);
    const shipping = shippingForCart(subtotalPence, totalUnits, assembledUnits);
    const row = ensureShippingRow(panel);

    if (!shipping) {
      row.hidden = true;
      return;
    }

    row.hidden = false;
    setText(row.querySelector('.shop-shipping-name'), shipping.name);
    setText(row.querySelector('.shop-shipping-note'), shipping.note);
    setText(row.querySelector('.shop-shipping-price'), `£${(shipping.amountPence / 100).toFixed(2)}`);

    const orderTotalPence = subtotalPence + shipping.amountPence;
    const orderTotal = `£${(orderTotalPence / 100).toFixed(2)}`;
    setText(panel.querySelector('.sandbox-cart-total'), orderTotal);

    const buyButton = document.querySelector('.buy-button');
    if (buyButton && totalUnits) {
      const label = isSandbox
        ? `Checkout ${totalUnits} item${totalUnits === 1 ? '' : 's'} · ${orderTotal} · sandbox`
        : `Checkout coming soon · ${orderTotal}`;
      setText(buyButton, label);
    }

    if (!isSandbox) {
      const summary = document.querySelector('.buy-summary');
      const note = summary?.querySelector(':scope > p:last-child');
      if (note) {
        setText(note, 'UK postage is charged once per order. Checkout will be enabled when the first units are ready.');
      }
    }
  }

  const style = document.createElement('style');
  style.textContent = `
    .shop-shipping-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:14px 0 0;margin-top:13px;border-top:1px solid var(--border)}
    .shop-shipping-row[hidden]{display:none}
    .shop-shipping-row>div{display:flex;min-width:0;flex-direction:column;gap:4px}
    .shop-shipping-row strong{font-size:.86rem}
    .shop-shipping-row span{color:var(--muted);font-size:.72rem;line-height:1.35}
    .shop-shipping-row>b{font-size:.84rem;white-space:nowrap}
  `;
  document.head.appendChild(style);

  let scheduled = false;
  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      updateShipping();
    });
  }

  new MutationObserver(scheduleUpdate).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  scheduleUpdate();
})();
