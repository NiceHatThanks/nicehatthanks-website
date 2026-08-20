const realPreviewStyles = document.createElement('link');
realPreviewStyles.rel = 'stylesheet';
realPreviewStyles.href = 'css/shop-real.css?v=20260820-2';
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

const layerPaths = {
  base: 'images/seperate/base.png',
  pcb: 'images/seperate/pcb.png',
  lid: 'images/seperate/lid-noLightPipes.PNG',
  lightPipes: 'images/seperate/lightPipes.png',
  button1: 'images/seperate/button1.png',
  button2: 'images/seperate/button2.png'
};

const images = {};
const sourceData = {};
const tintCache = new Map();
let contentBounds = null;

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

function loadImage(key, src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      images[key] = image;
      const offscreen = document.createElement('canvas');
      offscreen.width = canvas.width;
      offscreen.height = canvas.height;
      const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
      offCtx.drawImage(image, 0, 0, canvas.width, canvas.height);
      sourceData[key] = offCtx.getImageData(0, 0, canvas.width, canvas.height);
      resolve();
    };
    image.onerror = reject;
    image.src = src;
  });
}

function calculateContentBounds() {
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

function tintLayer(key, colour) {
  const cacheKey = `${key}:${colour}`;
  if (tintCache.has(cacheKey)) return tintCache.get(cacheKey);

  const source = sourceData[key];
  const output = new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
  const target = hexToRgb(colour);

  let sum = 0;
  let count = 0;
  for (let i = 0; i < source.data.length; i += 4) {
    if (source.data[i + 3] > 8) {
      const lum = 0.2126 * source.data[i] + 0.7152 * source.data[i + 1] + 0.0722 * source.data[i + 2];
      sum += lum;
      count += 1;
    }
  }
  const reference = count ? sum / count : 150;

  for (let i = 0; i < output.data.length; i += 4) {
    const alpha = source.data[i + 3];
    if (alpha === 0) continue;

    const lum = 0.2126 * source.data[i] + 0.7152 * source.data[i + 1] + 0.0722 * source.data[i + 2];
    const delta = (lum - reference) * 0.72;

    output.data[i] = Math.max(0, Math.min(255, target.r + delta));
    output.data[i + 1] = Math.max(0, Math.min(255, target.g + delta));
    output.data[i + 2] = Math.max(0, Math.min(255, target.b + delta));
    output.data[i + 3] = alpha;
  }

  const layerCanvas = document.createElement('canvas');
  layerCanvas.width = output.width;
  layerCanvas.height = output.height;
  layerCanvas.getContext('2d').putImageData(output, 0, 0);
  tintCache.set(cacheKey, layerCanvas);
  return layerCanvas;
}

function drawFitted(targetCtx, layer, targetWidth, targetHeight, padding = 0.12) {
  const bounds = contentBounds;
  const availableWidth = targetWidth * (1 - padding * 2);
  const availableHeight = targetHeight * (1 - padding * 2);
  const scale = Math.min(availableWidth / bounds.width, availableHeight / bounds.height);
  const drawWidth = bounds.width * scale;
  const drawHeight = bounds.height * scale;
  const dx = (targetWidth - drawWidth) / 2;
  const dy = (targetHeight - drawHeight) / 2;

  targetCtx.drawImage(
    layer,
    bounds.x, bounds.y, bounds.width, bounds.height,
    dx, dy, drawWidth, drawHeight
  );
}

function renderComposite(targetCanvas, colours, padding = 0.12) {
  if (!contentBounds) return;
  const targetCtx = targetCanvas.getContext('2d');
  targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);

  // Bottom to top: base, PCB, buttons, lid, then light pipes.
  // Drawing the buttons before the lid means only the actuator tops show through
  // the lid holes; the locating tabs stay hidden inside the enclosure.
  drawFitted(targetCtx, tintLayer('base', colours.base), targetCanvas.width, targetCanvas.height, padding);
  drawFitted(targetCtx, images.pcb, targetCanvas.width, targetCanvas.height, padding);
  drawFitted(targetCtx, tintLayer('button1', colours.button1), targetCanvas.width, targetCanvas.height, padding);
  drawFitted(targetCtx, tintLayer('button2', colours.button2), targetCanvas.width, targetCanvas.height, padding);
  drawFitted(targetCtx, tintLayer('lid', colours.lid), targetCanvas.width, targetCanvas.height, padding);
  drawFitted(targetCtx, images.lightPipes, targetCanvas.width, targetCanvas.height, padding);
}

function renderScoopy() {
  if (!contentBounds) return;
  renderComposite(canvas, state, 0.11);
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
    }, 0.10);
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
    state.lid = card.dataset.lid;
    state.base = card.dataset.base;
    state.button1 = card.dataset.button1;
    state.button2 = card.dataset.button2;
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

Promise.all(Object.entries(layerPaths).map(([key, src]) => loadImage(key, src)))
  .then(() => {
    contentBounds = calculateContentBounds();
    renderScoopy();
    renderFlavourPreviews();
  })
  .catch(error => {
    console.error('Unable to load Scoopy preview layers', error);
  });
