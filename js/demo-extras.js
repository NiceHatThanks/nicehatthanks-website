// Extra interaction layer for the Scoopy demo: visible LED illumination and a
// site-wide light/dark theme controlled by the real upper Scoopy button.
(function () {
  const demo = document.getElementById('interactive-demo');
  if (!demo) return;

  const room = demo.querySelector('.demo-room');
  const deviceCanvas = demo.querySelector('.demo-device');
  const deviceWrap = demo.querySelector('.demo-device-wrap');
  const eventLabel = demo.querySelector('.demo-event');
  if (!room || !deviceCanvas || !deviceWrap) return;

  const overlay = document.createElement('canvas');
  overlay.className = 'demo-led-overlay';
  overlay.width = 900;
  overlay.height = 900;
  overlay.setAttribute('aria-hidden', 'true');
  deviceWrap.insertBefore(overlay, deviceCanvas.nextSibling);

  const style = document.createElement('style');
  style.textContent = `
    body, .product-panel, .resource-card, .story-open, .closing-card, .site-header, footer,
    .variant-overview a, .uses-grid article { transition: background-color .45s ease, color .45s ease, border-color .45s ease; }

    body.site-dark {
      --background:#171a17;
      --surface:#222720;
      --surface-soft:#1c211b;
      --text:#f5f0e6;
      --muted:#b7b9b2;
      --accent:#a9bcae;
      --border:rgba(245,240,230,.14);
      --render-background:#101310;
    }
    body.site-dark .product-panel,
    body.site-dark .resource-card,
    body.site-dark .story-open,
    body.site-dark .variant-overview a { background:rgba(255,255,255,.035); }
    body.site-dark .closing-card { background:#0f120f; }
    body.site-dark .inside-section { background:#0f120f; }
    body.site-dark .inside-section .inside-copy h2,
    body.site-dark .inside-section { color:#f5f0e6; }
    body.site-dark .principles-copy p,
    body.site-dark .product-grid p,
    body.site-dark .uses-grid p,
    body.site-dark .story-copy>p,
    body.site-dark .resource-card p { color:#b7b9b2; }
    body.site-dark .secondary { border-color:rgba(245,240,230,.24); color:#f5f0e6; }
    body.site-dark .secondary:hover { background:rgba(255,255,255,.07); }
    body.site-dark .primary { background:#f5f0e6; color:#171a17; border-color:#f5f0e6; }

    .demo-led-overlay {
      position:absolute;
      inset:0;
      width:100%;
      height:100%;
      z-index:4;
      pointer-events:none;
    }
    .demo-device { position:relative; z-index:3; }
    .demo-hint { z-index:5; }
    .demo-room.theme-dark .demo-event:before { content:'● '; color:#7de28b; }
    .demo-room.theme-light .demo-event:before { content:'○ '; color:#fff2bb; }
  `;
  document.head.appendChild(style);

  const assetBase = 'images/interactive-demo/';
  const files = {
    base:'base.png', pcb:'pcb.png', lid:'lid.png', buttonUp:'buttonUp.png', buttonDown:'buttonDown.png',
    ledLeft:'lp-left.png', ledMid:'lp-mid.png', ledRight:'lp-right.png'
  };
  const images = {};
  const maskData = {};
  let sourceWidth = 1200;
  let sourceHeight = 1200;
  let bounds = {x:0,y:0,width:1200,height:1200};
  let presence = false;
  let pulse = null;
  let raf = null;

  function load(key, file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        images[key] = img;
        sourceWidth = img.naturalWidth;
        sourceHeight = img.naturalHeight;
        const c = document.createElement('canvas');
        c.width = sourceWidth; c.height = sourceHeight;
        const x = c.getContext('2d', {willReadFrequently:true});
        x.drawImage(img,0,0);
        maskData[key] = x.getImageData(0,0,sourceWidth,sourceHeight);
        resolve();
      };
      img.onerror = reject;
      img.src = assetBase + file + '?v=20260820-led2';
    });
  }

  function findBounds() {
    let minX=sourceWidth,minY=sourceHeight,maxX=-1,maxY=-1;
    ['base','pcb','lid','buttonUp','buttonDown'].forEach(key => {
      const d = maskData[key].data;
      for(let y=0;y<sourceHeight;y+=3){
        for(let x=0;x<sourceWidth;x+=3){
          if(d[(y*sourceWidth+x)*4+3]>12){
            minX=Math.min(minX,x); minY=Math.min(minY,y); maxX=Math.max(maxX,x); maxY=Math.max(maxY,y);
          }
        }
      }
    });
    if(maxX<minX) return;
    const w=maxX-minX+1,h=maxY-minY+1,mx=w*.12,my=h*.12;
    const x=Math.max(0,minX-mx),y=Math.max(0,minY-my);
    const right=Math.min(sourceWidth,maxX+mx),bottom=Math.min(sourceHeight,maxY+my);
    bounds={x,y,width:right-x,height:bottom-y};
  }

  const octx = overlay.getContext('2d');
  const tinted = {};
  function tint(key, colour) {
    const cacheKey=key+colour;
    if(tinted[cacheKey]) return tinted[cacheKey];
    const c=document.createElement('canvas'); c.width=sourceWidth; c.height=sourceHeight;
    const x=c.getContext('2d'); x.drawImage(images[key],0,0);
    x.globalCompositeOperation='source-in'; x.fillStyle=colour; x.fillRect(0,0,c.width,c.height);
    tinted[cacheKey]=c; return c;
  }

  function drawLed(key, colour, amount) {
    if(!images[key] || amount<=0) return;
    const layer=tint(key,colour);
    octx.save();
    octx.globalAlpha=Math.min(1,amount);
    octx.shadowColor=colour;
    octx.shadowBlur=28 + 34*amount;
    octx.drawImage(layer,bounds.x,bounds.y,bounds.width,bounds.height,0,0,overlay.width,overlay.height);
    // Second pass makes the pipe itself visibly coloured, not just the halo.
    octx.shadowBlur=7;
    octx.globalAlpha=Math.min(1,amount*.95);
    octx.drawImage(layer,bounds.x,bounds.y,bounds.width,bounds.height,0,0,overlay.width,overlay.height);
    octx.restore();
  }

  function render(now=performance.now()) {
    octx.clearRect(0,0,overlay.width,overlay.height);
    if(presence) drawLed('ledRight','#64e879',0.72);
    if(pulse){
      const t=(now-pulse.start)/1000;
      if(t>=1){ pulse=null; }
      else {
        const level=.25 + Math.sin(t*Math.PI)*.75;
        drawLed(pulse.key,pulse.colour,level);
      }
    }
    if(pulse) raf=requestAnimationFrame(render); else raf=null;
  }

  function startPulse(key, colour){
    pulse={key,colour,start:performance.now()};
    if(!raf) raf=requestAnimationFrame(render);
  }

  function alphaAt(key,x,y){
    const d=maskData[key];
    if(!d || x<0 || y<0 || x>=sourceWidth || y>=sourceHeight) return 0;
    return d.data[(Math.floor(y)*sourceWidth+Math.floor(x))*4+3];
  }

  function pointFromEvent(e){
    const r=deviceCanvas.getBoundingClientRect();
    return {
      x:bounds.x+((e.clientX-r.left)/r.width)*bounds.width,
      y:bounds.y+((e.clientY-r.top)/r.height)*bounds.height
    };
  }

  function hitButton(e){
    const p=pointFromEvent(e);
    if(alphaAt('buttonUp',p.x,p.y)>24) return 'buttonUp';
    if(alphaAt('buttonDown',p.x,p.y)>24) return 'buttonDown';
    return null;
  }

  function setTheme(dark){
    document.body.classList.toggle('site-dark',dark);
    room.classList.toggle('theme-dark',dark);
    room.classList.toggle('theme-light',!dark);
    if(eventLabel) eventLabel.textContent=dark?'Whole site · dark mode':'Whole site · light mode';
  }

  // Start in the site's existing light theme.
  setTheme(false);

  deviceCanvas.addEventListener('pointerup', e => {
    const hit=hitButton(e);
    if(hit==='buttonUp'){
      setTheme(!document.body.classList.contains('site-dark'));
      startPulse('ledLeft','#64e879');
    } else if(hit==='buttonDown') {
      startPulse('ledMid','#ff5d55');
    }
  }, true);

  room.addEventListener('pointermove', e => {
    if(e.pointerType && e.pointerType!=='mouse') return;
    const r=deviceCanvas.getBoundingClientRect();
    const dx=e.clientX-(r.left+r.width/2);
    const dy=e.clientY-(r.top+r.height*.58);
    const threshold=window.innerWidth>980?220:150;
    const next=Math.hypot(dx,dy)<=threshold;
    if(next!==presence){ presence=next; render(); }
  });
  room.addEventListener('pointerleave',()=>{ if(presence){presence=false;render();} });

  Promise.all(Object.entries(files).map(([k,f])=>load(k,f))).then(()=>{
    findBounds();
    render();
  }).catch(err=>console.error('Unable to load LED overlay assets',err));
})();
