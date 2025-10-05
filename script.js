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
// Catalog filter (только если есть .chip/.card)
// =========================
const chips = $$('.chip');
const cards = $$('.card');

function setActiveChipByName(name){
  chips.forEach(c => c.classList.toggle('is-active', c.dataset.filter === name || (name === 'all' && c.dataset.filter === 'all')));
}
function applyFilter(filter){
  setActiveChipByName(filter);
  const allow = (filter === 'all') ? null : [filter];
  cards.forEach(card => {
    if (!card.hasAttribute('data-category')) return;
    const ok = (allow === null) || allow.includes(card.dataset.category);
    card.style.display = ok ? '' : 'none';
  });
}
chips.forEach(ch => ch.addEventListener('click', (e) => {
  e.preventDefault();
  applyFilter(ch.dataset.filter);
}));

// Автозаполнение категории при клике «Оформить заказ»
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href="#form"]');
  if (!link) return;
  const card = link.closest('.card');
  const sel = document.querySelector('#leadForm select[name="category"]');
  if (card && sel) {
    const val = card.dataset.category || card.querySelector('.card-title')?.textContent || '';
    if (val) sel.value = sel.querySelector(`option[value="${val}"]`) ? val : sel.value;
  }
});

// =========================
// Success Modal (после отправки формы)
// =========================
let scrollY = 0;
function lockScroll(lock){
  if (lock){
    scrollY = window.scrollY || window.pageYOffset || 0;
    if (isIOS()){
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
    } else {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    }
  } else {
    if (isIOS()){
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY || 0);
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
  }
}
function safeFocus(el){ if (!el) return; try { el.focus({ preventScroll: true }); } catch { try { el.focus(); } catch(_) {} } }
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
        <button class="btn btn-primary" data-close>Ок</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeModal(); });
  let prevFocus = null;
  function openModal(){ prevFocus = document.activeElement; overlay.classList.add('is-open'); safeFocus(overlay.querySelector('[data-close]')); lockScroll(true); }
  function closeModal(){ overlay.classList.remove('is-open'); lockScroll(false); safeFocus(prevFocus); }
  overlay.__open = openModal; overlay.__close = closeModal; return overlay;
}
function showSuccessModal(message){
  const m = ensureSuccessModal();
  const p = m.querySelector('.success-text'); if (p && message) p.textContent = message;
  m.__open && m.__open();
}
function closeModal(){ const m = $('#successModal'); m && m.__close && m.__close(); }

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
