const TO = 'info@primeinnovation.in';
const FROM = 'Prime Innovation <info@primeinnovation.in>'; // use 'onboarding@resend.dev' for testing
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = ['pdf','jpg','jpeg','png','doc','docx','xls','xlsx','csv','zip'];

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
const clean = v => String(v || '').replace(/[\r\n]+/g, ' ').trim();
const esc = v => String(v || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'Invalid request' }, 405);
  try {
    const f = await req.formData();
    if (f.get('website')) return json({ ok: true }); // spam trap

    const name = clean(f.get('name')), phone = clean(f.get('phone'));
    const email = clean(f.get('email')), service = clean(f.get('service'));
    const message = String(f.get('message') || '').trim();
    if (!name || !phone || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return json({ ok: false, error: 'Please fill in name, mobile and a valid email.' }, 400);

    const attachments = []; let total = 0;
    for (const file of f.getAll('documents[]')) {
      if (!file || !file.name || !file.size) continue;
      const ext = file.name.split('.').pop().toLowerCase();
      if (!ALLOWED.includes(ext)) return json({ ok: false, error: `File type .${ext} is not allowed.` }, 400);
      total += file.size;
      if (total > MAX_BYTES) return json({ ok: false, error: 'Files are too large (max 4 MB total). Please email them to us.' }, 400);
      attachments.push({
        filename: file.name.replace(/[^A-Za-z0-9._-]/g, '_'),
        content: Buffer.from(await file.arrayBuffer()).toString('base64')
      });
    }

    const html = `<h3>New website query</h3>
      <p><b>Name:</b> ${esc(name)}<br><b>Mobile:</b> ${esc(phone)}<br>
      <b>Email:</b> ${esc(email)}<br><b>Service:</b> ${esc(service)}</p>
      <p><b>Message:</b><br>${esc(message).replace(/\n/g, '<br>')}</p>`;

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [TO], reply_to: email, subject: `New Query: ${service} - ${name}`, html, attachments })
    });
    if (!r.ok) return json({ ok: false, error: 'Could not send right now.' }, 502);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: 'Something went wrong.' }, 500);
  }
};

export const config = { path: '/api/send' };