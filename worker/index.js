const colourHex = {
  Strawberry: '#D789A6',
  Pistachio: '#7D947E',
  Vanilla: '#E9E1CF',
  Fudge: '#B77A4C',
  Ash: '#666862',
  Nero: '#242622',
  Bubblegum: '#A9C9DE',
  Violet: '#B9A8CE',
};

const products = {
  scoopy: {
    unitAmount: 1599,
    name: 'Scoopy',
    requiresColours: true,
    imagePath: '/images/radar-node-assembled.png',
    checkoutDescription: '32 × 44 × 16 mm · mmWave presence',
  },
  scoopy_compact: {
    unitAmount: 1249,
    name: 'Scoopy Compact',
    requiresColours: true,
    imagePath: '/images/node-assembled.png',
    checkoutDescription: '32 × 32 × 16 mm · no presence sensor',
  },
  pcba_mmwave: {
    unitAmount: 1149,
    name: 'Populated PCBA + mmWave',
    requiresColours: false,
    imagePath: '/images/radar-pcb.png',
    checkoutDescription: 'Populated ESP32-C3 PCBA with LD2410C mmWave presence sensor. Enclosure, USB cable and power supply not included.',
  },
  pcba: {
    unitAmount: 849,
    name: 'Populated PCBA',
    requiresColours: false,
    imagePath: '/images/seperate/pcb.png',
    checkoutDescription: 'Populated ESP32-C3 PCBA without a presence sensor. Enclosure, USB cable and power supply not included.',
  },
};

const previewLayers = {
  scoopy: {
    pcb: '/images/seperate/radar-pcb.png',
    base: '/images/seperate/radar-base.png',
    lid: '/images/seperate/radar-lid.png',
    lightPipes: '/images/seperate/radar-lightPipes.png',
    button1: '/images/seperate/radar-button1.png',
    button2: '/images/seperate/radar-button2.png',
  },
  scoopy_compact: {
    pcb: '/images/seperate/pcb.png',
    base: '/images/seperate/base.png',
    lid: '/images/seperate/lid-noLightPipes.PNG',
    lightPipes: '/images/seperate/lightPipes.png',
    button1: '/images/seperate/button1.png',
    button2: '/images/seperate/button2.png',
  },
};

const allowedColours = new Set(Object.keys(colourHex));

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

function checkoutLineName(item) {
  const product = products[item.product];
  if (!product.requiresColours) return product.name;
  return `${product.name} - ${item.configuration || 'Custom mix'}`;
}

function checkoutLineDescription(item) {
  const product = products[item.product];
  if (!product.requiresColours) return product.checkoutDescription;

  return `${product.checkoutDescription} · Lid: ${item.colours.lid} · Base: ${item.colours.base} · Left button: ${item.colours.leftButton} · Right button: ${item.colours.rightButton}`;
}

function previewUrl(item, origin) {
  const product = products[item.product];
  if (!product.requiresColours) {
    return new URL(product.imagePath, origin).href;
  }

  const url = new URL('/api/product-preview.svg', origin);
  url.searchParams.set('v', '5');
  url.searchParams.set('product', item.product);
  url.searchParams.set('lid', item.colours.lid);
  url.searchParams.set('base', item.colours.base);
  url.searchParams.set('leftButton', item.colours.leftButton);
  url.searchParams.set('rightButton', item.colours.rightButton);
  return url.href;
}

function colourMatrixFilter(id, colourName) {
  const hex = colourHex[colourName];
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);

  const redOffset = ((red - 108) / 255).toFixed(6);
  const greenOffset = ((green - 108) / 255).toFixed(6);
  const blueOffset = ((blue - 108) / 255).toFixed(6);

  return `<filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.153072 0.514944 0.051984 0 ${redOffset} 0.153072 0.514944 0.051984 0 ${greenOffset} 0.153072 0.514944 0.051984 0 ${blueOffset} 0 0 0 1 0"/></filter>`;
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function assetDataUrl(path, request, env) {
  const assetUrl = new URL(path, request.url);
  const assetRequest = new Request(assetUrl, { method: 'GET' });
  const response = env.ASSETS
    ? await env.ASSETS.fetch(assetRequest)
    : await fetch(assetRequest);

  if (!response.ok) {
    throw new Error(`Unable to load preview asset: ${path}`);
  }

  const contentType = response.headers.get('Content-Type') || 'image/png';
  const bytes = new Uint8Array(await response.arrayBuffer());
  return `data:${contentType};base64,${bytesToBase64(bytes)}`;
}

