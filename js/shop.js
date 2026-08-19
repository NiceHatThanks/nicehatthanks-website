const model = document.getElementById('scoopyModel');
const selectedFlavour = document.getElementById('selectedFlavour');

const state = {
  lid: '#D789A6',
  base: '#E9E1CF',
  button1: '#E9E1CF',
  button2: '#E9E1CF'
};

function applyState() {
  model.style.setProperty('--lid-colour', state.lid);
  model.style.setProperty('--base-colour', state.base);
  model.style.setProperty('--button-one-colour', state.button1);
  model.style.setProperty('--button-two-colour', state.button2);
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
    ['lid','base','button1','button2'].forEach(part => {
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

applyState();
