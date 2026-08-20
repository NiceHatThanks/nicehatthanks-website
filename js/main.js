// Load the existing homepage behaviour, then layer the interactive demo extras on top.
(function () {
  const core = document.createElement('script');
  core.src = 'js/main-core.js?v=20260820-demo-core';
  core.onload = () => {
    const extras = document.createElement('script');
    extras.src = 'js/demo-extras.js?v=20260820-theme-leds';
    document.body.appendChild(extras);
  };
  document.body.appendChild(core);
})();
