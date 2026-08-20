// Nice Hat Thanks homepage progressive enhancements.

// Keep the feature cards simple. The assembled product already shows the real
// buttons and light pipes clearly; decorative overlays made the cards too busy.
const buttonVisual = document.querySelector('.feature-buttons');
if (buttonVisual) {
  buttonVisual.querySelectorAll('.feature-mark, .cad-highlight').forEach(el => el.remove());
}

const ledVisual = document.querySelector('.feature-leds');
if (ledVisual) {
  ledVisual.querySelectorAll('.feature-mark, .cad-highlight, .led-colour-key').forEach(el => el.remove());
}

document.querySelectorAll('.presence-rings').forEach(ring => ring.remove());

// -----------------------------------------------------------------------------
// Interactive Scoopy demo
// -----------------------------------------------------------------------------
const productSection = document.getElementById('product');
const usesSection = document.getElementById('uses');

if (productSection && usesSection && !document.getElementById('interactive-demo')) {
  const demo = document.createElement('section');
  demo.id = 'interactive-demo';
  demo.className = 'interactive-demo';
  demo.innerHTML = `
    <div class="demo-heading">
      <p class="eyebrow">TRY IT</p>
      <h2>Go on. Press it.</h2>
      <p>Move your mouse towards Scoopy to trigger presence, then press the real buttons.</p>
    </div>
    <div class="demo-room is-light-on">
      <div class="demo-lamp" aria-hidden="true">
        <span class="lamp-cord"></span>
        <span class="lamp-shade"></span>
        <span class="lamp-bulb"></span>
        <span class="lamp-light"></span>
      </div>
      <div class="demo-readout" aria-live="polite">
        <span class="demo-presence-dot"></span>
        <span class="demo-presence-text">Move closer to detect presence</span>
      </div>
      <div class="demo-device-wrap">
        <canvas class="demo-device" width="900" height="900" tabindex="0" role="button" aria-label="Interactive Scoopy. Press the upper button to toggle the light. Press the lower button to pulse a status LED."></canvas>
        <span class="demo-hint">Button 1 · light &nbsp;&nbsp; Button 2 · status</span>
      </div>
      <div class="demo-event" aria-live="polite">Light on</div>
    </div>
  `;
  productSection.insertAdjacentElement('afterend', demo);

  const room = demo.querySelector('.demo-room');
  const canvas = demo.querySelector('.demo-device');
  const eventLabel = demo.querySelector('.demo-event');
  const presenceText = demo.querySelector('.demo-presence-text');
  const ctx = canvas.getContext('2d');

  const assetBase = 'images/interactive-demo/';
  const assetPaths = {
    base: 'base.png',
    pcb: 'pcb.png',
    lid: 'lid.png',
    buttonUp: 'buttonUp.png',
    buttonDown: 'buttonDown.png',
    ledLeft: 'lp-left.png',
    ledMid: 'lp-mid.png',
    ledRight: 'lp-right.png'
  };

  const images = {};
  const masks = {};
  let sourceWidth = 1200;
  let sourceHeight = 1200;
  let bounds = { x: 0, y: 0, width: 1200, height: 1200 };
  let lightOn = true;
  let presence = false;
  let clearPresenceTimer = null;
  let pressedButton = null;
  let pulse = null;
  let animationFrame = null;

  function loadDemoImage(key, filename) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        images[key] = image;
        sourceWidth = image.naturalWidth;
        sourceHeight = image.naturalHeight;

        const mask = document.createElement('canvas');
        mask.width = sourceWidth;
        mask.height = sourceHeight;
        const maskCtx = mask.getContext('2d', { willReadFrequently: true });
        maskCtx.drawImage(image, 0, 0);
        masks[key] = maskCtx;
        resolve();
      };
      image.onerror = reject;
      image.src = assetBase + filename + '?v=20260820-demo1';
    });
  }

  function calculateBounds() {
    const keys = ['base', 'pcb', 'lid', 'buttonUp', 'buttonDown'];
    let minX = sourceWidth;
    let minY = sourceHeight;
    let maxX = -1;
    let maxY = -1;

    keys.forEach(key => {
      const data = masks[key].getImageData(0, 0, sourceWidth, sourceHeight).data;
      for (let y = 0; y < sourceHeight; y += 3) {
        for (let x = 0; x < sourceWidth; x += 3) {
          if (data[(y * sourceWidth + x) * 4 + 3] > 12) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }
    });

    if (maxX < minX || maxY < minY) return;
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const marginX = width * 0.12;
    const marginY = height * 0.12;
    const x = Math.max(0, minX - marginX);
    const y = Math.max(0, minY - marginY);
    const right = Math.min(sourceWidth, maxX + marginX);
    const bottom = Math.min(sourceHeight, maxY + marginY);
    bounds = { x, y, width: right - x, height: bottom - y };
  }

  function drawLayer(image, offsetY = 0, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(
      image,
      bounds.x, bounds.y, bounds.width, bounds.height,
      0, offsetY, canvas.width, canvas.height
    );
    ctx.restore();
  }

  function makeTintedLayer(key, colour) {
    const source = images[key];
    const layer = document.createElement('canvas');
    layer.width = sourceWidth;
    layer.height = sourceHeight;
    const layerCtx = layer.getContext('2d');
    layerCtx.drawImage(source, 0, 0);
    layerCtx.globalCompositeOperation = 'source-in';
    layerCtx.fillStyle = colour;
    layerCtx.fillRect(0, 0, layer.width, layer.height);
    return layer;
  }

  const tinted = {};

  function drawGlowingLed(key, colour, intensity) {
    if (!tinted[key]) tinted[key] = makeTintedLayer(key, colour);
    const glow = tinted[key];
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, intensity));
    ctx.shadowColor = colour;
    ctx.shadowBlur = 18 + intensity * 22;
    ctx.drawImage(
      glow,
      bounds.x, bounds.y, bounds.width, bounds.height,
      0, 0, canvas.width, canvas.height
    );
    ctx.restore();
  }

  function renderDevice(now = performance.now()) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawLayer(images.pcb);
    drawLayer(images.base);
    drawLayer(images.lid);
    drawLayer(images.buttonUp, pressedButton === 'buttonUp' ? 4 : 0);
    drawLayer(images.buttonDown, pressedButton === 'buttonDown' ? 4 : 0);

    // Keep the physical light pipes visible when they are not illuminated.
    drawLayer(images.ledLeft, 0, 0.48);
    drawLayer(images.ledMid, 0, 0.48);
    drawLayer(images.ledRight, 0, 0.48);

    if (presence) drawGlowingLed('ledRight', '#63df75', 0.48);

    if (pulse) {
      const elapsed = now - pulse.startedAt;
      const duration = 760;
      if (elapsed >= duration) {
        pulse = null;
      } else {
        const progress = elapsed / duration;
        const level = Math.sin(progress * Math.PI) * 0.95;
        drawGlowingLed(pulse.key, pulse.colour, level);
      }
    }

    if (pulse) {
      animationFrame = requestAnimationFrame(renderDevice);
    } else {
      animationFrame = null;
    }
  }

  function startPulse(key, colour) {
    pulse = { key, colour, startedAt: performance.now() };
    if (!animationFrame) animationFrame = requestAnimationFrame(renderDevice);
  }

  function setEvent(message) {
    eventLabel.textContent = message;
    eventLabel.classList.remove('is-fresh');
    requestAnimationFrame(() => eventLabel.classList.add('is-fresh'));
  }

  function toggleLight() {
    lightOn = !lightOn;
    room.classList.toggle('is-light-on', lightOn);
    setEvent(lightOn ? 'Light on' : 'Light off');
    startPulse('ledLeft', '#63df75');
  }

  function pulseStatus() {
    setEvent('Status acknowledged');
    startPulse('ledMid', '#ef5a52');
  }

  function sourcePointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    const displayX = (event.clientX - rect.left) / rect.width;
    const displayY = (event.clientY - rect.top) / rect.height;
    return {
      x: Math.round(bounds.x + displayX * bounds.width),
      y: Math.round(bounds.y + displayY * bounds.height)
    };
  }

  function alphaAt(key, point) {
    if (!masks[key]) return 0;
    if (point.x < 0 || point.x >= sourceWidth || point.y < 0 || point.y >= sourceHeight) return 0;
    return masks[key].getImageData(point.x, point.y, 1, 1).data[3];
  }

  function buttonAtEvent(event) {
    const point = sourcePointFromEvent(event);
    if (alphaAt('buttonUp', point) > 24) return 'buttonUp';
    if (alphaAt('buttonDown', point) > 24) return 'buttonDown';
    return null;
  }

  function setPresence(nextPresence, distance = null) {
    if (clearPresenceTimer) {
      clearTimeout(clearPresenceTimer);
      clearPresenceTimer = null;
    }

    if (nextPresence) {
      const changed = !presence;
      presence = true;
      room.classList.add('has-presence');
      presenceText.textContent = distance === null ? 'Presence detected' : `Presence detected · ${Math.round(distance)} px`;
      if (changed) renderDevice();
      return;
    }

    clearPresenceTimer = setTimeout(() => {
      presence = false;
      room.classList.remove('has-presence');
      presenceText.textContent = distance === null ? 'Move closer to detect presence' : `${Math.round(distance)} px away`;
      renderDevice();
    }, 1500);
  }

  function updateMousePresence(event) {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    const rect = canvas.getBoundingClientRect();
    const centreX = rect.left + rect.width / 2;
    const centreY = rect.top + rect.height * 0.58;
    const distance = Math.hypot(event.clientX - centreX, event.clientY - centreY);
    const threshold = window.innerWidth > 980 ? 220 : 150;

    if (distance <= threshold) {
      setPresence(true, distance);
    } else {
      if (!presence) presenceText.textContent = `${Math.round(distance)} px away`;
      setPresence(false, distance);
    }
  }

  room.addEventListener('pointermove', updateMousePresence);
  room.addEventListener('pointerleave', () => setPresence(false));

  canvas.addEventListener('pointerdown', event => {
    const hit = buttonAtEvent(event);
    if (hit) {
      pressedButton = hit;
      canvas.setPointerCapture?.(event.pointerId);
      renderDevice();
      event.preventDefault();
    }
  });

  canvas.addEventListener('pointerup', event => {
    const releasedOver = buttonAtEvent(event);
    const pressed = pressedButton;
    pressedButton = null;
    renderDevice();

    if (pressed && releasedOver === pressed) {
      if (pressed === 'buttonUp') toggleLight();
      else pulseStatus();
      event.preventDefault();
      return;
    }

    // On touch devices, tapping the body simulates presence because there is no cursor.
    if (event.pointerType !== 'mouse') {
      setPresence(!presence);
    }
  });

  canvas.addEventListener('pointermove', event => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    canvas.classList.toggle('over-button', Boolean(buttonAtEvent(event)));
  });

  canvas.addEventListener('keydown', event => {
    if (event.key === '1' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleLight();
    } else if (event.key === '2') {
      event.preventDefault();
      pulseStatus();
    }
  });

  Promise.all(Object.entries(assetPaths).map(([key, filename]) => loadDemoImage(key, filename)))
    .then(() => {
      calculateBounds();
      renderDevice();
      room.classList.add('is-ready');
    })
    .catch(error => {
      console.error('Unable to load interactive Scoopy demo', error);
      eventLabel.textContent = 'Demo unavailable';
    });
}

