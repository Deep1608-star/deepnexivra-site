const ALLOWED_FUNCTIONS = new Set(['REVENUE','MARKETING','PROJECTS','PRODUCT','FINANCE','PEOPLE','SUPPLY','SERVICE','SYSTEMS']);
const DEFAULT_TO_EMAIL = 'deepnexivra@gmail.com';

const clean = (value, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const emailOk = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ ok: false, error: 'invalid_json' }); }
  }
  body = body && typeof body === 'object' ? body : {};

  // Honeypot: legitimate visitors never fill this field.
  if (clean(body.website, 200)) return res.status(200).json({ ok: true });

  const payload = {
    function: clean(body.function, 32).toUpperCase(),
    problem: clean(body.problem, 2200),
    companySize: clean(body.companySize, 40),
    urgency: clean(body.urgency, 60),
    name: clean(body.name, 100),
    email: clean(body.email, 160).toLowerCase(),
    company: clean(body.company, 140),
    signal: clean(body.signal, 240),
    requestConversation: body.requestConversation === true,
    consent: body.consent === true
  };

  if (!ALLOWED_FUNCTIONS.has(payload.function) || payload.problem.length < 30 || !payload.companySize || !payload.urgency || !payload.name || !payload.company || !emailOk(payload.email) || !payload.consent) {
    return res.status(400).json({ ok: false, error: 'invalid_submission' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.OPERATING_ROOM_TO_EMAIL || DEFAULT_TO_EMAIL;
  const fromEmail = process.env.OPERATING_ROOM_FROM_EMAIL;
  const bookingUrl = process.env.OPERATING_ROOM_BOOKING_URL || null;

  if (!apiKey || !fromEmail) {
    return res.status(503).json({ ok: false, error: 'delivery_not_configured' });
  }

  const recipients = toEmail.split(',').map((item) => item.trim()).filter(Boolean);
  if (!recipients.length) return res.status(503).json({ ok: false, error: 'delivery_not_configured' });

  const subject = `[Operating Room] ${payload.company} · ${payload.function}`;
  const text = [
    'NEW DEEP NEXIVRA OPERATING ROOM CASE',
    '',
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Company: ${payload.company}`,
    `Company size: ${payload.companySize}`,
    `Operating area: ${payload.function}`,
    `Urgency: ${payload.urgency}`,
    `Private conversation requested: ${payload.requestConversation ? 'Yes' : 'No'}`,
    payload.signal ? `Operating Room signal: ${payload.signal}` : '',
    '',
    'Problem:',
    payload.problem
  ].filter((line) => line !== '').join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#111827">
      <p style="font-size:12px;letter-spacing:.12em;color:#64748b">DEEP NEXIVRA · OPERATING ROOM</p>
      <h2 style="margin:8px 0 24px">New operating case</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px 0;color:#64748b">Name</td><td>${escapeHtml(payload.name)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Email</td><td>${escapeHtml(payload.email)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Company</td><td>${escapeHtml(payload.company)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Company size</td><td>${escapeHtml(payload.companySize)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Operating area</td><td>${escapeHtml(payload.function)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Urgency</td><td>${escapeHtml(payload.urgency)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Private conversation</td><td>${payload.requestConversation ? 'Requested' : 'Not requested'}</td></tr>
        ${payload.signal ? `<tr><td style="padding:8px 0;color:#64748b;vertical-align:top">Selected signal</td><td>${escapeHtml(payload.signal)}</td></tr>` : ''}
      </table>
      <div style="margin-top:26px;padding:20px;border:1px solid #e2e8f0;background:#f8fafc">
        <p style="margin:0 0 8px;font-size:12px;color:#64748b">THE PROBLEM</p>
        <p style="margin:0;white-space:pre-wrap;line-height:1.6">${escapeHtml(payload.problem)}</p>
      </div>
    </div>`;

  try {
    const delivery = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: recipients,
        reply_to: payload.email,
        subject,
        text,
        html
      })
    });

    if (!delivery.ok) {
      return res.status(502).json({ ok: false, error: 'delivery_failed' });
    }

    return res.status(200).json({ ok: true, bookingUrl });
  } catch {
    return res.status(502).json({ ok: false, error: 'delivery_failed' });
  }
};