async function productPreviewSvg(request, env) {
  const url = new URL(request.url);
  const productKey = url.searchParams.get('product') || '';
  const layers = previewLayers[productKey];
  if (!layers) {
    return new Response('Unknown product', { status: 404 });
  }

  const colours = {
    lid: url.searchParams.get('lid') || '',
    base: url.searchParams.get('base') || '',
    leftButton: url.searchParams.get('leftButton') || '',
    rightButton: url.searchParams.get('rightButton') || '',
  };

  if (Object.values(colours).some(colour => !allowedColours.has(colour))) {
    return new Response('Invalid colours', { status: 400 });
  }

  let embedded;
  try {
    const entries = await Promise.all(
      Object.entries(layers).map(async ([key, path]) => [key, await assetDataUrl(path, request, env)]),
    );
    embedded = Object.fromEntries(entries);
  } catch (error) {
    console.error('Unable to build checkout preview', error);
    return new Response('Unable to build preview', { status: 502 });
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
  <defs>
    ${colourMatrixFilter('baseTint', colours.base)}
    ${colourMatrixFilter('lidTint', colours.lid)}
    ${colourMatrixFilter('leftTint', colours.leftButton)}
    ${colourMatrixFilter('rightTint', colours.rightButton)}
    <clipPath id="frame"><rect width="640" height="640" rx="42"/></clipPath>
  </defs>
  <rect width="640" height="640" rx="42" fill="#F5F0E6"/>
  <g clip-path="url(#frame)">
    <g transform="translate(320 320) scale(2.15) translate(-320 -320)">
      <image href="${embedded.pcb}" x="0" y="0" width="640" height="640" preserveAspectRatio="xMidYMid slice"/>
      <image href="${embedded.base}" x="0" y="0" width="640" height="640" preserveAspectRatio="xMidYMid slice" filter="url(#baseTint)"/>
      <image href="${embedded.lid}" x="0" y="0" width="640" height="640" preserveAspectRatio="xMidYMid slice" filter="url(#lidTint)"/>
      <image href="${embedded.button1}" x="0" y="0" width="640" height="640" preserveAspectRatio="xMidYMid slice" filter="url(#leftTint)"/>
      <image href="${embedded.button2}" x="0" y="0" width="640" height="640" preserveAspectRatio="xMidYMid slice" filter="url(#rightTint)"/>
      <image href="${embedded.lightPipes}" x="0" y="0" width="640" height="640" preserveAspectRatio="xMidYMid slice"/>
    </g>
  </g>
</svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function createCheckoutSession(request, env) {
  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: 'Stripe is not configured.' }, 500);
  }

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
    const product = products[item.product];
    const linePrefix = `line_items[${index}]`;
    params.set(`${linePrefix}[price_data][currency]`, 'gbp');
    params.set(`${linePrefix}[price_data][unit_amount]`, String(product.unitAmount));
    params.set(`${linePrefix}[price_data][product_data][name]`, checkoutLineName(item));
    params.set(`${linePrefix}[price_data][product_data][description]`, checkoutLineDescription(item));
    params.set(`${linePrefix}[price_data][product_data][images][0]`, previewUrl(item, origin));
    params.set(`${linePrefix}[quantity]`, String(item.quantity));
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
        // Ignore malformed metadata entries.
      }
    }
  }

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

    if (url.pathname === '/api/product-preview.svg') {
      if (request.method !== 'GET') {
        return new Response('Method not allowed', { status: 405 });
      }
      return productPreviewSvg(request, env);
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
