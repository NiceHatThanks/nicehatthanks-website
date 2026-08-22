const products = {
  scoopy: {
    priceId: 'price_1U7EVuDVcpaCmGAbAPcI9M0J',
    requiresColours: true,
  },
  scoopy_compact: {
    priceId: 'price_1U7EfjDVcpaCmGAbpKOiwC9e',
    requiresColours: true,
  },
  pcba_mmwave: {
    priceId: 'price_1U7EgcDVcpaCmGAbrJ3iSMwd',
    requiresColours: false,
  },
  pcba: {
    priceId: 'price_1U7EhaDVcpaCmGAbzCSWdFWT',
    requiresColours: false,
  },
};

const allowedColours = new Set([
  'Strawberry',
  'Pistachio',
  'Vanilla',
  'Fudge',
  'Ash',
  'Nero',
  'Bubblegum',
  'Violet',
]);

function json(data, status = 200) {
  return Response.json(data, { status });
}

function addMetadata(params, metadata) {
  Object.entries(metadata).forEach(([key, value]) => {
    params.set(`metadata[${key}]`, String(value));
    params.set(`payment_intent_data[metadata][${key}]`, String(value));
  });
}

async function createCheckoutSession(request, env) {
  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: 'Stripe is not configured.' }, 500);
  }

  // This endpoint is intentionally sandbox-only while checkout is under development.
  if (!env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
    return json({ error: 'Checkout is locked to Stripe test mode.' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON request.' }, 400);
  }

  const productKey = typeof body.product === 'string' ? body.product : '';
  const product = products[productKey];
  if (!product) {
    return json({ error: 'Unknown product.' }, 400);
  }

  const quantity = Number(body.quantity ?? 1);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    return json({ error: 'Quantity must be a whole number from 1 to 10.' }, 400);
  }

  const metadata = {
    product_key: productKey,
    quantity,
  };

  if (product.requiresColours) {
    const colours = body.colours ?? {};
    const selections = {
      lid: colours.lid,
      base: colours.base,
      left_button: colours.leftButton,
      right_button: colours.rightButton,
    };

    for (const [part, colour] of Object.entries(selections)) {
      if (typeof colour !== 'string' || !allowedColours.has(colour)) {
        return json({ error: `Invalid colour for ${part}.` }, 400);
      }
      metadata[part] = colour;
    }
  }

  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const params = new URLSearchParams();

  params.set('mode', 'payment');
  params.set('origin_context', 'web');
  params.set('line_items[0][price]', product.priceId);
  params.set('line_items[0][quantity]', String(quantity));
  params.set('shipping_address_collection[allowed_countries][0]', 'GB');
  params.set('success_url', `${origin}/shop.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${origin}/shop.html?checkoutTest=1&checkout=cancelled`);
  addMetadata(params, metadata);

  const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  const stripeData = await stripeResponse.json();
  if (!stripeResponse.ok) {
    console.error('Stripe Checkout Session creation failed', stripeData);
    return json({ error: 'Unable to start checkout.' }, 502);
  }

  return json({ id: stripeData.id, url: stripeData.url });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'nicehatthanks-checkout', mode: 'test' });
    }

    if (url.pathname === '/api/checkout') {
      if (request.method !== 'POST') {
        return json({ error: 'Method not allowed.' }, 405);
      }
      return createCheckoutSession(request, env);
    }

    return new Response('Not found', { status: 404 });
  },
};
