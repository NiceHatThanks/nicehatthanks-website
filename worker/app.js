import checkoutWorker from './index.js';

const productInfo = {
  scoopy: { name: 'Scoopy', unitAmount: 1599, hasColours: true },
  scoopy_compact: { name: 'Scoopy Compact', unitAmount: 1249, hasColours: true },
  pcba_mmwave: { name: 'Populated PCBA + mmWave', unitAmount: 1149, hasColours: false },
  pcba: { name: 'Populated PCBA', unitAmount: 849, hasColours: false },
};

function json(data, status = 200) {
  return Response.json(data, { status });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatGbp(pence) {
  const value = Number(pence);
  return Number.isFinite(value) ? `£${(value / 100).toFixed(2)}` : '£0.00';
}

function parseStripeSignature(header) {
  const values = String(header || '').split(',');
  let timestamp = null;
  const signatures = [];

  for (const value of values) {
    const [key, raw] = value.trim().split('=', 2);
    if (key === 't' && /^\d+$/.test(raw || '')) timestamp = Number(raw);
    if (key === 'v1' && raw) signatures.push(raw);
  }

  return { timestamp, signatures };
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

async function hmacSha256Hex(secret, value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function verifyStripeWebhook(rawBody, signatureHeader, webhookSecret) {
  if (!webhookSecret || typeof webhookSecret !== 'string') return false;

  const { timestamp, signatures } = parseStripeSignature(signatureHeader);
  if (!timestamp || !signatures.length) return false;

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (ageSeconds > 300) return false;

  const expected = await hmacSha256Hex(webhookSecret, `${timestamp}.${rawBody}`);
  return signatures.some(signature => constantTimeEqual(signature, expected));
}

function readCartFromMetadata(metadata = {}) {
  const lineCount = Number.parseInt(metadata.cart_line_count || '0', 10);
  const items = [];

  if (!Number.isInteger(lineCount) || lineCount < 1 || lineCount > 20) return items;

  for (let index = 1; index <= lineCount; index += 1) {
    const raw = metadata[`line_${String(index).padStart(2, '0')}`] ?? metadata[`line_${index}`];
    if (!raw) continue;

    try {
      const item = JSON.parse(raw);
      const product = productInfo[item?.product];
      const quantity = Number(item?.quantity);
      if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) continue;

      items.push({
        product: item.product,
        quantity,
        configuration: typeof item.configuration === 'string' ? item.configuration : null,
        colours: item.colours && typeof item.colours === 'object' ? item.colours : null,
      });
    } catch {
      // Ignore malformed metadata lines.
    }
  }

  return items;
}

function orderLineName(item) {
  const product = productInfo[item.product];
  if (!product) return 'Item';
  return item.configuration ? `${product.name} - ${item.configuration}` : product.name;
}

function orderLineColours(item) {
  if (!item.colours) return '';
  const { lid, base, leftButton, rightButton } = item.colours;
  return `Lid: ${lid} · Base: ${base} · Left button: ${leftButton} · Right button: ${rightButton}`;
}

function buildOrderEmail(session) {
  const metadata = session.metadata || {};
  const items = readCartFromMetadata(metadata);
  if (!items.length) throw new Error('Paid Checkout Session did not contain readable order metadata.');

  const customerEmail = session.customer_details?.email || session.customer_email || '';
  if (!customerEmail) throw new Error('Paid Checkout Session did not contain a customer email address.');

  const customerName = String(session.customer_details?.name || '').trim();
  const firstName = customerName ? customerName.split(/\s+/)[0] : '';
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';

  const shippingAmount = Number.parseInt(metadata.shipping_amount || '0', 10) || 0;
  const shippingService = metadata.shipping_service || 'Royal Mail delivery';
  const total = Number(session.amount_total) || 0;

  const htmlLines = items.map(item => {
    const product = productInfo[item.product];
    const lineTotal = product.unitAmount * item.quantity;
    const colours = orderLineColours(item);

    return `<tr>
      <td style="padding:12px 0;border-bottom:1px solid #ded8cc;vertical-align:top">
        <strong style="color:#1C211B">${escapeHtml(orderLineName(item))}</strong>
        ${colours ? `<div style="margin-top:4px;color:#666862;font-size:13px;line-height:1.45">${escapeHtml(colours)}</div>` : ''}
      </td>
      <td style="padding:12px 12px;border-bottom:1px solid #ded8cc;vertical-align:top;text-align:center;white-space:nowrap">× ${item.quantity}</td>
      <td style="padding:12px 0;border-bottom:1px solid #ded8cc;vertical-align:top;text-align:right;white-space:nowrap"><strong>${formatGbp(lineTotal)}</strong></td>
    </tr>`;
  }).join('');

  const textLines = items.map(item => {
    const product = productInfo[item.product];
    const colours = orderLineColours(item);
    return `- ${orderLineName(item)} × ${item.quantity} - ${formatGbp(product.unitAmount * item.quantity)}${colours ? `\n  ${colours}` : ''}`;
  }).join('\n');

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#F5F0E6;color:#1C211B;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:620px;margin:0 auto;padding:32px 20px">
    <div style="background:#ffffff;border:1px solid #ded8cc;border-radius:18px;padding:28px">
      <div style="font-size:24px;font-weight:800;margin-bottom:24px">NiceHatThanks</div>
      <p style="font-size:16px;line-height:1.6;margin:0 0 14px">${escapeHtml(greeting)}</p>
      <p style="font-size:16px;line-height:1.6;margin:0 0 22px">Thanks for your order! I've got it and I'll start getting everything ready. Here's a summary of what you chose:</p>

      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">
        <tbody>${htmlLines}</tbody>
      </table>

      <table role="presentation" style="width:100%;border-collapse:collapse;margin-top:18px;font-size:14px;line-height:1.7">
        <tbody>
          <tr>
            <td style="padding:0 20px 0 0;vertical-align:top">${escapeHtml(shippingService)}</td>
            <td style="padding:0;vertical-align:top;text-align:right;white-space:nowrap"><strong>${formatGbp(shippingAmount)}</strong></td>
          </tr>
          <tr>
            <td style="padding:8px 20px 0 0;vertical-align:top;font-size:17px"><strong>Total</strong></td>
            <td style="padding:8px 0 0;vertical-align:top;text-align:right;white-space:nowrap;font-size:17px"><strong>${formatGbp(total)}</strong></td>
          </tr>
        </tbody>
      </table>

      <p style="font-size:16px;line-height:1.6;margin:26px 0 0">I'll send you another email as soon as your order has been dispatched.</p>
      <p style="font-size:16px;line-height:1.6;margin:18px 0 0">While you're waiting, take a look at the <a href="https://nicehatthanks.com/setup/" style="color:#1C211B;font-weight:700">setup guide</a> so you're ready to get going as soon as it arrives.</p>
      <p style="font-size:16px;line-height:1.6;margin:18px 0 0">Thanks again,<br><strong>Zach</strong></p>
    </div>
    <p style="margin:16px 4px 0;color:#666862;font-size:12px;line-height:1.5">Questions about your order? Reply to this email and it'll reach me at orders@nicehatthanks.com.</p>
  </div>
</body>
</html>`;

  const text = `${greeting}

Thanks for your order! I've got it and I'll start getting everything ready. Here's a summary of what you chose:

${textLines}

${shippingService}: ${formatGbp(shippingAmount)}
Total: ${formatGbp(total)}

I'll send you another email as soon as your order has been dispatched.

While you're waiting, take a look at the setup guide so you're ready to get going as soon as it arrives:
https://nicehatthanks.com/setup/

Thanks again,
Zach

Questions about your order? Reply to this email and it'll reach me at orders@nicehatthanks.com.`;

  return {
    to: customerEmail,
    subject: 'Thanks for your NiceHatThanks order',
    html,
    text,
  };
}

async function sendOrderConfirmation(session, env) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured.');

  const email = buildOrderEmail(session);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `order-confirmation-${session.id}`,
    },
    body: JSON.stringify({
      from: 'NiceHatThanks <orders@nicehatthanks.com>',
      to: [email.to],
      reply_to: 'orders@nicehatthanks.com',
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error('Resend order confirmation failed', response.status, details);
    throw new Error('Unable to send order confirmation email.');
  }
}

async function handleStripeWebhook(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!env.STRIPE_WEBHOOK_SECRET) return json({ error: 'Stripe webhook is not configured.' }, 500);

  const rawBody = await request.text();
  const signatureHeader = request.headers.get('Stripe-Signature') || '';
  const validSignature = await verifyStripeWebhook(rawBody, signatureHeader, env.STRIPE_WEBHOOK_SECRET);
  if (!validSignature) return json({ error: 'Invalid Stripe signature.' }, 400);

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Invalid webhook JSON.' }, 400);
  }

  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
    return json({ received: true, ignored: true });
  }

  const session = event.data?.object;
  if (!session || session.object !== 'checkout.session') {
    return json({ error: 'Invalid Checkout Session event.' }, 400);
  }

  if (session.payment_status !== 'paid') {
    return json({ received: true, ignored: true, reason: 'payment_not_paid' });
  }

  try {
    await sendOrderConfirmation(session, env);
  } catch (error) {
    console.error('Unable to process paid order webhook', event.id, error);
    return json({ error: 'Unable to process order confirmation.' }, 502);
  }

  return json({ received: true, email: 'sent' });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/stripe-webhook') {
      return handleStripeWebhook(request, env);
    }

    return checkoutWorker.fetch(request, env, ctx);
  },
};
