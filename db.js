// db.js — SQLite com fallback de diretório (/data → /tmp) e CRUD completo
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Diretório do banco com fallback inteligente:
// 1) DATA_DIR (env)  2) /data (se existir)  3) /tmp (Render Free)
const baseDir = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : '/tmp');
fs.mkdirSync(baseDir, { recursive: true });

const DB_PATH = path.join(baseDir, 'database.sqlite');
console.log('[DB] Usando banco em:', DB_PATH);

// Abre/cria o arquivo do banco
const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);

// Helpers Promisified
const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this); // this.lastID, this.changes
    });
  });

const getP = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });

const allP = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

// Schema
const init = async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS colaboradores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome   TEXT NOT NULL,
      logado INTEGER NOT NULL DEFAULT 0,
      status TEXT  DEFAULT 'ativo' -- ativo | ferias | atestado
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS ferias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      mes  INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12)
    )
  `);
};

// ------- Colaboradores -------
const all = () =>
  allP('SELECT id, nome, logado, status FROM colaboradores ORDER BY id DESC');

const get = (id) =>
  getP('SELECT id, nome, logado, status FROM colaboradores WHERE id = ?', [id]);

const create = async (nome) => {
  const info = await run(
    'INSERT INTO colaboradores (nome, logado, status) VALUES (?, 0, "ativo")',
    [nome]
  );
  return get(info.lastID);
};

const update = async (id, nome) => {
  await run('UPDATE colaboradores SET nome = ? WHERE id = ?', [nome, id]);
  return get(id);
};

const remove = (id) =>
  run('DELETE FROM colaboradores WHERE id = ?', [id]);

const setLogado = (id, logado) =>
  run('UPDATE colaboradores SET logado = ? WHERE id = ?', [logado ? 1 : 0, id]);

const setStatus = (id, status) =>
  run('UPDATE colaboradores SET status = ? WHERE id = ?', [status, id]);

const countLogados = async () => {
  const row = await getP('SELECT COUNT(*) AS c FROM colaboradores WHERE logado = 1');
  return row?.c ?? 0;
};

const listLogados = () =>
  allP('SELECT id, nome, logado, status FROM colaboradores WHERE logado = 1 ORDER BY id DESC');

const bulkSet = async (ids = []) => {
  await run('UPDATE colaboradores SET logado = 0'); // zera todos
  for (const id of ids) {
    await run('UPDATE colaboradores SET logado = 1 WHERE id = ?', [id]); // liga selecionados
  }
};

// ------- Férias -------
const feriasAll = () =>
  allP('SELECT id, nome, mes FROM ferias ORDER BY mes ASC, nome ASC');

const feriasAdd = (nome, mes) =>
  run('INSERT INTO ferias (nome, mes) VALUES (?, ?)', [nome, mes]);

const feriasClear = () =>
  run('DELETE FROM ferias');

// Exports
module.exports = {
  DB_PATH,
  init,
  // colaboradores
  all,
  get,
  create,
  update,
  remove,
  setLogado,
  setStatus,
  countLogados,
  listLogados,
  bulkSet,
  // ferias
  feriasAll,
  feriasAdd,
  feriasClear,
};
