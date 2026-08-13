import { db, json, readJson, verifyPassword, makeSession, sessionCookie } from './_lib.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const { password } = await readJson(req);
    const sql = db();
    const rows = await sql`SELECT password_salt,password_hash FROM gm_owner WHERE id=1`;
    if (!rows.length || !verifyPassword(String(password || ''), rows[0].password_salt, rows[0].password_hash)) {
      return json(res, 401, { error: 'Incorrect PIN/password' });
    }
    const token = makeSession();
    json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(token) });
  } catch (e) {
    json(res, 500, { error: 'Login failed', detail: e.message });
  }
}
