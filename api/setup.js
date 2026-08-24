import { db, json, readJson, hashPassword, makeSession, sessionCookie } from './_lib.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const { setupCode, password } = await readJson(req);
    const expectedSetupCode = process.env.APP_SETUP_CODE || process.env.SETUP_CODE;
    if (!expectedSetupCode || setupCode !== expectedSetupCode) return json(res, 403, { error: 'Setup code is incorrect' });
    if (typeof password !== 'string' || password.length < 6) return json(res, 400, { error: 'Use a PIN/password of at least 6 characters' });
    const sql = db();
    const exists = await sql`SELECT 1 FROM gm_owner WHERE id=1`;
    if (exists.length) return json(res, 409, { error: 'App is already set up' });
    const { salt, hash } = hashPassword(password);
    await sql`INSERT INTO gm_owner (id,password_salt,password_hash) VALUES (1,${salt},${hash})`;
    await sql`INSERT INTO gm_state (owner_id) VALUES (1) ON CONFLICT (owner_id) DO NOTHING`;
    const token = makeSession();
    json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(token) });
  } catch (e) {
    json(res, 500, { error: 'Setup failed', detail: e.message });
  }
}
