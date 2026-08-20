// Extra interaction layer for the Scoopy demo: visible LED illumination,
// whole-site light/dark control and pointer/touch proximity feedback.
(function () {
  const demo = document.getElementById('interactive-demo');
  if (!demo) return;

  const room = demo.querySelector('.demo-room');
  const deviceCanvas = demo.querySelector('.demo-device');
  const deviceWrap = demo.querySelector('.demo-device-wrap');
  const eventLabel = demo.querySelector('.demo-event');
  const presenceText = demo.querySelector('.demo-presence-text');
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
    .demo-room.theme-dark .demo-event:before { content:'● '; color:#ff625b; }
    .demo-room.theme-light .demo-event:before { content:'○ '; color:#d4cec1; }
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
  let touchPointerId = null;
  let lastTouchDistance = null;

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
      img.src = assetBase + file + '?v=20260820-led4';
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
    const strength=Math.max(0,Math.min(1,amount));
    octx.save();

    // Wide bloom: clearly reads as an illuminated LED even on bright displays.
    octx.globalCompositeOperation='screen';
    octx.globalAlpha=Math.min(1,.72 + strength*.28);
    octx.shadowColor=colour;
    octx.shadowBlur=52 + 54*strength;
    octx.drawImage(layer,bounds.x,bounds.y,bounds.width,bounds.height,0,0,overlay.width,overlay.height);

    // Bright coloured body of the actual light pipe.
    octx.globalCompositeOperation='source-over';
    octx.shadowColor=colour;
    octx.shadowBlur=24 + 22*strength;
    octx.globalAlpha=Math.min(1,.88 + strength*.12);
    octx.drawImage(layer,bounds.x,bounds.y,bounds.width,bounds.height,0,0,overlay.width,overlay.height);

    // Hot core gives it the opaque, powered-on look that was missing before.
    octx.globalCompositeOperation='screen';
    octx.shadowBlur=8;
    octx.globalAlpha=1;
    octx.drawImage(layer,bounds.x,bounds.y,bounds.width,bounds.height,0,0,overlay.width,overlay.height);
    octx.restore();
  }

  function isDark(){ return document.body.classList.contains('site-dark'); }

  function render(now=performance.now()) {
    octx.clearRect(0,0,overlay.width,overlay.height);

    // Dark mode is represented by the centre red status LED staying brightly on.
    if(isDark()) drawLed('ledMid','#ff3b32',1);

    // Presence keeps the right green LED clearly illuminated.
    if(presence) drawLed('ledRight','#39f45b',0.9);

    if(pulse){
      const elapsed=now-pulse.start;
      const duration=pulse.duration;
      if(elapsed>=duration){
        pulse=null;
      } else {
        const t=elapsed/duration;
        let level;
        if(t<0.08) level=t/0.08;
        else if(t<0.78) level=1;
        else level=1-((t-0.78)/0.22);
        drawLed(pulse.key,pulse.colour,Math.max(.35,level));
      }
    }

    if(pulse) raf=requestAnimationFrame(render); else raf=null;
  }

  function startPulse(key, colour, duration=1900){
    pulse={key,colour,start:performance.now(),duration};
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

  function setTheme(dark, source=''){
    document.body.classList.toggle('site-dark',dark);
    room.classList.toggle('theme-dark',dark);
    room.classList.toggle('theme-light',!dark);
    room.classList.toggle('is-light-on',dark);

    if(eventLabel){
      const prefix=source ? `${source} · ` : '';
      eventLabel.textContent=prefix+(dark?'dark mode':'light mode');
    }
    render();
  }

  function toggleThemeFrom(button){
    const dark=!isDark();
    setTheme(dark,button==='buttonUp'?'Button 1':'Button 2');
    if(button==='buttonUp') startPulse('ledLeft','#39f45b',2100);
    else startPulse('ledRight','#39f45b',2100);
  }

  setTheme(false);

  deviceCanvas.addEventListener('pointerup', e => {
    const hit=hitButton(e);
    if(hit==='buttonUp' || hit==='buttonDown'){
      e.preventDefault();
      e.stopImmediatePropagation();
      toggleThemeFrom(hit);
    }
  }, true);

  function distanceFromDevice(clientX,clientY){
    const r=deviceCanvas.getBoundingClientRect();
    const centreX=r.left+r.width/2;
    const centreY=r.top+r.height*.58;
    return Math.hypot(clientX-centreX,clientY-centreY);
  }

  function applyPresenceFromPoint(clientX,clientY,pointerType){
    const distance=distanceFromDevice(clientX,clientY);
    const threshold=pointerType==='touch' ? Math.max(150,Math.min(230,window.innerWidth*.42)) : (window.innerWidth>980?220:150);
    const next=distance<=threshold;

    if(pointerType==='touch') lastTouchDistance=distance;
    if(presenceText){
      if(next) presenceText.textContent=`Presence detected · ${Math.round(distance)} px`;
      else presenceText.textContent=`${Math.round(distance)} px away`;
    }

    if(next!==presence){
      presence=next;
      room.classList.toggle('has-presence',presence);
      render();
    }
    return distance;
  }

  room.addEventListener('pointermove', e => {
    if(e.pointerType==='mouse' || e.pointerType==='pen'){
      applyPresenceFromPoint(e.clientX,e.clientY,e.pointerType);
      return;
    }
    if(e.pointerType==='touch' && touchPointerId===e.pointerId){
      applyPresenceFromPoint(e.clientX,e.clientY,'touch');
    }
  });

  room.addEventListener('pointerdown', e => {
    if(e.pointerType!=='touch') return;
    touchPointerId=e.pointerId;
    applyPresenceFromPoint(e.clientX,e.clientY,'touch');
  });

  function endTouch(e){
    if(e.pointerType!=='touch' || touchPointerId!==e.pointerId) return;
    touchPointerId=null;
    if(presenceText && lastTouchDistance!==null){
      presenceText.textContent=`Last touch · ${Math.round(lastTouchDistance)} px from Scoopy`;
    }
    presence=false;
    room.classList.remove('has-presence');
    render();
  }
  room.addEventListener('pointerup',endTouch);
  room.addEventListener('pointercancel',endTouch);

  room.addEventListener('pointerleave',e=>{
    if(e.pointerType==='mouse' || e.pointerType==='pen'){
      if(presence){ presence=false; room.classList.remove('has-presence'); render(); }
      if(presenceText) presenceText.textContent='Move closer to detect presence';
    }
  });

  Promise.all(Object.entries(files).map(([k,f])=>load(k,f))).then(()=>{
    findBounds();
    render();
  }).catch(err=>console.error('Unable to load LED overlay assets',err));
})();
