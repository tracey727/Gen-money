import { json, clearSessionCookie } from './_lib.js';
export default async function handler(req, res) {
  json(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie() });
}
