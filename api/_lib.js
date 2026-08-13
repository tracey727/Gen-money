import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

export function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  return neon(process.env.DATABASE_URL);
}

export function json(res, status, body, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  if (raw.length > 2_000_000) throw new Error('Request too large');
  return JSON.parse(raw);
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(value) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

export function makeSession() {
  const payload = JSON.stringify({ uid: 1, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 });
  const encoded = b64url(payload);
  return `${encoded}.${sign(encoded)}`;
}

export function isAuthed(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)gm_session=([^;]+)/);
  if (!match) return false;
  const token = decodeURIComponent(match[1]);
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.uid === 1 && data.exp > Date.now();
  } catch {
    return false;
  }
}

export function sessionCookie(token) {
  const secure = process.env.VERCEL_ENV ? '; Secure' : '';
  return `gm_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${secure}`;
}

export function clearSessionCookie() {
  const secure = process.env.VERCEL_ENV ? '; Secure' : '';
  return `gm_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, expectedHex) {
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function saneState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
  for (const k of ['transactions','subscriptions','accounts']) {
    if (state[k] != null && !Array.isArray(state[k])) return false;
  }
  return JSON.stringify(state).length <= 1_500_000;
}
