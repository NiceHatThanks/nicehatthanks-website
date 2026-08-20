const canvas = document.getElementById('scoopyCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
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
  lid: 'images/seperate/lid.png',
  button1: 'images/seperate/button1.png',
  button2: 'images/seperate/button2.png'
};

const images = {};
const sourceData = {};

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

function tintLayer(key, colour) {
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
  return layerCanvas;
}

function renderScoopy() {
  if (!sourceData.base || !sourceData.pcb || !sourceData.lid || !sourceData.button1 || !sourceData.button2) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const base = tintLayer('base', state.base);
  const lid = tintLayer('lid', state.lid);
  const button1 = tintLayer('button1', state.button1);
  const button2 = tintLayer('button2', state.button2);

  ctx.drawImage(base, 0, 0);
  ctx.drawImage(images.pcb, 0, 0, canvas.width, canvas.height);
  ctx.drawImage(lid, 0, 0);
  ctx.drawImage(button1, 0, 0);
  ctx.drawImage(button2, 0, 0);
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
  .then(renderScoopy)
  .catch(error => {
    console.error('Unable to load Scoopy preview layers', error);
  });
