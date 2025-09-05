// netlify/functions/lead.js

// CORS: по умолчанию открыто. При желании ограничьте доменами.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID; // может быть отрицательным для групп/каналов
const tgApi = (m) => `https://api.telegram.org/bot${BOT_TOKEN}/${m}`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
  }
  if (!BOT_TOKEN || !CHAT_ID) {
    return { statusCode: 500, headers: corsHeaders, body: 'Telegram env is not configured' };
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: corsHeaders, body: 'Bad JSON' }; }

  const name     = (body.name || '').toString().trim();
  const phone    = (body.phone || '').toString().trim();
  const category = (body.category || '').toString().trim();
  const comment  = (body.comment || '').toString().trim();

  const page  = (body.page || '').toString().trim();
  const ref   = (body.ref || '').toString().trim();
  const utm   = body.utm || {};
  const ts    = (body.ts || '').toString().trim();
  const thread = body.message_thread_id ? Number(body.message_thread_id) : undefined;

  if (!phone && !name) {
    return { statusCode: 422, headers: corsHeaders, body: 'name or phone is required' };
  }

  const esc = (s) => String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  const utmText = utm && Object.keys(utm).length
    ? Object.entries(utm).map(([k,v]) => `${k}: ${v}`).join('\n')
    : '';

  const lines = [
    '🆕 <b>Новая заявка</b>',
    name     ? `👤 Имя: <b>${esc(name)}</b>` : null,
    phone    ? `📞 Телефон: <b>${esc(phone)}</b>` : null,
    category ? `📦 Категория: <b>${esc(category)}</b>` : null,
    comment  ? `💬 Комментарий: ${esc(comment)}` : null,
    page     ? `🔗 Страница: <code>${esc(page)}</code>` : null,
    ref      ? `↩️ Реферер: <code>${esc(ref)}</code>` : null,
    utmText  ? `🏷️ UTM:\n${esc(utmText)}` : null,
    ts       ? `🕒 Время: ${esc(ts)}` : null,
  ].filter(Boolean);

  const payload = {
    chat_id: CHAT_ID,
    text: lines.join('\n'),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
  if (Number.isInteger(thread)) payload.message_thread_id = thread;

  try {
    const r = await fetch(tgApi('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await r.json().catch(()=>({}));
    if (!r.ok || !json.ok) {
      console.error('Telegram error:', json);
      return { statusCode: 502, headers: corsHeaders, body: 'Telegram error' };
    }
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error('sendMessage failed', e);
    return { statusCode: 500, headers: corsHeaders, body: 'Internal Error' };
  }
};
