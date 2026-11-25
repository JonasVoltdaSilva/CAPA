import { musicLibrary } from './server-catalog.mjs';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  passwordHash TEXT NOT NULL,
  name TEXT NOT NULL, bio TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '',
  favoriteAlbums TEXT NOT NULL DEFAULT '[]', favoriteArtists TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS sessions (
  hash TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires);
CREATE TABLE IF NOT EXISTS suspensions (
  userId TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS imports (id TEXT PRIMARY KEY, album TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  albumId TEXT NOT NULL, trackId TEXT, date TEXT NOT NULL,
  rating REAL CHECK (rating IS NULL OR (rating BETWEEN .5 AND 5 AND rating*2=CAST(rating*2 AS INTEGER))),
  review TEXT NOT NULL, favorite INTEGER NOT NULL CHECK(favorite IN (0,1)),
  visibility TEXT NOT NULL CHECK(visibility IN ('public','private')),
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS diary_owner ON entries(userId,date DESC);
CREATE INDEX IF NOT EXISTS entry_target ON entries(albumId,trackId,visibility);
CREATE TABLE IF NOT EXISTS likes (
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entryId TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  PRIMARY KEY(userId,entryId)
);
CREATE INDEX IF NOT EXISTS likes_entry ON likes(entryId);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entryId TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE, text TEXT NOT NULL, createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS comment_entry ON comments(entryId);
CREATE TABLE IF NOT EXISTS lists (
  id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT NOT NULL, items TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK(visibility IN ('public','private')),
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS follows (
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  targetId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(userId,targetId)
);
CREATE TABLE IF NOT EXISTS blocks (
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  targetId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(userId,targetId)
);
CREATE INDEX IF NOT EXISTS block_target ON blocks(targetId);
CREATE TABLE IF NOT EXISTS battles (
  id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  albumA TEXT NOT NULL, albumB TEXT NOT NULL, winner TEXT NOT NULL, createdAt TEXT NOT NULL,
  UNIQUE(userId,albumA,albumB)
);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  targetType TEXT NOT NULL, targetId TEXT NOT NULL, reason TEXT NOT NULL, createdAt TEXT NOT NULL,
  UNIQUE(userId,targetType,targetId)
);
CREATE TRIGGER IF NOT EXISTS remove_comment_reports AFTER DELETE ON comments BEGIN
  DELETE FROM reports WHERE targetType='comment' AND targetId=OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS remove_entry_reports AFTER DELETE ON entries BEGIN
  DELETE FROM reports WHERE targetType='entry' AND targetId=OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS remove_user_reports AFTER DELETE ON users BEGIN
  DELETE FROM reports WHERE targetType='user' AND targetId=OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS remove_list_reports AFTER DELETE ON lists BEGIN
  DELETE FROM reports WHERE targetType='list' AND targetId=OLD.id;
END;
`;

export function openStore(filename, seedAlbums = []) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA secure_delete = ON');
  db.exec(schema);
  const statements = new Map();
  function statement(sql) {
    if (!statements.has(sql)) statements.set(sql, db.prepare(sql));
    return statements.get(sql);
  }
  const all = (sql, ...values) => statement(sql).all(...values);
  const get = (sql, ...values) => statement(sql).get(...values);
  const run = (sql, ...values) => statement(sql).run(...values);
  function atomic(work) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  const music = musicLibrary({db,all,get,run,atomic},seedAlbums);
  const catalog = () => music.index;
  function blockedBetween(a,b) {
    if (!a || !b || a === b) return false;
    return Boolean(get('SELECT 1 FROM blocks WHERE (userId=? AND targetId=?) OR (userId=? AND targetId=?)', a,b,b,a));
  }
  const authenticated = token => token && get(
    'SELECT userId AS id FROM sessions WHERE hash=? AND expires>? AND userId NOT IN (SELECT userId FROM suspensions)',
    digest(token), Date.now());
  function issueSession(userId) {
    run('DELETE FROM sessions WHERE expires<=?', Date.now());
    const token = randomBytes(32).toString('base64url');
    run('INSERT INTO sessions VALUES(?,?,?)', digest(token), userId, Date.now() + 30 * 86400000);
    return token;
  }
  const audience = `WITH viewer(id) AS (VALUES (?)), hidden(id) AS (
      SELECT targetId FROM blocks WHERE userId=(SELECT id FROM viewer)
      UNION SELECT userId FROM blocks WHERE targetId=(SELECT id FROM viewer)
      UNION SELECT userId FROM suspensions) `;
  const visibleItems = `userId NOT IN (SELECT id FROM hidden)
      AND (visibility='public' OR userId=(SELECT id FROM viewer))`;
  const related = audience + ` , visible_entries(id) AS (SELECT id FROM entries WHERE ${visibleItems}) `;
  function entry(id,viewer) {
    const row = get(audience + `SELECT * FROM entries WHERE id=? AND ${visibleItems}`,viewer,id);
    if (!row) return null;
    return {...entryRow(row),
      likes: all(audience + 'SELECT userId FROM likes WHERE entryId=? AND userId NOT IN (SELECT id FROM hidden)',viewer,id).map(r=>r.userId),
      comments: all(audience + 'SELECT * FROM comments WHERE entryId=? AND userId NOT IN (SELECT id FROM hidden) ORDER BY createdAt,rowid',viewer,id)};
  }
  function bootstrap(viewerId) {
    const viewer = viewerId ?? null;
    const blockedPeople = all(`SELECT u.id,u.username,u.name FROM blocks b JOIN users u ON b.targetId=u.id
      WHERE b.userId=? AND u.id NOT IN (SELECT userId FROM suspensions) ORDER BY u.username`, viewer);
    const blocked = blockedPeople.map(p=>p.id);
    const people = all(audience + `SELECT id,username,name,bio,(avatar <> '') AS avatar,favoriteAlbums,favoriteArtists
      FROM users WHERE id NOT IN (SELECT id FROM hidden) ORDER BY username`,viewer).map(publicUser);
    const follows = all(audience + `SELECT userId,targetId FROM follows
      WHERE userId NOT IN (SELECT id FROM hidden) AND targetId NOT IN (SELECT id FROM hidden)`,viewer);
    const followersByUser = new Map(), followingByUser = new Map();
    for (const {userId,targetId} of follows) {
      if (!followersByUser.has(targetId)) followersByUser.set(targetId, []);
      if (!followingByUser.has(userId)) followingByUser.set(userId, []);
      followersByUser.get(targetId).push(userId);
      followingByUser.get(userId).push(targetId);
    }
    for (const user of people) {
      user.followers = followersByUser.get(user.id) ?? [];
      user.following = followingByUser.get(user.id) ?? [];
    }
    const entries = all(audience + `SELECT * FROM entries WHERE ${visibleItems} ORDER BY createdAt DESC,rowid DESC`,viewer).map(entryRow);
    const indexed = new Map(entries.map(e => [e.id,e]));
    for (const like of all(related + `SELECT entryId,userId FROM likes WHERE userId NOT IN (SELECT id FROM hidden)
      AND entryId IN (SELECT id FROM visible_entries)`,viewer)) {
      indexed.get(like.entryId)?.likes.push(like.userId);
    }
    for (const c of all(related + `SELECT * FROM comments WHERE userId NOT IN (SELECT id FROM hidden)
      AND entryId IN (SELECT id FROM visible_entries) ORDER BY createdAt,rowid`,viewer)) {
      indexed.get(c.entryId)?.comments.push(c);
    }
    const lists = all(audience + `SELECT * FROM lists WHERE ${visibleItems} ORDER BY createdAt DESC,rowid DESC`,viewer).map(listRow);
    const profile = people.find(p => p.id === viewerId);
    const user = profile ? {...profile,email:get('SELECT email FROM users WHERE id=?',viewerId).email} : null;
    const battles=all('SELECT * FROM battles WHERE userId=? ORDER BY createdAt DESC',viewer);
    const albums=music.forBootstrap({entries,lists,people,battles});
    return {user, albums, people, entries, lists, following: followingByUser.get(viewerId) ?? [],
      followers: followersByUser.get(viewerId) ?? [], follows, blocked, blockedPeople,
      battles};
  }
  return {db,get,all,run,atomic,catalog,music,blockedBetween,authenticated,issueSession,bootstrap,entry};
}

export const digest = text => createHash('sha256').update(text).digest('hex');

export function publicUser(user) {
  return {id:user.id, username:user.username, name:user.name, bio:user.bio,
    avatar:user.avatar ? '/api/people/' + encodeURIComponent(user.id) + '/avatar.png' : '',
    favoriteAlbums:JSON.parse(user.favoriteAlbums), favoriteArtists:JSON.parse(user.favoriteArtists)};
}
export function entryRow(row) {
  return {...row, favorite:Boolean(row.favorite), likes:[], comments:[]};
}
export function listRow(row) {
  return {...row, items:JSON.parse(row.items)};
}


