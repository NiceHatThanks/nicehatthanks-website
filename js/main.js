// Load the homepage behaviour, restructure the page, then layer the interactive demo on top.
(function () {
  function load(src, done) {
    const script = document.createElement('script');
    script.src = src;
    if (done) script.onload = done;
    document.body.appendChild(script);
  }

  load('js/main-core.js?v=20260820-demo-core', () => {
    load('js/homepage-flow.js?v=20260821-flow2', () => {
      load('js/homepage-copy-fixes.js?v=20260821-copy2', () => {
        load('js/demo-extras.js?v=20260820-bright-leds');
      });
    });
  });
})();
