const productInfo = {
  scoopy: { name: 'Scoopy', unitAmount: 1599, hasColours: true },
  scoopy_compact: { name: 'Scoopy Compact', unitAmount: 1249, hasColours: true },
  pcba_mmwave: { name: 'Populated PCBA + mmWave', unitAmount: 1149, hasColours: false },
  pcba: { name: 'Populated PCBA', unitAmount: 849, hasColours: false },
};

const maxCartLines = 20;

function adminJson(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function stripeIsTestMode(env) {
  return typeof env.STRIPE_SECRET_KEY === 'string' && env.STRIPE_SECRET_KEY.startsWith('sk_test_');
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

function isAuthorised(request, env) {
  if (!env.ORDER_ADMIN_KEY || typeof env.ORDER_ADMIN_KEY !== 'string') return false;
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return false;
  return constantTimeEqual(header.slice(7), env.ORDER_ADMIN_KEY);
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

function readCartFromMetadata(metadata = {}) {
  const items = [];
  const lineCount = Number.parseInt(metadata.cart_line_count || '0', 10);

  if (Number.isInteger(lineCount) && lineCount > 0 && lineCount <= maxCartLines) {
    for (let index = 1; index <= lineCount; index += 1) {
      const paddedKey = `line_${String(index).padStart(2, '0')}`;
      const raw = metadata[paddedKey] ?? metadata[`line_${index}`];
      if (!raw) continue;

      try {
        const item = JSON.parse(raw);
        const product = productInfo[item?.product];
        const quantity = Number(item?.quantity);
        if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) continue;

        items.push({
          product: item.product,
          name: product.name,
          quantity,
          unitAmount: product.unitAmount,
          configuration: typeof item.configuration === 'string' ? item.configuration : null,
          colours: item.colours && typeof item.colours === 'object' ? item.colours : null,
        });
      } catch {
        // Ignore malformed metadata lines.
      }
    }
  }

  // Backwards compatibility with early single-item Checkout sessions.
  if (!items.length && metadata.product_key && productInfo[metadata.product_key]) {
    const product = productInfo[metadata.product_key];
    const quantity = Number.parseInt(metadata.quantity || '1', 10) || 1;
    const colours = metadata.lid
      ? {
          lid: metadata.lid,
          base: metadata.base,
          leftButton: metadata.left_button,
          rightButton: metadata.right_button,
        }
      : null;

    items.push({
      product: metadata.product_key,
      name: product.name,
      quantity,
      unitAmount: product.unitAmount,
      configuration: colours ? 'Custom mix' : null,
      colours,
    });
  }

  return items;
}

function shippingDetails(session) {
  return session.collected_information?.shipping_details
    || session.shipping_details
    || null;
}

function orderFromSession(session) {
  const metadata = session.metadata || {};
  const shipping = shippingDetails(session);
  const items = readCartFromMetadata(metadata);

  return {
    id: session.id,
    created: session.created,
    paymentStatus: session.payment_status,
    status: session.status,
    amountTotal: session.amount_total,
    currency: session.currency,
    customer: {
      name: session.customer_details?.name || shipping?.name || null,
      email: session.customer_details?.email || session.customer_email || null,
    },
    shipping: {
      service: metadata.shipping_service || null,
      amount: Number.parseInt(metadata.shipping_amount || '0', 10) || 0,
      name: shipping?.name || null,
      address: shipping?.address || session.customer_details?.address || null,
    },
    items,
    fulfilment: {
      status: metadata.fulfilment_status || 'pending',
      dispatchedAt: metadata.dispatched_at || null,
      trackingNumber: metadata.tracking_number || null,
    },
  };
}

async function stripeRequest(path, env, options = {}) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    console.error('Stripe admin request failed', response.status, data);
    throw new Error('Stripe request failed.');
  }

  return data;
}

async function listOrders(env) {
  const params = new URLSearchParams({
    limit: '100',
    status: 'complete',
  });
  const stripeData = await stripeRequest(`/v1/checkout/sessions?${params}`, env);

  const orders = (stripeData.data || [])
    .filter(session => session.payment_status === 'paid')
    .map(orderFromSession)
    .filter(order => order.items.length > 0);

  return adminJson({
    mode: 'test',
    count: orders.length,
    hasMore: Boolean(stripeData.has_more),
    orders,
  });
}

async function getCheckoutSession(sessionId, env) {
  if (!/^cs_test_[A-Za-z0-9_]+$/.test(sessionId)) {
    throw new Error('Invalid sandbox Checkout Session ID.');
  }
  return stripeRequest(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, env);
}

