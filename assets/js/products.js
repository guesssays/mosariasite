/* Simple products dataset (can be replaced with CMS later) */
const PRODUCTS = [
  // Пельмени
  { id:'p1', title:'Пельмени «Домашние» (ручная лепка)', cat:'pelmeni', weight:'900 г', price:'42 000 сум', desc:'Говядина/свинина 70/30, луковая зажарка.' },
  { id:'p2', title:'Пельмени «Классические» (ручная лепка)', cat:'pelmeni', weight:'900 г', price:'39 000 сум', desc:'Тонкое тесто, сочный фарш.' },

  // Манты
  { id:'p3', title:'Манты с говядиной (ручная лепка)', cat:'manti', weight:'800 г', price:'47 000 сум', desc:'Тонкое тесто, специи, сочная начинка.' },
  { id:'p4', title:'Манты с тыквой (ручная лепка)', cat:'manti', weight:'800 г', price:'45 000 сум', desc:'Нежная тыква, лёгкие специи.' },

  // Вареники
  { id:'p5', title:'Вареники с картофелем (ручная лепка)', cat:'vareniki', weight:'800 г', price:'33 000 сум', desc:'Картофель, поджаренный лук.' },
  { id:'p6', title:'Вареники с творогом (ручная лепка)', cat:'vareniki', weight:'800 г', price:'36 000 сум', desc:'Натуральный творог, сахар по вкусу.' },

  // Котлеты
  { id:'p7', title:'Котлеты «Домашние» (ручная формовка)', cat:'cutlets', weight:'700 г', price:'36 000 сум', desc:'Натуральный фарш, хрустящая корочка.' },
  { id:'p8', title:'Котлеты куриные (ручная формовка)', cat:'cutlets', weight:'700 г', price:'34 000 сум', desc:'Филе курицы, панировка.' }
];

function el(tag, attrs={}, ...children){
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => {
    if(k === 'class') node.className = v;
    else if(k.startsWith('data-')) node.setAttribute(k, v);
    else node[k] = v;
  });
  children.forEach(ch => {
    if(typeof ch === 'string') node.appendChild(document.createTextNode(ch));
    else if(ch) node.appendChild(ch);
  });
  return node;
}

function renderProducts(filter='all'){
  const grid = document.getElementById('productsGrid');
  grid.innerHTML = '';
  const items = PRODUCTS.filter(p => filter==='all' || p.cat===filter);
  items.forEach(p => {
    const card = el('article', {class:'card', 'data-id':p.id, 'data-cat':p.cat});
    const img = el('div', {class:'card__img'}, el('div', {class:'ph', ariaHidden:'true'}));
    const body = el('div', {class:'card__body'});
    body.append(
      el('h3', {class:'card__title'}, p.title),
      el('div', {class:'card__meta'}, `${p.weight} • ${p.desc}`),
    );
    const foot = el('div', {class:'card__foot'});
    foot.append(
      el('div', {class:'price'}, p.price),
      el('a', {href:'#lead', class:'btn btn--light', onclick:(e)=>{
        const select = document.querySelector('[name="category"]');
        if(select) select.value = catToTitle(p.cat);
      }}, 'Заказать')
    );
    body.appendChild(foot);
    card.append(img, body);
    grid.appendChild(card);
  });
}

function catToTitle(cat){
  return {
    pelmeni:'Пельмени',
    manti:'Манты',
    vareniki:'Вареники',
    cutlets:'Котлеты'
  }[cat] || 'Пельмени';
}

document.addEventListener('DOMContentLoaded', () => {
  renderProducts('all');
});
