const realPreviewStyles = document.createElement('link');
realPreviewStyles.rel = 'stylesheet';
realPreviewStyles.href = 'css/shop-real.css?v=20260820-radar';
document.head.appendChild(realPreviewStyles);

document.querySelectorAll('.flavour-card .mini-device').forEach(placeholder => {
  const preview = document.createElement('canvas');
  preview.className = 'flavour-preview';
  preview.width = 260;
  preview.height = 260;
  preview.setAttribute('aria-hidden', 'true');
  placeholder.replaceWith(preview);
});

const canvas = document.getElementById('scoopyCanvas');
const selectedFlavour = document.getElementById('selectedFlavour');

const state = {
  lid: '#D789A6',
  base: '#E9E1CF',
  button1: '#E9E1CF',
  button2: '#E9E1CF'
};

const variants = {
  compact: {
    name: 'Scoopy Node',
    price: '£12.49',
    dimensions: '32 × 32 × 16 mm',
    description: 'The tiny two-button room node.'
  },
  presence: {
    name: 'Scoopy Node + Presence',
    price: '£15.99',
    dimensions: '32 × 44 × 16 mm',
    description: 'The same controls, with mmWave room presence built in.'
  }
};

let selectedVariant = 'compact';

const layerPaths = {
  compact: {
    base: 'images/seperate/base.png',
    pcb: 'images/seperate/pcb.png',
    lid: 'images/seperate/lid-noLightPipes.PNG',
    lightPipes: 'images/seperate/lightPipes.png',
    button1: 'images/seperate/button1.png',
    button2: 'images/seperate/button2.png'
  },
  presence: {
    base: 'images/radar-base.png',
    pcb: 'images/radar-pcb.png',
    lid: 'images/radar-lid.png',
    lightPipes: 'images/radar-lightPipes.png',
    button1: 'images/radar-button1.png',
    button2: 'images/radar-button2.png'
  }
};

const layerSets = {
  compact: { images: {}, sourceData: {}, bounds: null },
  presence: { images: {}, sourceData: {}, bounds: null }
};

const tintCache = new Map();

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

function loadImage(variant, key, src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const set = layerSets[variant];
      set.images[key] = image;

      const offscreen = document.createElement('canvas');
      offscreen.width = canvas.width;
      offscreen.height = canvas.height;
      const ctx = offscreen.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      set.sourceData[key] = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resolve();
    };
    image.onerror = reject;
    image.src = src;
  });
}