function dispatchEmailForSession(session, trackingNumber = '') {
  const metadata = session.metadata || {};
  const customerEmail = session.customer_details?.email || session.customer_email || '';
  if (!customerEmail) throw new Error('Order has no customer email address.');

  const customerName = String(session.customer_details?.name || shippingDetails(session)?.name || '').trim();
  const firstName = customerName ? customerName.split(/\s+/)[0] : '';
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
  const service = metadata.shipping_service || 'Royal Mail';
  const tracking = String(trackingNumber || '').trim();
  const tracked = /tracked/i.test(service);

  let htmlTracking = '';
  let textTracking = '';
  if (tracking) {
    htmlTracking = `<p style="font-size:16px;line-height:1.6;margin:18px 0 0">Your tracking number is <strong>${escapeHtml(tracking)}</strong>. You can check it on the <a href="https://www.royalmail.com/track-your-item" style="color:#1C211B;font-weight:700">Royal Mail tracking page</a>.</p>`;
    textTracking = `\n\nYour tracking number is ${tracking}.\nRoyal Mail tracking: https://www.royalmail.com/track-your-item`;
  } else if (tracked) {
    htmlTracking = '<p style="font-size:16px;line-height:1.6;margin:18px 0 0">It has been sent with a tracked Royal Mail service. If a tracking reference is available, I can send that over too.</p>';
    textTracking = '\n\nIt has been sent with a tracked Royal Mail service. If a tracking reference is available, I can send that over too.';
  }

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#F5F0E6;color:#1C211B;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:620px;margin:0 auto;padding:32px 20px">
    <div style="background:#ffffff;border:1px solid #ded8cc;border-radius:18px;padding:28px">
      <div style="font-size:24px;font-weight:800;margin-bottom:24px">NiceHatThanks</div>
      <p style="font-size:16px;line-height:1.6;margin:0 0 14px">${escapeHtml(greeting)}</p>
      <p style="font-size:16px;line-height:1.6;margin:0">Good news - your order is on its way!</p>
      <p style="font-size:16px;line-height:1.6;margin:18px 0 0">I've sent it with <strong>${escapeHtml(service)}</strong>.</p>
      ${htmlTracking}
      <p style="font-size:16px;line-height:1.6;margin:22px 0 0">If you haven't already, the <a href="https://nicehatthanks.com/setup/" style="color:#1C211B;font-weight:700">setup guide</a> will get you ready for when it arrives.</p>
      <p style="font-size:16px;line-height:1.6;margin:18px 0 0">Thanks again,<br><strong>Zach</strong></p>
    </div>
    <p style="margin:16px 4px 0;color:#666862;font-size:12px;line-height:1.5">Questions about your order? Reply to this email and it'll reach me at orders@nicehatthanks.com.</p>
  </div>
</body>
</html>`;

  const text = `${greeting}\n\nGood news - your order is on its way!\n\nI've sent it with ${service}.${textTracking}\n\nIf you haven't already, the setup guide will get you ready for when it arrives:\nhttps://nicehatthanks.com/setup/\n\nThanks again,\nZach\n\nQuestions about your order? Reply to this email and it'll reach me at orders@nicehatthanks.com.`;

  return {
    to: customerEmail,
    subject: 'Your NiceHatThanks order is on its way',
    html,
    text,
  };
}

async function sendDispatchEmail(session, trackingNumber, env) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured.');
  const email = dispatchEmailForSession(session, trackingNumber);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `dispatch-${session.id}`,
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
    console.error('Resend dispatch email failed', response.status, details);
    throw new Error('Unable to send dispatch email.');
  }
}

async function markDispatched(session, trackingNumber, env) {
  const params = new URLSearchParams();
  params.set('metadata[fulfilment_status]', 'dispatched');
  params.set('metadata[dispatched_at]', new Date().toISOString());
  if (trackingNumber) params.set('metadata[tracking_number]', trackingNumber);

  return stripeRequest(`/v1/checkout/sessions/${encodeURIComponent(session.id)}`, env, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
}

async function dispatchOrder(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return adminJson({ error: 'Invalid JSON request.' }, 400);
  }

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
  const trackingNumber = typeof body.trackingNumber === 'string'
    ? body.trackingNumber.trim().slice(0, 100)
    : '';

  let session;
  try {
    session = await getCheckoutSession(sessionId, env);
  } catch (error) {
    return adminJson({ error: error.message || 'Unable to load order.' }, 400);
  }

  if (session.payment_status !== 'paid' || session.status !== 'complete') {
    return adminJson({ error: 'Only completed paid orders can be dispatched.' }, 400);
  }

  const items = readCartFromMetadata(session.metadata || {});
  if (!items.length) {
    return adminJson({ error: 'This Checkout Session is not a recognised NiceHatThanks order.' }, 400);
  }

  if (session.metadata?.fulfilment_status === 'dispatched') {
    return adminJson({
      ok: true,
      alreadyDispatched: true,
      order: orderFromSession(session),
    });
  }

  try {
    await sendDispatchEmail(session, trackingNumber, env);
    const updatedSession = await markDispatched(session, trackingNumber, env);
    return adminJson({
      ok: true,
      email: 'sent',
      order: orderFromSession(updatedSession),
    });
  } catch (error) {
    console.error('Unable to dispatch order', sessionId, error);
    return adminJson({ error: error.message || 'Unable to dispatch order.' }, 502);
  }
}

export async function handleAdminRequest(request, env) {
  if (!stripeIsTestMode(env)) {
    return adminJson({ error: 'Order admin is locked to Stripe test mode.' }, 500);
  }

  if (!env.ORDER_ADMIN_KEY) {
    return adminJson({ error: 'Order admin is not configured.' }, 500);
  }

  if (!isAuthorised(request, env)) {
    return adminJson({ error: 'Unauthorised.' }, 401);
  }

  const url = new URL(request.url);

  if (url.pathname === '/api/admin/orders') {
    if (request.method !== 'GET') return adminJson({ error: 'Method not allowed.' }, 405);
    try {
      return await listOrders(env);
    } catch (error) {
      console.error('Unable to list orders', error);
      return adminJson({ error: 'Unable to load orders.' }, 502);
    }
  }

  if (url.pathname === '/api/admin/dispatch') {
    if (request.method !== 'POST') return adminJson({ error: 'Method not allowed.' }, 405);
    return dispatchOrder(request, env);
  }

  return adminJson({ error: 'Not found.' }, 404);
}
