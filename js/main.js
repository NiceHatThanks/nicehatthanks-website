// Nice Hat Thanks homepage progressive enhancements.

// The feature cards should point at the real CAD geometry, not manually placed
// annotation dots. The exported component layers share the same camera/canvas as
// the assembled render, so stacking them keeps the highlights physically correct.
const buttonVisual = document.querySelector('.feature-buttons');
if (buttonVisual) {
  buttonVisual.querySelectorAll('.feature-mark').forEach(mark => mark.remove());
  buttonVisual.insertAdjacentHTML('beforeend', `
    <div class="cad-highlight cad-highlight-buttons" aria-hidden="true">
      <img src="images/seperate/button1.png" alt="">
      <img src="images/seperate/button2.png" alt="">
    </div>
  `);
}

const ledVisual = document.querySelector('.feature-leds');
if (ledVisual) {
  ledVisual.querySelectorAll('.feature-mark').forEach(mark => mark.remove());
  ledVisual.insertAdjacentHTML('beforeend', `
    <div class="cad-highlight cad-highlight-leds" aria-hidden="true">
      <img src="images/seperate/lightPipes.png" alt="">
    </div>
    <div class="led-colour-key" aria-label="LED colours">
      <span class="green"></span><span class="red"></span><span class="green"></span>
      <small>green · red · green</small>
    </div>
  `);
}

// Presence is already visible in the product geometry; avoid a decorative radar
// ring floating over an arbitrary part of the enclosure.
document.querySelectorAll('.presence-rings').forEach(ring => ring.remove());

const style = document.createElement('style');
style.textContent = `
  /* Keep the hero statement strong without taking over the whole viewport. */
  .hero-copy h1{
    font-size:clamp(2.7rem,5vw,5.15rem) !important;
    line-height:1 !important;
    max-width:760px;
  }

  .feature-visual{
    isolation:isolate;
  }

  .feature-visual > img{
    position:relative;
    z-index:1;
  }

  .cad-highlight{
    position:absolute;
    inset:0;
    z-index:2;
    pointer-events:none;
  }

  .cad-highlight img{
    position:absolute;
    inset:0;
    width:100%;
    height:100%;
    object-fit:cover;
    transform:scale(1.58);
    filter:brightness(1.28) drop-shadow(0 0 5px rgba(245,240,230,.75));
  }

  .cad-highlight-leds img{
    filter:brightness(1.45) drop-shadow(0 0 6px rgba(245,240,230,.82));
  }

  .led-colour-key{
    position:absolute;
    right:12px;
    bottom:10px;
    z-index:3;
    display:flex;
    align-items:center;
    gap:5px;
    padding:6px 8px;
    border-radius:999px;
    background:rgba(28,33,27,.82);
    color:#f5f0e6;
    backdrop-filter:blur(6px);
  }

  .led-colour-key span{
    width:7px;
    height:7px;
    border-radius:50%;
  }
  .led-colour-key .green{background:#4fa85d}
  .led-colour-key .red{background:#c94c4c}
  .led-colour-key small{margin-left:3px;font-size:.62rem;color:rgba(245,240,230,.8)}

  @media(max-width:640px){
    .hero-copy h1{font-size:clamp(2.55rem,12vw,3.75rem) !important}
    .cad-highlight img{transform:scale(1.58)}
  }
`;
document.head.appendChild(style);
