// db.js — couche base de données (PostgreSQL / Neon)
// Si DATABASE_URL n'est pas défini, la base est désactivée (le jeu fonctionne quand même,
// mais les comptes sont indisponibles). Toutes les fonctions renvoient alors null/[]/false.
import pg from 'pg';

const { Pool } = pg;
const URL = process.env.DATABASE_URL || '';

let pool = null;
export const dbEnabled = () => !!pool;

if (URL) {
  pool = new Pool({
    connectionString: URL,
    // Neon exige le SSL ; on accepte le certificat managé.
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
  pool.on('error', (e) => console.error('  ⚠️  Erreur pool Postgres :', e.message));
} else {
  console.warn('  ⚠️  DATABASE_URL absent → comptes désactivés (le jeu reste jouable).');
}

// Crée les tables si elles n'existent pas encore.
export async function initSchema() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      TEXT NOT NULL,
      username_lower TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'player',
      permissions   JSONB NOT NULL DEFAULT '[]'::jsonb,
      banned        BOOLEAN NOT NULL DEFAULT false,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_ip       TEXT,
      last_login    TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  `);
  console.log('  ✓ Schéma base de données prêt (users, sessions)');
}

export async function getUserByName(username) {
  if (!pool) return null;
  const r = await pool.query('SELECT * FROM users WHERE username_lower = $1', [String(username).toLowerCase()]);
  return r.rows[0] || null;
}

export async function getUserById(id) {
  if (!pool) return null;
  const r = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return r.rows[0] || null;
}

export async function createUser({ username, passwordHash, role = 'player', permissions = [], ip = null }) {
  if (!pool) return null;
  const r = await pool.query(
    `INSERT INTO users (username, username_lower, password_hash, role, permissions, last_ip, last_login)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, now()) RETURNING *`,
    [username, String(username).toLowerCase(), passwordHash, role, JSON.stringify(permissions), ip]
  );
  return r.rows[0];
}

// Crée le compte owner s'il n'existe pas ; sinon force le rôle owner (et MAJ mot de passe).
export async function upsertOwner({ username, passwordHash, ip = null }) {
  if (!pool) return null;
  const existing = await getUserByName(username);
  if (existing) {
    const r = await pool.query(
      `UPDATE users SET role='owner', permissions='["*"]'::jsonb, banned=false,
        password_hash=$2, last_ip=COALESCE($3, last_ip) WHERE id=$1 RETURNING *`,
      [existing.id, passwordHash, ip]
    );
    return r.rows[0];
  }
  return createUser({ username, passwordHash, role: 'owner', permissions: ['*'], ip });
}

export async function touchLogin(userId, ip) {
  if (!pool) return;
  await pool.query('UPDATE users SET last_login=now(), last_ip=$2 WHERE id=$1', [userId, ip]);
}

export async function setRole(userId, role, permissions) {
  if (!pool) return null;
  const r = await pool.query(
    'UPDATE users SET role=$2, permissions=$3::jsonb WHERE id=$1 RETURNING *',
    [userId, role, JSON.stringify(permissions || [])]
  );
  return r.rows[0] || null;
}

export async function setBanned(userId, banned) {
  if (!pool) return null;
  const r = await pool.query('UPDATE users SET banned=$2 WHERE id=$1 RETURNING *', [userId, !!banned]);
  return r.rows[0] || null;
}

export async function listUsers() {
  if (!pool) return [];
  const r = await pool.query(
    'SELECT id, username, role, permissions, banned, created_at, last_ip, last_login FROM users ORDER BY id ASC'
  );
  return r.rows;
}

// ---- Sessions ----
export async function createSession(token, userId, expiresAt) {
  if (!pool) return;
  await pool.query('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)', [token, userId, expiresAt]);
}

export async function getSessionUser(token) {
  if (!pool || !token) return null;
  const r = await pool.query(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > now()`,
    [token]
  );
  return r.rows[0] || null;
}

export async function deleteSession(token) {
  if (!pool || !token) return;
  await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
}
