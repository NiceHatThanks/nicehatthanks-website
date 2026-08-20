// Nice Hat Thanks homepage progressive enhancements.

const buttonVisual = document.querySelector('.feature-buttons');
if (buttonVisual) {
  buttonVisual.querySelectorAll('.feature-mark').forEach(mark => mark.remove());
  buttonVisual.insertAdjacentHTML('beforeend', `<div class="cad-highlight" aria-hidden="true"><img src="images/seperate/button1.png" alt=""><img src="images/seperate/button2.png" alt=""></div>`);
}
const ledVisual = document.querySelector('.feature-leds');
if (ledVisual) {
  ledVisual.querySelectorAll('.feature-mark').forEach(mark => mark.remove());
  ledVisual.insertAdjacentHTML('beforeend', `<div class="cad-highlight cad-highlight-leds" aria-hidden="true"><img src="images/seperate/lightPipes.png" alt=""></div><div class="led-colour-key"><span class="green"></span><span class="red"></span><span class="green"></span><small>green · red · green</small></div>`);
}
document.querySelectorAll('.presence-rings').forEach(ring => ring.remove());

const usesSection = document.getElementById('uses');
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
.hero-copy h1{font-size:clamp(2.7rem,5vw,5.15rem)!important;line-height:1!important;max-width:760px}.feature-visual{isolation:isolate}.feature-visual>img{position:relative;z-index:1}.cad-highlight{position:absolute;inset:0;z-index:2;pointer-events:none}.cad-highlight img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scale(1.58);filter:brightness(1.28) drop-shadow(0 0 5px rgba(245,240,230,.75))}.cad-highlight-leds img{filter:brightness(1.45) drop-shadow(0 0 6px rgba(245,240,230,.82))}.led-colour-key{position:absolute;right:12px;bottom:10px;z-index:3;display:flex;align-items:center;gap:5px;padding:6px 8px;border-radius:999px;background:rgba(28,33,27,.82);color:#f5f0e6}.led-colour-key span{width:7px;height:7px;border-radius:50%}.led-colour-key .green{background:#4fa85d}.led-colour-key .red{background:#c94c4c}.led-colour-key small{margin-left:3px;font-size:.62rem;color:rgba(245,240,230,.8)}
.story-section{display:grid;grid-template-columns:minmax(0,.72fr) minmax(0,1.28fr);gap:clamp(44px,8vw,120px);padding:120px 0 20px;align-items:start}.story-heading{position:sticky;top:110px}.story-heading h2{font-size:clamp(2.3rem,4.3vw,4.2rem)}.story-copy{max-width:720px}.story-copy>p{margin:0 0 22px;color:var(--muted);font-size:1.05rem;line-height:1.72}.story-copy>p:first-child{color:var(--text);font-size:1.2rem;font-weight:700}.story-open{margin:34px 0;padding:28px 30px;border:1px solid var(--border);border-radius:24px;background:var(--surface)}.story-open strong{display:block;margin-bottom:12px;font-size:1.25rem;letter-spacing:-.025em}.story-open p{margin:0;color:var(--muted);line-height:1.7}.story-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}
@media(max-width:800px){.story-section{grid-template-columns:1fr;gap:28px;padding-top:88px}.story-heading{position:static}.story-copy{max-width:none}}@media(max-width:640px){.hero-copy h1{font-size:clamp(2.55rem,12vw,3.75rem)!important}.story-open{padding:24px 22px}.story-actions .button{width:100%}}
`;
document.head.appendChild(style);
