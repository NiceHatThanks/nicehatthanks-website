// Rebuild the homepage flow around the three things a new visitor needs first:
// what Scoopy is, that it is completely open source, and what it can do.
(function () {
  const main = document.querySelector('main');
  const hero = document.querySelector('.hero');
  const product = document.getElementById('product');
  const uses = document.getElementById('uses');
  const demo = document.getElementById('interactive-demo');
  const inside = document.getElementById('inside');
  const build = document.getElementById('build');
  const principles = document.querySelector('.principles');
  const closing = document.querySelector('.closing-card');
  const story = document.getElementById('story');
  if (!main || !hero || !product) return;

  const heroCopy = hero.querySelector('.hero-copy');
  if (heroCopy) {
    heroCopy.innerHTML = `
      <p class="eyebrow">SCOOPY NODE</p>
      <h1>A tiny, open-source Home Assistant node.</h1>
      <p class="intro">Two physical buttons, three status LEDs and optional mmWave presence sensing. USB-C powered, ESPHome based and designed to disappear around your home.</p>
      <div class="hero-facts" aria-label="Scoopy highlights"><span>Completely open source</span><span>Build your own</span><span>Or buy one</span></div>
      <div class="actions"><a class="button primary" href="https://github.com/NiceHatThanks/scoopy-node" target="_blank" rel="noreferrer">Build it on GitHub</a><a class="button primary" href="/shop.html">CBA to DIY?</a></div>`;
  }

  let open = document.getElementById('open-source');
  if (!open) {
    open = document.createElement('section');
    open.id = 'open-source';
    open.className = 'open-source-strip';
    open.innerHTML = `
      <div><p class="eyebrow">FREE & OPEN SOURCE</p><h2>Yours to build, change or just use.</h2></div>
      <div class="open-source-copy"><p>The PCB design, schematics, Gerbers, BOM, ESPHome configuration and documentation all live together on GitHub. The enclosure models are available on MakerWorld, so you can order the boards, print the case and build the same Scoopy yourself — or turn it into something completely different.</p><p><strong>If you'd rather not build one, you can just buy one from me.</strong></p><div class="open-links"><a href="https://github.com/NiceHatThanks/scoopy-node" target="_blank" rel="noreferrer">GitHub →</a><a href="https://makerworld.com" target="_blank" rel="noreferrer">MakerWorld →</a><a href="/shop.html">Buy one →</a></div></div>`;
    hero.after(open);
  }

  product.innerHTML = `
    <div class="capability-head">
      <div><p class="eyebrow">WHAT'S INSIDE</p><h2>Small hardware. Lots of options.</h2></div>
      <p>Use Scoopy as a pair of smart-home buttons, a glanceable status display, a presence sensor, or all three at once.</p>
    </div>
    <div class="capability-layout">
      <div class="capability-renders">
        <figure><img src="images/node-exploded.png" alt="Exploded Scoopy Node enclosure and electronics"><figcaption>Scoopy Node · 32 × 32 × 16 mm</figcaption></figure>
        <figure><img src="images/radar-node-exploded.png" alt="Exploded Scoopy Node with mmWave presence"><figcaption>Node + Presence · 32 × 44 × 16 mm</figcaption></figure>
      </div>
      <div class="capability-list">
        <details open><summary><span><strong>Two physical buttons</strong><small>Press · double-click · hold</small></span><b>+</b></summary><p>Trigger lights, fans, blinds, scenes or any Home Assistant automation. A hold can do something completely different from a tap.</p></details>
        <details><summary><span><strong>Three status LEDs</strong><small>Green · red · green</small></span><b>+</b></summary><p>Show whether a door is locked, an alarm is armed, a device is on, or simply leave one dimly lit so Scoopy is easy to find at night.</p></details>
        <details><summary><span><strong>Optional mmWave presence</strong><small>LD2410C · motion + still presence</small></span><b>+</b></summary><p>Make room automations react to occupancy, including someone sitting still at a desk. Useful for lighting that changes with presence and time of day.</p></details>
        <details><summary><span><strong>ESPHome + Home Assistant</strong><small>Local · Wi-Fi · configurable</small></span><b>+</b></summary><p>Everything is exposed through ESPHome, so the buttons, LEDs and presence sensor can become whatever your automations need. No cloud account required.</p></details>
        <details><summary><span><strong>Useful little extras</strong><small>USB-C · ESP32-C3 · I²C expansion</small></span><b>+</b></summary><p>Powered over USB-C with an ESP32-C3 at its core and an I²C connection available for future sensors and experiments.</p></details>
      </div>
    </div>
    <p class="small-line">Small enough to disappear. Useful enough to put everywhere.</p>`;

  if (uses) uses.remove();
  if (principles) principles.remove();
  if (build) build.remove();

  if (inside) {
    const copy = inside.querySelector('.inside-copy');
    if (copy) copy.innerHTML = `<p class="eyebrow">UNDER THE LID</p><h2>The hardware.</h2><p>ESP32-C3, USB-C power, tactile switches, three LEDs and I²C expansion — with the LD2410C added on the Presence version.</p><div class="inside-points"><span>ESP32-C3</span><span>USB-C</span><span>2 tactile switches</span><span>3 LEDs</span><span>I²C</span><span>Optional LD2410C</span></div>`;
  }

  if (closing) {
    closing.innerHTML = `<p class="eyebrow">YOUR CALL</p><h2>Build it or buy it.</h2><p>Everything you need to make your own is free and open source. If you just want a finished Scoopy, that's available too.</p><div class="actions"><a class="button primary" href="https://github.com/NiceHatThanks/scoopy-node" target="_blank" rel="noreferrer">GitHub</a><a class="button secondary" href="/shop.html">Shop</a></div>`;
  }

  const ordered = [hero, open, product, demo, story, inside, closing].filter(Boolean);
  ordered.forEach(el => main.appendChild(el));

  const nav = document.querySelector('.site-header nav');
  if (nav) nav.innerHTML = `<a href="#product">What it does</a><a href="#interactive-demo">Try it</a><a href="#story">Why</a><a href="https://github.com/NiceHatThanks/scoopy-node" target="_blank" rel="noreferrer">GitHub</a><a href="/shop.html">Shop</a>`;

  const style = document.createElement('style');
  style.textContent = `
    .hero{min-height:68vh;padding-top:72px;padding-bottom:82px}.hero-copy h1{font-size:clamp(2.65rem,5vw,5rem)!important;line-height:1.01!important;max-width:760px}.hero-copy .intro{max-width:650px;margin-top:24px}.hero-facts{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:24px;color:var(--muted);font-size:.82rem;font-weight:700}.hero-facts span:not(:last-child)::after{content:'·';margin-left:18px;color:var(--border)}
    .open-source-strip{display:grid;grid-template-columns:minmax(0,.82fr) minmax(0,1.18fr);gap:clamp(40px,7vw,100px);padding:68px clamp(28px,5vw,64px);margin-bottom:92px;border:1px solid var(--border);border-radius:30px;background:var(--surface)}.open-source-strip h2{font-size:clamp(2rem,3.5vw,3.35rem);line-height:1.04}.open-source-copy{max-width:690px}.open-source-copy p{margin:0 0 16px;color:var(--muted);line-height:1.68}.open-source-copy strong{color:var(--text)}.open-links{display:flex;flex-wrap:wrap;gap:22px;margin-top:28px}.open-links a{font-weight:750;text-decoration:none}
    #product.product-panel{padding:0;background:transparent;border-radius:0}.capability-head{display:grid;grid-template-columns:1fr .8fr;gap:50px;align-items:end;margin-bottom:46px}.capability-head h2{font-size:clamp(2rem,3.7vw,3.6rem)}.capability-head>p{max-width:560px;margin:0;color:var(--muted);font-size:1.03rem;line-height:1.65}.capability-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,.88fr);gap:clamp(30px,5vw,70px);align-items:start}.capability-renders{display:grid;grid-template-columns:1fr 1fr;gap:12px}.capability-renders figure{margin:0;overflow:hidden;border-radius:24px;background:var(--render-background)}.capability-renders img{width:100%;aspect-ratio:1/1;object-fit:cover;transform:scale(1.28)}.capability-renders figcaption{padding:13px 16px 15px;color:rgba(245,240,230,.72);font-size:.76rem;font-weight:650}.capability-list{border-top:1px solid var(--border)}.capability-list details{border-bottom:1px solid var(--border)}.capability-list summary{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:21px 2px;cursor:pointer;list-style:none}.capability-list summary::-webkit-details-marker{display:none}.capability-list summary span{display:flex;flex-direction:column;gap:5px}.capability-list summary strong{font-size:1.02rem}.capability-list summary small{color:var(--muted);font-size:.76rem}.capability-list summary b{font-size:1.25rem;font-weight:400;transition:transform .15s ease}.capability-list details[open] summary b{transform:rotate(45deg)}.capability-list details p{margin:-4px 38px 22px 2px;color:var(--muted);font-size:.92rem;line-height:1.62}.small-line{margin:28px 0 0;color:var(--muted);font-size:.88rem;font-weight:650}.inside-section{margin-top:100px}.closing-card{margin-top:100px}.closing-card .secondary{color:var(--background);border-color:rgba(245,240,230,.28)}
    @media(max-width:900px){.open-source-strip,.capability-head,.capability-layout{grid-template-columns:1fr}.capability-head{gap:16px}.capability-renders{max-width:680px}.open-source-strip{margin-bottom:72px}.hero-facts span::after{display:none}}
    @media(max-width:640px){.hero{padding-top:66px;padding-bottom:62px}.hero-copy h1{font-size:clamp(2.45rem,11vw,3.45rem)!important}.open-source-strip{padding:34px 24px;border-radius:24px;gap:24px}.capability-renders{gap:8px}.capability-renders figure{border-radius:18px}.capability-renders img{transform:scale(1.23)}.capability-renders figcaption{padding:10px 11px 12px;font-size:.68rem}.capability-list summary{padding:18px 0}.inside-section,.closing-card{margin-top:76px}}
  `;
  document.head.appendChild(style);
})();
