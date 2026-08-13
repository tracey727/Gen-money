import { db, json, readJson, isAuthed, saneState } from './_lib.js';
export default async function handler(req, res) {
  if (!isAuthed(req)) return json(res, 401, { error: 'Not signed in' });
  try {
    const sql = db();
    if (req.method === 'GET') {
      const rows = await sql`SELECT state,revision,updated_at FROM gm_state WHERE owner_id=1`;
      return json(res, 200, rows[0] || { state: {}, revision: 0 });
    }
    if (req.method === 'PUT') {
      const { state, revision } = await readJson(req);
      if (!saneState(state)) return json(res, 400, { error: 'Invalid app data' });
      const rev = Number.isFinite(Number(revision)) ? Number(revision) : 0;
      const encoded = JSON.stringify(state);
      const rows = await sql`
        UPDATE gm_state
        SET state=${encoded}::jsonb, revision=revision+1, updated_at=now()
        WHERE owner_id=1 AND revision=${rev}
        RETURNING revision,updated_at
      `;
      if (!rows.length) return json(res, 409, { error: 'A newer copy exists. Reload before saving.' });
      return json(res, 200, rows[0]);
    }
    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    json(res, 500, { error: 'Save failed', detail: e.message });
  }
}
