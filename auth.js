// auth.js — mots de passe (scrypt), rôles, permissions, résolution d'identité.
import crypto from 'crypto';
import * as db from './db.js';

// ---- Rôles & permissions ----
// '*' = toutes les permissions. L'owner a tout, toujours.
export const ROLE_PERMS = {
  owner:     ['*'],
  admin:     ['play', 'edit_maps', 'edit_murder_map', 'manage_users', 'kick', 'ban', 'admin_panel'],
  moderator: ['play', 'kick', 'admin_panel'],
  player:    ['play'],
};
export const ROLES = Object.keys(ROLE_PERMS);

// Permissions effectives = permissions du rôle + permissions sur-mesure du compte.
export function effectivePerms(user) {
  if (!user) return [];
  const base = ROLE_PERMS[user.role] || ROLE_PERMS.player;
  const extra = Array.isArray(user.permissions) ? user.permissions : [];
  return [...new Set([...base, ...extra])];
}

export function hasPerm(user, perm) {
  if (!user) return false;
  if (user.role === 'owner') return true;
  const perms = effectivePerms(user);
  return perms.includes('*') || perms.includes(perm);
}

// Vue publique d'un utilisateur (jamais le hash de mot de passe).
export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    permissions: effectivePerms(user),
    banned: !!user.banned,
    viaIp: !!user.viaIp,
  };
}

// ---- Mots de passe (scrypt intégré à Node, aucune dépendance native) ----
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(pw, stored) {
  try {
    const [scheme, salt, hash] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const test = crypto.scryptSync(String(pw), salt, 64).toString('hex');
    const a = Buffer.from(hash, 'hex'), b = Buffer.from(test, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

export const newToken = () => crypto.randomBytes(32).toString('hex');
export const SESSION_DAYS = 30;
export function sessionExpiry() {
  // 30 jours à partir de maintenant.
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

// ---- Helpers requête HTTP ----
// Normalise une IP : retire le préfixe IPv4-mappé IPv6 (::ffff:1.2.3.4 → 1.2.3.4).
export function normIp(ip) {
  if (!ip) return '';
  ip = String(ip).trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  return ip;
}

export function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return normIp(String(xf).split(',')[0]);
  return normIp(req.socket && req.socket.remoteAddress);
}

export function bearerToken(req) {
  const h = req.headers['authorization'] || '';
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  // sinon cookie "session=..."
  const cookie = req.headers['cookie'] || '';
  const m = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

// IP de l'owner reconnue automatiquement (bonus). Définie via OWNER_IP.
const OWNER_IP = (process.env.OWNER_IP || '').trim();
const OWNER_NAME = (process.env.OWNER_USERNAME || 'owner').trim();

// Résout l'utilisateur courant à partir d'une requête.
// 1) jeton de session valide  2) sinon, IP == OWNER_IP → owner « bonus ».
export async function resolveUser(req) {
  const token = bearerToken(req);
  if (token) {
    const u = await db.getSessionUser(token);
    if (u && !u.banned) return u;
  }
  if (OWNER_IP && clientIp(req) === normIp(OWNER_IP)) {
    // Identité owner synthétique (sans compte requis), pour le confort.
    return { id: -1, username: OWNER_NAME, role: 'owner', permissions: ['*'], banned: false, viaIp: true };
  }
  return null;
}

// Résout depuis un simple jeton (utilisé par le WebSocket).
export async function resolveToken(token) {
  if (!token) return null;
  const u = await db.getSessionUser(token);
  return (u && !u.banned) ? u : null;
}
