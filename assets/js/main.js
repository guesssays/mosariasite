// Nav toggle
const navToggle = document.getElementById('navToggle');
const navList = document.getElementById('navList');
if(navToggle && navList){
  navToggle.addEventListener('click', () => navList.classList.toggle('is-open'));
  navList.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navList.classList.remove('is-open')));
}

// Smooth scroll for internal links
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if(id.length > 1){
      e.preventDefault();
      document.querySelector(id)?.scrollIntoView({behavior:'smooth', block:'start'});
    }
  })
});

// Category filter
const catButtons = document.querySelectorAll('.cat');
catButtons.forEach(btn => btn.addEventListener('click', () => {
  catButtons.forEach(b => b.classList.remove('is-active'));
  btn.classList.add('is-active');
  const cat = btn.dataset.cat;
  if(window.renderProducts) window.renderProducts(cat);
}));

// Lead form submit via Netlify Function → Telegram
const form = document.getElementById('leadForm');
const statusEl = document.getElementById('formStatus');
const btn = document.getElementById('submitBtn');
function setStatus(msg, ok){
  statusEl.textContent = msg || '';
  statusEl.className = 'form__status ' + (ok ? 'ok' : 'err');
}

if(form){
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus('', true);
    btn.disabled = true;
    btn.textContent = 'Отправляем...';
    try{
      const formData = new FormData(form);
      // attach UTM & meta
      const payload = Object.fromEntries(formData.entries());
      payload.utm = Object.fromEntries(new URLSearchParams(location.search).entries());
      payload.page = location.href;
      const res = await fetch('/.netlify/functions/telegram-lead', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if(!res.ok || !data.ok) throw new Error(data.error || 'Ошибка отправки');
      setStatus('Заявка отправлена. Мы свяжемся с вами!', true);
      form.reset();
    }catch(err){
      setStatus('Не удалось отправить. Попробуйте ещё раз или свяжитесь по телефону.', false);
      console.error(err);
    }finally{
      btn.disabled = false;
      btn.textContent = 'Отправить заявку';
    }
  });
}

// Year
document.getElementById('year').textContent = new Date().getFullYear();

// HERO: простая автокарусель только из PNG
// Положи изображения в assets/img/hero/ и укажи их тут:
const HERO_IMAGES = [
  'assets/img/hero/01.png',
  'assets/img/hero/02.png',
  'assets/img/hero/03.png'
  // добавляй/убирай по необходимости
];

function renderHeroCarouselImages(){
  const root = document.getElementById('heroCarousel');
  if(!root || !HERO_IMAGES || !HERO_IMAGES.length) return;

  root.innerHTML = '';
  HERO_IMAGES.forEach((src, i) => {
    const slide = document.createElement('div');
    slide.className = 'hero-slide' + (i===0 ? ' is-active' : '');

    const img = document.createElement('img');
    img.alt = 'Изображение продукта МОСАРИЯ';
    img.decoding = 'async';
    img.loading = 'eager';
    img.src = src;
    img.onerror = () => { console.warn('Нет файла:', src); img.src = 'assets/img/og.jpg'; };

    slide.appendChild(img);
    root.appendChild(slide);
  });

  const slides = [...root.querySelectorAll('.hero-slide')];
  let i = 0;
  setInterval(() => {
    slides[i].classList.remove('is-active');
    i = (i + 1) % slides.length;
    slides[i].classList.add('is-active');
  }, 3500);
}

document.addEventListener('DOMContentLoaded', () => {
  renderHeroCarouselImages();
  console.log('Hero slides:', document.querySelectorAll('.hero-slide').length);
});