// -----------------------------------------------------------------------------
// Maker story
// -----------------------------------------------------------------------------
const insideSection = document.getElementById('inside');
if (usesSection && insideSection && !document.getElementById('story')) {
  const story = document.createElement('section');
  story.id = 'story';
  story.className = 'story-section';
  story.innerHTML = `
    <div class="story-heading"><p class="eyebrow">WHY I BUILT SCOOPY</p><h2>One little node for all the little jobs.</h2></div>
    <div class="story-copy">
      <p>Hi, I’m Zach. I’m an electronics engineer, hobbyist and serial smart-home tinkerer.</p>
      <p>Since setting up Home Assistant, I’ve ended up with about five different DIY buttons dotted around the house — plus a growing collection of Hue remotes whose batteries I’m fed up with changing. My office alone has radar-controlled lighting that changes depending on the time of day, a Pi Pico button hidden under the desk for a fan buried in a Kallax, and a Hue button stuck magnetically to a desk leg.</p>
      <p>It all works — but I wanted something I could standardise and use in every corner of the house.</p>
      <p>So I built Scoopy: one small, USB-powered device for physical controls, status LEDs and optional presence sensing that I can use everywhere. Somewhere during the design it started looking a bit like an ice cream, and the name and colours followed.</p>
      <div class="story-open"><strong>And absolutely everything is open source.</strong><p>The PCB design, schematics, Gerbers, BOM, ESPHome configuration and documentation all live together on GitHub. The enclosure models are available on MakerWorld, so you can order your own boards, print the case and build exactly the same thing yourself — or modify it into something completely different.</p><div class="story-actions"><a class="button primary" href="https://github.com/NiceHatThanks/scoopy-node" target="_blank" rel="noreferrer">Build it yourself →</a><a class="button secondary" href="/shop.html">Or just buy one</a></div></div>
      <p>This is only the first Node, too. Next on my list is probably a rotary-encoder version for the bedside table, for controlling the lights and ceiling projector without hunting for a remote.</p>
    </div>`;
  insideSection.parentNode.insertBefore(story, insideSection);
}

