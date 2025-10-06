// =========================
// helpers
// =========================
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Точка отправки (при желании переопределите глобальной переменной)
const LEAD_ENDPOINT = window.__LEAD_ENDPOINT__ || '/.netlify/functions/lead';

// =========================
// header height → CSS var
// =========================
const header = $('.site-header');
function setHeaderVar(){
  if (!header) return;
  document.documentElement.style.setProperty('--header', `${header.offsetHeight}px`);
}
window.addEventListener('load', setHeaderVar);
window.addEventListener('resize', setHeaderVar);

// =========================
/* MOBILE NAV (используем существующий HTML #mobileNav) */
// =========================
(function initMobileNav(){
  const container = header?.querySelector('.container');
  const mainNav = $('.main-nav');
  if (!container || !mainNav) return;

  // Кнопка-гамбургер (создадим при необходимости)
  let btn = $('.menu-toggle');
  if (!btn){
    btn = document.createElement('button');
    btn.className = 'menu-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label','Открыть меню');
    btn.setAttribute('aria-expanded','false');
    btn.setAttribute('aria-controls','mobileNav');
    btn.innerHTML = '<span class="menu-bar"></span><span class="menu-bar"></span><span class="menu-bar"></span>';
    container.appendChild(btn);
  } else {
    if (!btn.getAttribute('type')) btn.setAttribute('type','button');
    if (!btn.getAttribute('aria-controls')) btn.setAttribute('aria-controls','mobileNav');
  }

  // Панель
  let overlay = $('#mobileNav') || $('.mobile-nav');
  if (!overlay) return;

  // Если вдруг меню оказалось в .site-header — перенесём в body для надёжности
  if (overlay.parentElement.closest('.site-header')) {
    document.body.appendChild(overlay);
  }

  // Синхронизация ссылок с .main-nav
  const mobLinks = overlay.querySelector('.mobile-nav__links');
  if (mobLinks && mainNav){
    mobLinks.innerHTML = '';
    $$('.main-nav a').forEach(a => {
      const clone = a.cloneNode(true);
      clone.removeAttribute('aria-current');
      mobLinks.appendChild(clone);
    });
  }

  let lastFocus = null;
  const closeBtn = overlay.querySelector('.mobile-nav__close');

  function lockScroll(lock){
    const root = document.documentElement;
    if (lock) root.classList.add('no-scroll');
    else root.classList.remove('no-scroll');
  }

  function open(){
    lastFocus = document.activeElement;
    overlay.hidden = false;
    overlay.classList.add('is-open');
    btn.setAttribute('aria-expanded','true');
    lockScroll(true);
    closeBtn?.focus?.({preventScroll:true});
  }
  function close(){
    overlay.classList.remove('is-open');
    overlay.hidden = true;
    btn.setAttribute('aria-expanded','false');
    lockScroll(false);
    try{ lastFocus?.focus({preventScroll:true}); }catch{}
  }

  btn.addEventListener('click', () => {
    if (overlay.classList.contains('is-open')) close();
    else open();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
    if (e.target.closest('.mobile-nav__close')) close();
    const link = e.target.closest('a');
    if (link) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) close();
  });
})();

// =========================
// Catalog filter + поиск (работает на страницах с .chip/.card)
// =========================
const chips = $$('.chip');
const cards = $$('.card');

function setActiveChipByName(name){
  chips.forEach(c => c.classList.toggle('is-active', c.dataset.filter === name || (name === 'all' && c.dataset.filter === 'all')));
}
function applyFilter(filter){
  if (!chips.length) return;
  setActiveChipByName(filter);
  const allow = (filter === 'all') ? null : [filter];
  cards.forEach(card => {
    if (!card.hasAttribute('data-category')) return;
    const ok = (allow === null) || allow.includes(card.dataset.category);
    card.style.display = ok ? '' : 'none';
  });
  renderSearchNote(null, countVisibleCards());
}
chips.forEach(ch => ch.addEventListener('click', (e) => {
  e.preventDefault();
  applyFilter(ch.dataset.filter);
}));

