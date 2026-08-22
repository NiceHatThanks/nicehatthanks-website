// Sandbox-only visual polish layered after checkout-test.js.
(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get('checkoutTest') !== '1') return;

  const style = document.createElement('style');
  style.textContent = `
    @media(min-width:641px){
      .checkout-test-enabled .flavour-card{grid-template-columns:94px minmax(0,1fr);min-height:154px;gap:20px;padding:20px}
      .checkout-test-enabled .mini-device{width:82px;height:82px}
      .checkout-test-enabled .mini-device i{inset:6px 6px 22px;border-radius:20px;box-shadow:0 17px 0 -2px var(--mini-base)}
      .checkout-test-enabled .mini-device i::before,.checkout-test-enabled .mini-device i::after{top:24px;width:16px;height:16px}
      .checkout-test-enabled .mini-device i::before{left:14px}
      .checkout-test-enabled .mini-device i::after{right:14px}
      .checkout-test-enabled .flavour-card strong{font-size:1rem}
      .checkout-test-enabled .custom-purchase-card{grid-template-columns:132px minmax(0,1fr) auto;gap:20px;padding:18px}
      .checkout-test-enabled .custom-purchase-preview{width:132px;height:132px;border-radius:18px}
      .checkout-test-enabled .custom-purchase-copy strong{font-size:1.05rem}
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
          title.textContent = `${productName} — ${configuration}`;
          break;
        }
      }
    });
  }

  tidyCartTitles();
  const cartLines = document.querySelector('.sandbox-cart-lines');
  if (cartLines) {
    new MutationObserver(tidyCartTitles).observe(cartLines, { childList: true, subtree: true });
  }
})();
