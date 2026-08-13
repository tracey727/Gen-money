import { db, json, isAuthed } from './_lib.js';
export default async function handler(req, res) {
  try {
    const sql = db();
    const rows = await sql`SELECT EXISTS (SELECT 1 FROM gm_owner WHERE id=1) AS configured`;
    json(res, 200, { configured: !!rows[0]?.configured, authenticated: isAuthed(req) });
  } catch (e) {
    json(res, 500, { error: 'Database is not ready', detail: e.message });
  }
}
