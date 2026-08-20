const realPreviewStyles = document.createElement('link');
realPreviewStyles.rel = 'stylesheet';
realPreviewStyles.href = 'css/shop-real.css?v=20260820-radar-alpha-folder';
document.head.appendChild(realPreviewStyles);

document.querySelectorAll('.flavour-card .mini-device').forEach(placeholder => {
  const preview = document.createElement('canvas');
  preview.className = 'flavour-preview';
  preview.width = 260;
  preview.height = 260;
  preview.setAttribute('aria-hidden', 'true');
  placeholder.replaceWith(preview);
});

const canvas = document.getElementById('scoopyCanvas');
const selectedFlavour = document.getElementById('selectedFlavour');
const state = { lid:'#D789A6', base:'#E9E1CF', button1:'#E9E1CF', button2:'#E9E1CF' };
const variants = {
  compact:{price:'£12.49',dimensions:'32 × 32 × 16 mm',description:'The tiny two-button room node.'},
  presence:{price:'£15.99',dimensions:'32 × 44 × 16 mm',description:'The same controls, with mmWave room presence built in.'}
};
let selectedVariant='presence';

const layerPaths={
  compact:{base:'images/seperate/base.png',pcb:'images/seperate/pcb.png',lid:'images/seperate/lid-noLightPipes.PNG',lightPipes:'images/seperate/lightPipes.png',button1:'images/seperate/button1.png',button2:'images/seperate/button2.png'},
  presence:{base:'images/seperate/radar-base.png',pcb:'images/seperate/radar-pcb.png',lid:'images/seperate/radar-lid.png',lightPipes:'images/seperate/radar-lightPipes.png',button1:'images/seperate/radar-button1.png',button2:'images/seperate/radar-button2.png'}
};
const layerSets={compact:{images:{},sourceData:{}},presence:{images:{},sourceData:{}}};
const tintCache=new Map();
function hexToRgb(hex){const v=hex.replace('#','');return{r:parseInt(v.slice(0,2),16),g:parseInt(v.slice(2,4),16),b:parseInt(v.slice(4,6),16)}}
function loadImage(variant,key,src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{const off=document.createElement('canvas');off.width=canvas.width;off.height=canvas.height;const ctx=off.getContext('2d',{willReadFrequently:true});ctx.clearRect(0,0,off.width,off.height);ctx.drawImage(image,0,0,off.width,off.height);const source=ctx.getImageData(0,0,off.width,off.height);layerSets[variant].images[key]=off;layerSets[variant].sourceData[key]=source;resolve()};image.onerror=reject;image.src=src})}
function tintLayer(variant,key,colour){const cacheKey=`${variant}:${key}:${colour}`;if(tintCache.has(cacheKey))return tintCache.get(cacheKey);const source=layerSets[variant].sourceData[key],output=new ImageData(new Uint8ClampedArray(source.data),source.width,source.height),target=hexToRgb(colour);let sum=0,count=0;for(let i=0;i<source.data.length;i+=4){if(source.data[i+3]>24){sum+=.2126*source.data[i]+.7152*source.data[i+1]+.0722*source.data[i+2];count++}}const reference=count?sum/count:150;for(let i=0;i<output.data.length;i+=4){const alpha=source.data[i+3];if(!alpha)continue;const lum=.2126*source.data[i]+.7152*source.data[i+1]+.0722*source.data[i+2],delta=(lum-reference)*.72;output.data[i]=Math.max(0,Math.min(255,target.r+delta));output.data[i+1]=Math.max(0,Math.min(255,target.g+delta));output.data[i+2]=Math.max(0,Math.min(255,target.b+delta));output.data[i+3]=alpha}const layer=document.createElement('canvas');layer.width=output.width;layer.height=output.height;layer.getContext('2d').putImageData(output,0,0);tintCache.set(cacheKey,layer);return layer}
function drawLayer(ctx,layer,width,height,padding=.08){const scale=Math.min(width/layer.width,height/layer.height)*(1-padding*2),dw=layer.width*scale,dh=layer.height*scale,dx=(width-dw)/2,dy=(height-dh)/2;ctx.drawImage(layer,0,0,layer.width,layer.height,dx,dy,dw,dh)}
function renderComposite(targetCanvas,colours,variant=selectedVariant,padding=.08){const set=layerSets[variant];if(!set.images.pcb)return;const ctx=targetCanvas.getContext('2d');ctx.clearRect(0,0,targetCanvas.width,targetCanvas.height);drawLayer(ctx,set.images.pcb,targetCanvas.width,targetCanvas.height,padding);drawLayer(ctx,tintLayer(variant,'base',colours.base),targetCanvas.width,targetCanvas.height,padding);drawLayer(ctx,tintLayer(variant,'lid',colours.lid),targetCanvas.width,targetCanvas.height,padding);drawLayer(ctx,tintLayer(variant,'button1',colours.button1),targetCanvas.width,targetCanvas.height,padding);drawLayer(ctx,tintLayer(variant,'button2',colours.button2),targetCanvas.width,targetCanvas.height,padding);drawLayer(ctx,set.images.lightPipes,targetCanvas.width,targetCanvas.height,padding)}
function renderScoopy(){renderComposite(canvas,state,selectedVariant,.08)}
function renderFlavourPreviews(){document.querySelectorAll('.flavour-card').forEach(card=>{const preview=card.querySelector('.flavour-preview');if(preview)renderComposite(preview,{lid:card.dataset.lid,base:card.dataset.base,button1:card.dataset.button1,button2:card.dataset.button2},selectedVariant,.06)})}
function applyState(){renderScoopy()}
function selectSwatch(part,colour,name,button){state[part]=colour;const row=button.closest('.swatch-row');row.querySelectorAll('.swatch').forEach(s=>s.classList.remove('is-selected'));button.classList.add('is-selected');const label=document.getElementById(`${part}Name`);if(label)label.textContent=name;document.querySelectorAll('.flavour-card').forEach(c=>c.classList.remove('is-selected'));selectedFlavour.textContent='Custom mix';applyState()}
document.querySelectorAll('.swatch').forEach(button=>button.addEventListener('click',()=>{const row=button.closest('.swatch-row');selectSwatch(row.dataset.part,button.dataset.colour,button.dataset.name,button)}));
document.querySelectorAll('.flavour-card').forEach(card=>card.addEventListener('click',()=>{document.querySelectorAll('.flavour-card').forEach(i=>i.classList.remove('is-selected'));card.classList.add('is-selected');['lid','base','button1','button2'].forEach(part=>state[part]=card.dataset[part]);selectedFlavour.textContent=card.dataset.name;['lid','base','button1','button2'].forEach(part=>{const row=document.querySelector(`.swatch-row[data-part="${part}"]`);if(!row)return;row.querySelectorAll('.swatch').forEach(swatch=>{const selected=swatch.dataset.colour.toLowerCase()===state[part].toLowerCase();swatch.classList.toggle('is-selected',selected);if(selected){const label=document.getElementById(`${part}Name`);if(label)label.textContent=swatch.dataset.name}})});applyState()}));
function addVariantPicker(){const priceRow=document.querySelector('.price-row');if(!priceRow)return;const picker=document.createElement('section');picker.className='variant-picker';picker.setAttribute('aria-label','Choose Scoopy hardware');picker.innerHTML=`<div class="variant-heading"><h2>Choose your Scoopy</h2><span>Two sizes</span></div><div class="variant-grid"><button type="button" class="variant-card" data-variant="compact"><span><strong>Node</strong><small>32 × 32 × 16 mm</small></span><b>£12.49</b></button><button type="button" class="variant-card is-selected" data-variant="presence"><span><strong>Node + Presence</strong><small>32 × 44 × 16 mm · mmWave</small></span><b>£15.99</b></button></div><p class="variant-description">${variants.presence.description}</p>`;priceRow.insertAdjacentElement('afterend',picker);const summaryDimension=document.querySelector('.buy-summary > div span:first-child'),price=document.querySelector('.shop-price');const applyVariant=variantName=>{selectedVariant=variantName;const variant=variants[selectedVariant];picker.querySelectorAll('.variant-card').forEach(item=>item.classList.toggle('is-selected',item.dataset.variant===selectedVariant));price.textContent=variant.price;if(summaryDimension)summaryDimension.textContent=variant.dimensions;picker.querySelector('.variant-description').textContent=variant.description;renderScoopy();renderFlavourPreviews()};picker.querySelectorAll('.variant-card').forEach(button=>button.addEventListener('click',()=>applyVariant(button.dataset.variant)));applyVariant('presence')}
addVariantPicker();
const loadPromises=Object.entries(layerPaths).flatMap(([variant,paths])=>Object.entries(paths).map(([key,src])=>loadImage(variant,key,src)));
Promise.all(loadPromises).then(()=>{renderScoopy();renderFlavourPreviews()}).catch(error=>console.error('Unable to load Scoopy preview layers',error));
