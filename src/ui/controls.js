/** @template {HTMLElement} T @param {string} id @returns {T} */
export function element(id) {
  const el=document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return /** @type {T} */ (el);
}

export function setupChrome(onSettingsOpen=()=>{}) {
  const desktop=matchMedia('(min-width: 768px)');
  const panel=element('settings'), toggle=element('settings-toggle'), scrim=element('nav-scrim');
  function open(value) {
    if(value)onSettingsOpen();
    panel.classList.toggle('hidden',!value); toggle.setAttribute('aria-pressed',String(value));
    scrim.classList.toggle('hidden', !value || desktop.matches); document.body.classList.toggle('panel-open',value);
  }
  open(false);
  toggle.addEventListener('click',()=>open(panel.classList.contains('hidden')));
  scrim.addEventListener('click',()=>{open(false); toggle.focus();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){open(false); toggle.focus();}});
  desktop.addEventListener('change',()=>open(!panel.classList.contains('hidden')));
  for(const el of [panel,element('app-nav')]) for(const type of ['pointerdown','click','wheel']) el.addEventListener(type,e=>e.stopPropagation());
  const full=element('fullscreen');
  full.addEventListener('click',async()=>{
    try { if(document.fullscreenElement) await document.exitFullscreen(); else await element('app').requestFullscreen(); }
    catch { element('view-status').textContent='Fullscreen is unavailable in this browser.'; }
  });
  document.addEventListener('fullscreenchange',()=>{
    full.setAttribute('aria-pressed',String(!!document.fullscreenElement));
    element('full-label').textContent=document.fullscreenElement?'Exit':'Full';
  });
}