function calculateContentBounds(sourceData) {
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;

  Object.values(sourceData).forEach(source => {
    for (let y = 0; y < source.height; y += 2) {
      for (let x = 0; x < source.width; x += 2) {
        const alpha = source.data[(y * source.width + x) * 4 + 3];
        if (alpha > 10) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
  });

  if (maxX <= minX || maxY <= minY) {
    return { x: 0, y: 0, width: canvas.width, height: canvas.height };
  }

  const extraX = (maxX - minX) * 0.04;
  const extraY = (maxY - minY) * 0.04;
  const x = Math.max(0, minX - extraX);
  const y = Math.max(0, minY - extraY);
  const right = Math.min(canvas.width, maxX + extraX);
  const bottom = Math.min(canvas.height, maxY + extraY);

  return { x, y, width: right - x, height: bottom - y };
}

function tintLayer(variant, key, colour) {
  const cacheKey = `${variant}:${key}:${colour}`;
  if (tintCache.has(cacheKey)) return tintCache.get(cacheKey);

  const source = layerSets[variant].sourceData[key];
  const output = new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
  const target = hexToRgb(colour);

  let sum = 0;
  let count = 0;
  for (let i = 0; i < source.data.length; i += 4) {
    if (source.data[i + 3] > 8) {
      sum += 0.2126 * source.data[i] + 0.7152 * source.data[i + 1] + 0.0722 * source.data[i + 2];
      count += 1;
    }
  }
  const reference = count ? sum / count : 150;

  for (let i = 0; i < output.data.length; i += 4) {
    const alpha = source.data[i + 3];
    if (!alpha) continue;

    const lum = 0.2126 * source.data[i] + 0.7152 * source.data[i + 1] + 0.0722 * source.data[i + 2];
    const delta = (lum - reference) * 0.72;

    output.data[i] = Math.max(0, Math.min(255, target.r + delta));
    output.data[i + 1] = Math.max(0, Math.min(255, target.g + delta));
    output.data[i + 2] = Math.max(0, Math.min(255, target.b + delta));
    output.data[i + 3] = alpha;
  }

  const layer = document.createElement('canvas');
  layer.width = output.width;
  layer.height = output.height;
  layer.getContext('2d').putImageData(output, 0, 0);
  tintCache.set(cacheKey, layer);
  return layer;
}

function drawFitted(ctx, layer, bounds, width, height, padding = 0.18) {
  const availableWidth = width * (1 - padding * 2);
  const availableHeight = height * (1 - padding * 2);
  const scale = Math.min(availableWidth / bounds.width, availableHeight / bounds.height);
  const drawWidth = bounds.width * scale;
  const drawHeight = bounds.height * scale;
  const dx = (width - drawWidth) / 2;
  const dy = (height - drawHeight) / 2;

  ctx.drawImage(
    layer,
    bounds.x, bounds.y, bounds.width, bounds.height,
    dx, dy, drawWidth, drawHeight
  );
}

function renderComposite(targetCanvas, colours, variant = selectedVariant, padding = 0.18) {
  const set = layerSets[variant];
  if (!set.bounds) return;

  const ctx = targetCanvas.getContext('2d');
  ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);

  drawFitted(ctx, set.images.pcb, set.bounds, targetCanvas.width, targetCanvas.height, padding);
  drawFitted(ctx, tintLayer(variant, 'base', colours.base), set.bounds, targetCanvas.width, targetCanvas.height, padding);
  drawFitted(ctx, tintLayer(variant, 'lid', colours.lid), set.bounds, targetCanvas.width, targetCanvas.height, padding);
  drawFitted(ctx, tintLayer(variant, 'button1', colours.button1), set.bounds, targetCanvas.width, targetCanvas.height, padding);
  drawFitted(ctx, tintLayer(variant, 'button2', colours.button2), set.bounds, targetCanvas.width, targetCanvas.height, padding);
  drawFitted(ctx, set.images.lightPipes, set.bounds, targetCanvas.width, targetCanvas.height, padding);
}

function renderScoopy() {
  renderComposite(canvas, state, selectedVariant, 0.18);
}

function renderFlavourPreviews() {
  document.querySelectorAll('.flavour-card').forEach(card => {
    const preview = card.querySelector('.flavour-preview');
    if (!preview) return;
    renderComposite(preview, {
      lid: card.dataset.lid,
      base: card.dataset.base,
      button1: card.dataset.button1,
      button2: card.dataset.button2
    }, selectedVariant, 0.16);
  });
}

function applyState() {
  renderScoopy();
}

function selectSwatch(part, colour, name, button) {
  state[part] = colour;
  const row = button.closest('.swatch-row');
  row.querySelectorAll('.swatch').forEach(swatch => swatch.classList.remove('is-selected'));
  button.classList.add('is-selected');

  const label = document.getElementById(`${part}Name`);
  if (label) label.textContent = name;

  document.querySelectorAll('.flavour-card').forEach(card => card.classList.remove('is-selected'));
  selectedFlavour.textContent = 'Custom mix';
  applyState();
}

document.querySelectorAll('.swatch').forEach(button => {
  button.addEventListener('click', () => {
    const row = button.closest('.swatch-row');
    selectSwatch(row.dataset.part, button.dataset.colour, button.dataset.name, button);
  });
});

document.querySelectorAll('.flavour-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.flavour-card').forEach(item => item.classList.remove('is-selected'));
    card.classList.add('is-selected');

    ['lid', 'base', 'button1', 'button2'].forEach(part => {
      state[part] = card.dataset[part];
    });
    selectedFlavour.textContent = card.dataset.name;

    ['lid', 'base', 'button1', 'button2'].forEach(part => {
      const row = document.querySelector(`.swatch-row[data-part="${part}"]`);
      if (!row) return;
      row.querySelectorAll('.swatch').forEach(swatch => {
        const selected = swatch.dataset.colour.toLowerCase() === state[part].toLowerCase();
        swatch.classList.toggle('is-selected', selected);
        if (selected) {
          const label = document.getElementById(`${part}Name`);
          if (label) label.textContent = swatch.dataset.name;
        }
      });
    });

    applyState();
  });
});

function addVariantPicker() {
  const priceRow = document.querySelector('.price-row');
  if (!priceRow) return;

  const picker = document.createElement('section');
  picker.className = 'variant-picker';
  picker.setAttribute('aria-label', 'Choose Scoopy hardware');
  picker.innerHTML = `
    <div class="variant-heading"><h2>Choose your Scoopy</h2><span>Two sizes</span></div>
    <div class="variant-grid">
      <button type="button" class="variant-card is-selected" data-variant="compact">
        <span><strong>Node</strong><small>32 × 32 × 16 mm</small></span><b>£12.49</b>
      </button>
      <button type="button" class="variant-card" data-variant="presence">
        <span><strong>Node + Presence</strong><small>32 × 44 × 16 mm · mmWave</small></span><b>£15.99</b>
      </button>
    </div>
    <p class="variant-description">${variants.compact.description}</p>
  `;
  priceRow.insertAdjacentElement('afterend', picker);

  const summaryDimension = document.querySelector('.buy-summary > div span:first-child');
  const price = document.querySelector('.shop-price');

  picker.querySelectorAll('.variant-card').forEach(button => {
    button.addEventListener('click', () => {
      selectedVariant = button.dataset.variant;
      const variant = variants[selectedVariant];

      picker.querySelectorAll('.variant-card').forEach(item => {
        item.classList.toggle('is-selected', item === button);
      });

      price.textContent = variant.price;
      if (summaryDimension) summaryDimension.textContent = variant.dimensions;
      picker.querySelector('.variant-description').textContent = variant.description;

      renderScoopy();
      renderFlavourPreviews();
    });
  });
}

addVariantPicker();

const loadPromises = Object.entries(layerPaths).flatMap(([variant, paths]) =>
  Object.entries(paths).map(([key, src]) => loadImage(variant, key, src))
);

Promise.all(loadPromises)
  .then(() => {
    Object.keys(layerSets).forEach(variant => {
      layerSets[variant].bounds = calculateContentBounds(layerSets[variant].sourceData);
    });
    renderScoopy();
    renderFlavourPreviews();
  })
  .catch(error => console.error('Unable to load Scoopy preview layers', error));
