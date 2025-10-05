// netlify/functions/lead.js

// ---------- CORS ----------
const ORIGINS = (process.env.ALLOWED_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const isAllowedOrigin = (o) => ORIGINS.length === 0 || ORIGINS.includes(o);

const baseCors = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};
const withCors = (origin) => ({
  ...baseCors,
  'Access-Control-Allow-Origin': origin && isAllowedOrigin(origin) ? origin : '*',
});

// ---------- ENV ----------
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID; // может быть отрицательным
const tgApi = (m) => `https://api.telegram.org/bot${BOT_TOKEN}/${m}`;

// ---------- Utils ----------
const clamp = (s, n) => (s || '').toString().slice(0, n);
const trim  = (s) => (s || '').toString().trim();
const esc   = (s) => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  .replace(/'/g,'&#039;');

const getIP = (headers) =>
  headers['x-forwarded-for']?.split(',')[0]?.trim() ||
  headers['client-ip'] || headers['cf-connecting-ip'] ||
  headers['x-real-ip'] || '';

function json(statusCode, headers, bodyObj){
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
    body: JSON.stringify(bodyObj, null, 2),
  };
}

// ---------- Anti-spam heuristics (простые, без внешних сервисов) ----------
function isSpamLike({ comment, hp, tsClient, nowISO }){
  // honeypot
  if (hp) return 'honeypot filled';
  // слишком много ссылок/упоминаний
  const text = (comment || '').toLowerCase();
  const links = (text.match(/https?:\/\//g) || []).length;
  const at    = (text.match(/@/g) || []).length;
  if (links >= 2 || at >= 4) return 'suspicious links/mentions';
  // очень быстрый сабмит относительно client ts (если передан)
  if (tsClient && nowISO){
    const dt = Math.abs(Date.parse(nowISO) - Date.parse(tsClient));
    if (!Number.isNaN(dt) && dt < 700) return 'too fast submit';
  }
  return false;
}

// ---------- Handler ----------
exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const corsHeaders = withCors(origin);

  // Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, corsHeaders, { ok:false, error:'Method Not Allowed' });
  }

  if (!BOT_TOKEN || !CHAT_ID) {
    return json(500, corsHeaders, { ok:false, error:'Telegram env is not configured' });
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); }
  catch {
    return json(400, corsHeaders, { ok:false, error:'Bad JSON' });
  }

  // ------- Parse & normalize -------
  const nowISO   = new Date().toISOString();
  const nameRaw  = trim(body.name);
  const phoneRaw = trim(body.phone);
  const category = clamp(trim(body.category), 80);
  const comment  = clamp(trim(body.comment), 1200); // ограничим, чтобы не улетать в лимиты
  const page     = clamp(trim(body.page), 600);
  const ref      = clamp(trim(body.ref), 600);
  const utm      = body.utm && typeof body.utm === 'object' ? body.utm : {};
  const thread   = body.message_thread_id ? Number(body.message_thread_id) : undefined;
  const hp       = trim(body._hp);            // honeypot: на фронте <input name="_hp" autocomplete="off" class="sr-only">
  const tsClient = trim(body.ts);             // как раньше, из фронта

  const name  = clamp(nameRaw, 120);
  const phone = clamp(phoneRaw, 64);
  const phoneClean = phone.replace(/[^\d+]/g, '');

  // Валидация: нужен хотя бы телефон или имя
  if (!phone && !name) {
    return json(422, corsHeaders, { ok:false, error:'name or phone is required' });
  }
  // Телефон «похож» на номер (минимум 9 цифр) — не жёстко, просто подсеть
  const phoneLooksValid = phoneClean.replace(/\D/g,'').length >= 9;

  // Anti-spam
  const spamReason = isSpamLike({ comment, hp, tsClient, nowISO });
  if (spamReason){
    console.warn('[lead] spam-like blocked:', spamReason);
    // Отвечаем 200, чтобы не стимулировать ретраи ботов
    return json(200, corsHeaders, { ok:true });
  }

  // ------- Compose Telegram message -------
  const utmText = utm && Object.keys(utm).length
    ? Object.entries(utm).map(([k,v]) => `${k}: ${v}`).join('\n')
    : '';

  const ip = getIP(event.headers || {});
  const ua = clamp(trim(event.headers?.['user-agent'] || event.headers?.['User-Agent'] || ''), 260);

  const lines = [
    '🆕 <b>Новая заявка</b>',
    name           ? `👤 Имя: <b>${esc(name)}</b>` : null,
    phone          ? `📞 Телефон: <b>${esc(phone)}</b>${phone && !phoneLooksValid ? ' (проверьте формат)' : ''}` : null,
    category       ? `📦 Категория: <b>${esc(category)}</b>` : null,
    comment        ? `💬 Комментарий: ${esc(comment)}` : null,
    page           ? `🔗 Страница: <code>${esc(page)}</code>` : null,
    ref            ? `↩️ Реферер: <code>${esc(ref)}</code>` : null,
    utmText        ? `🏷️ UTM:\n${esc(utmText)}` : null,
    `🕒 Время: ${esc(nowISO)}`,
    ip             ? `🌐 IP: <code>${esc(ip)}</code>` : null,
    ua             ? `🧭 UA: <code>${esc(ua)}</code>` : null,
  ].filter(Boolean);

  // Telegram лимит: 4096 символов
  let text = lines.join('\n');
  if (text.length > 4000) {
    text = text.slice(0, 3990) + '\n…';
  }

  const payload = {
    chat_id: CHAT_ID,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
  if (Number.isInteger(thread)) payload.message_thread_id = thread;

  // ------- Fetch with timeout -------
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000); // 8s
  try {
    const r = await fetch(tgApi('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(t);
    const jsonRes = await r.json().catch(()=> ({}));
    if (!r.ok || !jsonRes.ok) {
      console.error('[lead] Telegram error', { status:r.status, jsonRes });
      return json(502, corsHeaders, { ok:false, error:'Telegram error' });
    }
    return json(200, corsHeaders, { ok:true });
  } catch (e) {
    clearTimeout(t);
    console.error('[lead] sendMessage failed', e?.name || e, e?.message);
    return json(500, corsHeaders, { ok:false, error:'Internal Error' });
  }
};