const style = document.createElement('style');
style.textContent = `
.hero-copy h1{font-size:clamp(2.7rem,5vw,5.15rem)!important;line-height:1!important;max-width:760px}

/* Product feature cards: clean product photography, no floating callouts. */
.feature-visual{height:190px;background:#1c211b;overflow:hidden}
.feature-visual>img{width:100%;height:100%;object-fit:cover;object-position:center;transform:scale(1.34)!important}
.feature-visual.feature-leds>img{transform:scale(1.42)!important}
.feature-visual.presence>img{transform:scale(1.3)!important}
.feature-copy{border-top:1px solid rgba(255,255,255,.06)}

/* Interactive room demo */
.interactive-demo{padding:120px 0 20px}
.demo-heading{max-width:760px;margin-bottom:46px}
.demo-heading>p:not(.eyebrow){max-width:620px;margin:24px 0 0;color:var(--muted);font-size:1.05rem;line-height:1.65}
.demo-room{position:relative;min-height:660px;overflow:hidden;border-radius:34px;background:#171a17;color:#f5f0e6;transition:background .55s ease,box-shadow .55s ease;isolation:isolate}
.demo-room:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 38%,rgba(250,220,150,0) 0 12%,rgba(250,220,150,0) 44%);transition:background .55s ease;pointer-events:none}
.demo-room.is-light-on{background:#3c3a30;box-shadow:inset 0 0 110px rgba(248,220,158,.08)}
.demo-room.is-light-on:before{background:radial-gradient(ellipse at 50% 26%,rgba(255,226,163,.28) 0,rgba(255,226,163,.11) 30%,rgba(255,226,163,0) 65%)}
.demo-lamp{position:absolute;left:50%;top:0;width:180px;height:280px;transform:translateX(-50%);z-index:1;pointer-events:none}
.lamp-cord{position:absolute;left:50%;top:0;width:2px;height:80px;background:rgba(245,240,230,.5)}
.lamp-shade{position:absolute;left:50%;top:72px;width:88px;height:44px;transform:translateX(-50%);background:#d9d2c3;clip-path:polygon(25% 0,75% 0,100% 100%,0 100%);border-radius:7px 7px 15px 15px}
.lamp-bulb{position:absolute;left:50%;top:105px;width:20px;height:20px;transform:translateX(-50%);border-radius:50%;background:#4c4b43;transition:background .3s ease,box-shadow .3s ease}
.lamp-light{position:absolute;left:50%;top:116px;width:320px;height:430px;transform:translateX(-50%);clip-path:polygon(43% 0,57% 0,100% 100%,0 100%);background:linear-gradient(to bottom,rgba(255,230,172,0),rgba(255,230,172,0));transition:background .5s ease;filter:blur(8px)}
.is-light-on .lamp-bulb{background:#fff2bb;box-shadow:0 0 16px rgba(255,235,177,.95),0 0 42px rgba(255,219,135,.62)}
.is-light-on .lamp-light{background:linear-gradient(to bottom,rgba(255,230,172,.2),rgba(255,230,172,.055) 58%,rgba(255,230,172,0))}
.demo-readout{position:absolute;top:28px;left:30px;z-index:5;display:flex;align-items:center;gap:9px;padding:9px 12px;border:1px solid rgba(245,240,230,.13);border-radius:999px;background:rgba(20,23,20,.42);color:rgba(245,240,230,.64);font-size:.78rem;font-weight:650;backdrop-filter:blur(8px)}
.demo-presence-dot{width:7px;height:7px;border-radius:50%;background:#73776f;transition:background .2s ease,box-shadow .2s ease}
.has-presence .demo-readout{color:rgba(245,240,230,.9)}
.has-presence .demo-presence-dot{background:#63df75;box-shadow:0 0 9px rgba(99,223,117,.72)}
.demo-device-wrap{position:absolute;left:50%;bottom:44px;width:min(540px,70%);aspect-ratio:1/1;transform:translateX(-50%);z-index:3}
.demo-device{display:block;width:100%;height:100%;outline:none;cursor:default;touch-action:manipulation}
.demo-device.over-button{cursor:pointer}
.demo-device:focus-visible{outline:2px solid rgba(245,240,230,.8);outline-offset:4px;border-radius:24px}
.demo-hint{position:absolute;left:50%;bottom:6px;transform:translateX(-50%);white-space:nowrap;color:rgba(245,240,230,.5);font-size:.7rem;font-weight:650;letter-spacing:.025em;pointer-events:none}
.demo-event{position:absolute;right:28px;bottom:28px;z-index:5;padding:8px 11px;border-radius:999px;background:rgba(20,23,20,.48);color:rgba(245,240,230,.72);font-size:.75rem;font-weight:700;backdrop-filter:blur(8px)}
.demo-event.is-fresh{animation:demoEvent .55s ease}
@keyframes demoEvent{0%{transform:translateY(3px);opacity:.45}100%{transform:translateY(0);opacity:1}}

.story-section{display:grid;grid-template-columns:minmax(0,.72fr) minmax(0,1.28fr);gap:clamp(44px,8vw,120px);padding:120px 0 20px;align-items:start}.story-heading{position:sticky;top:110px}.story-heading h2{font-size:clamp(2.3rem,4.3vw,4.2rem)}.story-copy{max-width:720px}.story-copy>p{margin:0 0 22px;color:var(--muted);font-size:1.05rem;line-height:1.72}.story-copy>p:first-child{color:var(--text);font-size:1.2rem;font-weight:700}.story-open{margin:34px 0;padding:28px 30px;border:1px solid var(--border);border-radius:24px;background:var(--surface)}.story-open strong{display:block;margin-bottom:12px;font-size:1.25rem;letter-spacing:-.025em}.story-open p{margin:0;color:var(--muted);line-height:1.7}.story-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}

@media(max-width:800px){.story-section{grid-template-columns:1fr;gap:28px;padding-top:88px}.story-heading{position:static}.story-copy{max-width:none}.demo-room{min-height:570px}.demo-device-wrap{width:min(500px,84%);bottom:34px}}
@media(max-width:640px){.hero-copy h1{font-size:clamp(2.55rem,12vw,3.75rem)!important}.feature-visual{height:190px}.feature-visual>img{transform:scale(1.3)!important}.feature-visual.feature-leds>img{transform:scale(1.38)!important}.feature-visual.presence>img{transform:scale(1.26)!important}.interactive-demo{padding-top:88px}.demo-heading{margin-bottom:32px}.demo-room{min-height:490px;border-radius:26px}.demo-lamp{transform:translateX(-50%) scale(.78);transform-origin:top center}.demo-readout{top:18px;left:18px;max-width:calc(100% - 36px);font-size:.7rem}.demo-device-wrap{width:96%;bottom:20px}.demo-hint{bottom:2px;font-size:.63rem}.demo-event{right:16px;bottom:16px;font-size:.68rem}.story-open{padding:24px 22px}.story-actions .button{width:100%}}
@media(prefers-reduced-motion:reduce){.demo-room,.lamp-bulb,.lamp-light,.demo-event{transition:none!important;animation:none!important}}
`;
document.head.appendChild(style);
