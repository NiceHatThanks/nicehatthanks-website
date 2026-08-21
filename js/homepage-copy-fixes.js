// Final homepage copy/layout cleanup applied after the main homepage flow.
(function () {
  // Licensing belongs at the bottom, not near the top of the page.
  const buildStrip = document.getElementById('open-source');
  if (buildStrip) buildStrip.remove();

  // Keep Scoopy as the mmWave model and Compact as the smaller no-presence version.
  const figures = document.querySelectorAll('.capability-renders figure');
  if (figures.length >= 2) {
    figures[0].innerHTML = '<img src="images/radar-node-exploded.png" alt="Exploded Scoopy Node with mmWave presence"><figcaption>Scoopy Node · 32 × 44 × 16 mm · mmWave</figcaption>';
    figures[1].innerHTML = '<img src="images/node-exploded.png" alt="Exploded Scoopy Compact enclosure and electronics"><figcaption>Scoopy Compact · 32 × 32 × 16 mm</figcaption>';
  }

  // Update the maker story so presence is part of Scoopy rather than an optional extra.
  const story = document.getElementById('story');
  if (story) {
    story.querySelectorAll('p').forEach(p => {
      if (p.textContent.includes('status LEDs and optional presence sensing')) {
        p.textContent = 'So I built Scoopy: one small, USB-powered device for physical controls, status LEDs and presence sensing that I can use everywhere. Somewhere during the design it started looking a bit like an ice cream, and the name and colours followed.';
      }
    });

    const storyOpen = story.querySelector('.story-open');
    if (storyOpen) {
      const strong = storyOpen.querySelector('strong');
      if (strong) strong.textContent = 'Hack it.';
      const copy = storyOpen.querySelector('p');
      if (copy) copy.textContent = 'The PCB design, Gerbers, BOM, ESPHome configuration, documentation and printable enclosure files are available so you can build your own Scoopy, understand how it works or turn it into something different.';
    }
  }

  // The exploded views already explain the hardware better than this section does.
  const inside = document.getElementById('inside');
  if (inside) inside.remove();

  // Put the source-available and commercial-use wording at the very bottom.
  const closing = document.querySelector('.closing-card');
  if (closing) {
    closing.innerHTML = `
      <p class="eyebrow">YOUR CALL</p>
      <h2>Build it your way.</h2>
      <p>Build Scoopy for yourself, change it, or adapt it for your own non-commercial project.</p>
      <p>Personal builds and modifications are welcome. Commercial manufacture or sale requires permission from Nice Hat Thanks.</p>
      <div class="actions"><a class="button primary" href="https://github.com/NiceHatThanks/scoopy-node" target="_blank" rel="noreferrer">GitHub</a></div>`;
  }

  // Remove the now-dead navigation target if it exists.
  const nav = document.querySelector('.site-header nav');
  if (nav) {
    nav.querySelectorAll('a[href="#inside"]').forEach(a => a.remove());
  }
})();