// Автозаполнение категории при клике «Оставить заявку»
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href="#form"]');
  if (!link) return;
  const card = link.closest('.card');
  const sel = document.querySelector('#leadForm select[name="category"]');
  if (card && sel && card.dataset.category) {
    const val = card.dataset.category;
    const opt = sel.querySelector(`option[value="${val}"]`);
    if (opt) sel.value = opt.value;
  }
});

// ===== Поиск в каталоге по ?q= и #catalog?q=
function ensureSearchNote(){
  let note = $('.search-note');
  if (!note && $('.chips')){
    note = document.createElement('div');
    note.className = 'search-note';
    note.setAttribute('role','status');
    const chipsWrap = $('.chips');
    chipsWrap && chipsWrap.insertAdjacentElement('afterend', note);
  }
  return note;
}
function renderSearchNote(query, count){
  const note = ensureSearchNote();
  if (!note) return;
  if (query == null){
    if (count == null) { note.classList.remove('is-visible'); return; }
    note.innerHTML = `<span>Найдено позиций: <b>${count}</b></span>`;
    note.classList.add('is-visible');
    return;
  }
  const q = (query || '').trim();
  if (!q){ note.classList.remove('is-visible'); return; }
  note.innerHTML = `По запросу «<b>${q.replace(/[<>&"]/g,'')}</b>» найдено: <b>${count}</b>`;
  note.classList.add('is-visible');
}
function countVisibleCards(){ return cards.filter(c => c.style.display !== 'none').length; }
function normalize(s){ return (s || '').toString().toLowerCase(); }
function applySearch(query){
  if (!cards.length) return;
  const q = normalize(query);
  if (!q){
    applyFilter('all');
    renderSearchNote('', 0);
    return;
  }
  chips.forEach(c => c.classList.remove('is-active'));
  let hits = 0;
  cards.forEach(card => {
    const title = normalize(card.querySelector('.card-title')?.textContent);
    const desc  = normalize(card.querySelector('[itemprop="description"]')?.textContent);
    const cat   = normalize(card.dataset.category);
    const ok = (title && title.includes(q)) || (desc && desc.includes(q)) || (cat && cat.includes(q));
    card.style.display = ok ? '' : 'none';
    if (ok) hits++;
  });
  renderSearchNote(q, hits);
  $('#catalog')?.scrollIntoView({behavior:'smooth', block:'start'});
}
// хэш "#catalog?q=..."
function parseHash(){
  const h = location.hash || '';
  if (!h) return {type:'none'};
  const [hashPath, hashQuery] = h.split('?');
  const params = new URLSearchParams(hashQuery || '');
  const q = params.get('q');
  if (hashPath === '#catalog' && q) return {type:'search', q};
  return {type:'none'};
}
function applyFromURL(){
  const parsed = parseHash();
  if (parsed.type === 'search'){ applySearch(parsed.q); return; }
  const qs = new URLSearchParams(location.search);
  const q = qs.get('q');
  if (q){ applySearch(q); }
}
window.addEventListener('hashchange', applyFromURL);
window.addEventListener('DOMContentLoaded', applyFromURL);

