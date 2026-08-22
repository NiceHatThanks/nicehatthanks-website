(function () {
  const params = new URLSearchParams(window.location.search);
  const checkoutState = params.get('checkout');
  if (!checkoutState) return;

  const banner = document.createElement('div');
  banner.className = 'checkout-status-banner';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');

  const style = document.createElement('style');
  style.textContent = `
    .checkout-status-banner{max-width:1180px;margin:18px auto 0;padding:16px 20px;border:2px solid var(--text);border-radius:18px;background:var(--surface,#fff);color:var(--text);font-size:.95rem;line-height:1.5}
    .checkout-status-banner strong{display:block;margin-bottom:3px;font-size:1rem}
    .checkout-status-banner.is-error{border-style:dashed}
    @media(max-width:1220px){.checkout-status-banner{margin-left:20px;margin-right:20px}}
  `;
  document.head.appendChild(style);

  const header = document.querySelector('.site-header');
  if (header) header.insertAdjacentElement('afterend', banner);
  else document.body.prepend(banner);

  if (checkoutState === 'cancelled') {
    banner.innerHTML = '<strong>Checkout cancelled</strong>No payment was taken. Your sandbox cart is still available on this page.';
    return;
  }

  if (checkoutState !== 'success') return;

  const sessionId = params.get('session_id');
  if (!sessionId) {
    banner.classList.add('is-error');
    banner.innerHTML = '<strong>Unable to verify sandbox order</strong>The checkout return did not include a Stripe session ID.';
    return;
  }

  banner.innerHTML = '<strong>Checking sandbox order…</strong>Verifying the test payment with Stripe.';

  fetch(`/api/checkout-session?session_id=${encodeURIComponent(sessionId)}`)
    .then(response => response.json().then(data => ({ ok: response.ok, data })))
    .then(({ ok, data }) => {
      if (!ok || data.paymentStatus !== 'paid') {
        throw new Error(data.error || 'Payment is not marked as paid.');
      }

      const units = Number(data.cartUnits || data.metadata?.cart_units || data.metadata?.quantity || 1);
      const lines = Array.isArray(data.cart) && data.cart.length
        ? data.cart.length
        : Number(data.metadata?.cart_line_count || 1);
      const emailText = data.customerEmail ? ` A Stripe confirmation was sent to ${data.customerEmail}.` : '';
      const configurationText = lines > 1 ? ` across ${lines} configurations` : '';

      banner.innerHTML = `<strong>Sandbox order successful</strong>Stripe verified payment for ${units} item${units === 1 ? '' : 's'}${configurationText}.${emailText} No real money was taken.`;
    })
    .catch(error => {
      console.error('Unable to verify sandbox checkout', error);
      banner.classList.add('is-error');
      banner.innerHTML = '<strong>Unable to verify sandbox order</strong>The test checkout returned successfully, but this page could not verify the payment with Stripe.';
    });
})();
