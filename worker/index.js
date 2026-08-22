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

const allowedConfigurations = new Set([
  'Strawberry',
  'Pistachio',
  'Vanilla',
  'Fudge',
  'Ash',
  'Nero',
  'Sprinkle',
  'Double Fudge',
  'Custom mix',
]);

// These are technical sanity limits, not a total-order cap.
// The order may contain many units across multiple configurations.
const maxLineQuantity = 99;
const maxCartLines = 20;

function json(data, status = 200) {
  return Response.json(data, { status });
}

function stripeIsTestMode(env) {
  return typeof env.STRIPE_SECRET_KEY === 'string' && env.STRIPE_SECRET_KEY.startsWith('sk_test_');
}

function addMetadata(params, metadata) {
  Object.entries(metadata).forEach(([key, value]) => {
    params.set(`metadata[${key}]`, String(value));
    params.set(`payment_intent_data[metadata][${key}]`, String(value));
  });
}

function normaliseCart(body) {
  const sourceItems = Array.isArray(body.items)
    ? body.items
    : [{
        product: body.product,
        quantity: body.quantity,
        colours: body.colours,
        configuration: body.configuration,
      }];

  if (sourceItems.length < 1 || sourceItems.length > maxCartLines) {
    throw new Error(`Cart must contain between 1 and ${maxCartLines} configurations.`);
  }

  let totalUnits = 0;
  const items = sourceItems.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Invalid cart item ${index + 1}.`);
    }

    const productKey = typeof item.product === 'string' ? item.product : '';
    const product = products[productKey];
    if (!product) {
      throw new Error(`Unknown product on cart item ${index + 1}.`);
    }

    const quantity = Number(item.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxLineQuantity) {
      throw new Error(`Quantity on cart item ${index + 1} must be a whole number from 1 to ${maxLineQuantity}.`);
    }

    totalUnits += quantity;

    const normalised = {
      product: productKey,
      priceId: product.priceId,
      quantity,
    };

    if (product.requiresColours) {
      const colours = item.colours ?? {};
      const selections = {
        lid: colours.lid,
        base: colours.base,
        leftButton: colours.leftButton,
        rightButton: colours.rightButton,
      };

      for (const [part, colour] of Object.entries(selections)) {
        if (typeof colour !== 'string' || !allowedColours.has(colour)) {
          throw new Error(`Invalid colour for ${part} on cart item ${index + 1}.`);
        }
      }

      const requestedConfiguration = typeof item.configuration === 'string' ? item.configuration : 'Custom mix';
      normalised.configuration = allowedConfigurations.has(requestedConfiguration)
        ? requestedConfiguration
        : 'Custom mix';
      normalised.colours = selections;
    }

    return normalised;
  });

  return { items, totalUnits };
}

function cartMetadata(cart) {
  const metadata = {
    cart_line_count: cart.items.length,
    cart_units: cart.totalUnits,
  };

  cart.items.forEach((item, index) => {
    const line = {
      product: item.product,
      quantity: item.quantity,
    };

    if (item.configuration) line.configuration = item.configuration;
    if (item.colours) line.colours = item.colours;

    const lineNumber = String(index + 1).padStart(2, '0');
    metadata[`line_${lineNumber}`] = JSON.stringify(line);
  });

  return metadata;
}

async function createCheckoutSession(request, env) {
  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: 'Stripe is not configured.' }, 500);
  }

  // This endpoint is intentionally sandbox-only while checkout is under development.
  if (!stripeIsTestMode(env)) {
    return json({ error: 'Checkout is locked to Stripe test mode.' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON request.' }, 400);
  }

  let cart;
  try {
    cart = normaliseCart(body);
  } catch (error) {
    return json({ error: error.message || 'Invalid cart.' }, 400);
  }

  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const params = new URLSearchParams();

  params.set('mode', 'payment');
  params.set('origin_context', 'web');
  cart.items.forEach((item, index) => {
    params.set(`line_items[${index}][price]`, item.priceId);
    params.set(`line_items[${index}][quantity]`, String(item.quantity));
  });
  params.set('shipping_address_collection[allowed_countries][0]', 'GB');
  params.set('success_url', `${origin}/shop.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${origin}/shop.html?checkoutTest=1&checkout=cancelled`);
  addMetadata(params, cartMetadata(cart));

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

function readCartFromMetadata(metadata = {}) {
  const lineCount = Number.parseInt(metadata.cart_line_count || '0', 10);
  const items = [];

  if (Number.isInteger(lineCount) && lineCount > 0 && lineCount <= maxCartLines) {
    for (let index = 1; index <= lineCount; index += 1) {
      const paddedKey = `line_${String(index).padStart(2, '0')}`;
      const raw = metadata[paddedKey] ?? metadata[`line_${index}`];
      if (!raw) continue;
      try {
        const item = JSON.parse(raw);
        if (item && typeof item === 'object') items.push(item);
      } catch {
        // Ignore malformed metadata entries; the payment status can still be verified.
      }
    }
  }

  // Backwards compatibility with the first single-item sandbox tests.
  if (!items.length && metadata.product_key) {
    const item = {
      product: metadata.product_key,
      quantity: Number.parseInt(metadata.quantity || '1', 10) || 1,
    };
    if (metadata.lid) {
      item.configuration = 'Custom mix';
      item.colours = {
        lid: metadata.lid,
        base: metadata.base,
        leftButton: metadata.left_button,
        rightButton: metadata.right_button,
      };
    }
    items.push(item);
  }

  return items;
}

async function getCheckoutSession(request, env) {
  if (!stripeIsTestMode(env)) {
    return json({ error: 'Checkout verification is locked to Stripe test mode.' }, 500);
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id') ?? '';
  if (!/^cs_test_[A-Za-z0-9_]+$/.test(sessionId)) {
    return json({ error: 'Invalid checkout session.' }, 400);
  }

  const stripeResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
    },
  });

  const stripeData = await stripeResponse.json();
  if (!stripeResponse.ok) {
    console.error('Stripe Checkout Session lookup failed', stripeData);
    return json({ error: 'Unable to verify checkout.' }, 502);
  }

  const cart = readCartFromMetadata(stripeData.metadata ?? {});
  const cartUnits = cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  return json({
    id: stripeData.id,
    paymentStatus: stripeData.payment_status,
    status: stripeData.status,
    customerEmail: stripeData.customer_details?.email ?? null,
    amountTotal: stripeData.amount_total,
    currency: stripeData.currency,
    metadata: stripeData.metadata ?? {},
    cart,
    cartUnits,
  });
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

    if (url.pathname === '/api/checkout-session') {
      if (request.method !== 'GET') {
        return json({ error: 'Method not allowed.' }, 405);
      }
      return getCheckoutSession(request, env);
    }

    return new Response('Not found', { status: 404 });
  },
};