// =========================
// Success Modal (после отправки формы)
// =========================
function ensureSuccessModal(){
  if ($('#successModal')) return $('#successModal');
  const css = `
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:9999;opacity:0;visibility:hidden;transition:opacity .18s ease,visibility 0s .18s}
  .modal-overlay.is-open{opacity:1;visibility:visible;transition:opacity .18s ease}
  .modal{background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.15);max-width:min(520px,92vw);width:100%;padding:20px}
  .modal h3{margin:0 0 6px;font:700 20px var(--ff-body, system-ui)}
  .modal p{margin:0 0 12px;color:var(--muted,#555)}
  .modal .modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:10px}
  .modal .btn{display:inline-flex;align-items:center;gap:.5rem;padding:.7rem 1rem;border-radius:999px;border:2px solid transparent;font-weight:700;text-decoration:none;cursor:pointer}
  .modal .btn-primary{background:var(--brand,#7f5539);color:#fff}
  .modal .btn-primary:hover{background:var(--brand-2,#9c6644)}
  .modal .btn-outline{border-color:#222;color:#222;background:#fff}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay'; overlay.id = 'successModal';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="successTitle">
      <h3 id="successTitle">Заявка отправлена</h3>
      <p class="success-text">Спасибо! Мы свяжемся с вами в ближайшее время.</p>
      <div class="modal-actions">
        <button class="btn btn-primary" data-close type="button">Ок</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const root = document.documentElement;
  function lockScroll(lock){
    if (lock) root.classList.add('no-scroll');
    else root.classList.remove('no-scroll');
  }

  function openModal(){ overlay.classList.add('is-open'); lockScroll(true); }
  function closeModal(){ overlay.classList.remove('is-open'); lockScroll(false); }

  overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeModal(); });
  overlay.__open = openModal; overlay.__close = closeModal; return overlay;
}
function showSuccessModal(message){
  const m = ensureSuccessModal();
  const p = m.querySelector('.success-text'); if (p && message) p.textContent = message;
  m.__open && m.__open();
}

// =========================
// helpers for form
// =========================
function parseUTM(){
  const p = new URLSearchParams(location.search);
  const keys = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'];
  const utm = {}; keys.forEach(k => { const v = p.get(k); if (v) utm[k] = v; }); return utm;
}
const trim = (s) => (s || '').toString().trim();

// Мини-валидация телефона/имени
function validateLead(name, phone){
  const phoneClean = (phone || '').replace(/[^\d+]/g,'');
  const ok = !!name || phoneClean.length >= 9;
  const phoneInput = document.querySelector('#leadForm input[name="phone"]');
  const nameInput  = document.querySelector('#leadForm input[name="name"]');
  phoneInput && phoneInput.classList.toggle('is-error', !ok && !name);
  nameInput  && nameInput.classList.toggle('is-error', !ok && !phoneClean);
  return ok;
}

// =========================
// Form handler (→ сервер/Telegram через function)
// =========================
const form = $('#leadForm');
if (form){
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const fd = new FormData(form);
    const name     = trim(fd.get('name'));
    const phone    = trim(fd.get('phone'));
    const category = trim(fd.get('category'));
    const comment  = trim(fd.get('comment'));
    const threadId = trim(fd.get('tg_topic_id'));

    if (!validateLead(name, phone)){
      alert('Пожалуйста, укажите телефон или имя, чтобы мы могли связаться.');
      return;
    }
    btn && (btn.disabled = true);

    const payload = {
      name, phone, category, comment,
      page: location.href, ref: document.referrer || '',
      utm: parseUTM(), ts: new Date().toISOString(),
      message_thread_id: threadId || undefined
    };

    try{
      const res = await fetch(LEAD_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok){ const t = await res.text().catch(()=> ''); console.error('lead submit error:', t || `HTTP ${res.status}`); throw new Error(t || `HTTP ${res.status}`); }
      form.reset();
      const msg = name ? `Спасибо, ${name}! Мы свяжемся с вами в ближайшее время.` : 'Спасибо! Мы свяжемся с вами в ближайшее время.';
      showSuccessModal(msg);
    } catch (err){
      console.error('lead submit error:', err);
      alert('Не получилось отправить заявку. Попробуйте ещё раз или напишите нам в Instagram.');
    } finally {
      btn && (btn.disabled = false);
    }
  });
}

// Мягкая прокрутка к якорям
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  if (id.length > 1){
    const el = $(id);
    if (el){
      e.preventDefault();
      el.scrollIntoView({behavior:'smooth', block:'start'});
      history.pushState(null,'', id);
    }
  }
});
