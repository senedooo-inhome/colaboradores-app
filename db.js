// db.js — sqlite3 com coluna 'status' e migração leve
const path = require('path');
const fs   = require('fs');
const sqlite3 = require('sqlite3').verbose();

function pickDbPath(){
  // Render: usa /data se existir, senão /tmp
  const candidate1 = '/data/database.sqlite';
  const candidate2 = '/tmp/database.sqlite';
  try {
    fs.mkdirSync('/data', { recursive: true });
    return candidate1;
  } catch (e) {
    return candidate2;
  }
}
const DB_PATH = process.env.DB_PATH || pickDbPath();
console.log('[DB] Usando banco em:', DB_PATH);

const db = new sqlite3.Database(DB_PATH);

// Promises helpers
const run = (sql, params=[]) => new Promise((resolve, reject)=>{
  db.run(sql, params, function(err){ if(err) return reject(err); resolve(this); });
});
const getP = (sql, params=[]) => new Promise((resolve, reject)=>{
  db.get(sql, params, (err,row)=>{ if(err) return reject(err); resolve(row); });
});
const allP = (sql, params=[]) => new Promise((resolve, reject)=>{
  db.all(sql, params, (err,rows)=>{ if(err) return reject(err); resolve(rows); });
});

// init + migração
const init = async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS colaboradores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome   TEXT NOT NULL,
      logado INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ativo'
    )
  `);

  // migrações simples: se não tiver coluna 'status', adiciona
  const info = await allP(`PRAGMA table_info(colaboradores)`);
  const hasStatus = info.some(c => c.name === 'status');
  if (!hasStatus) {
    await run(`ALTER TABLE colaboradores ADD COLUMN status TEXT NOT NULL DEFAULT 'ativo'`);
  }

  await run(`
    CREATE TABLE IF NOT EXISTS ferias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      mes  INTEGER NOT NULL
    )
  `);
};

// CRUD colaboradores
const all = () => allP('SELECT * FROM colaboradores ORDER BY id DESC');
const get  = (id) => getP('SELECT * FROM colaboradores WHERE id = ?', [id]);

const create = async (nome, status='ativo') => {
  const info = await run('INSERT INTO colaboradores (nome, logado, status) VALUES (?,0,?)', [nome, status]);
  return get(info.lastID);
};

const update = async (id, nome, status) => {
  if (typeof status === 'string' && status.length > 0) {
    await run('UPDATE colaboradores SET nome = ?, status = ? WHERE id = ?', [nome, status, id]);
  } else {
    await run('UPDATE colaboradores SET nome = ? WHERE id = ?', [nome, id]);
  }
  return get(id);
};

const remove = (id) => run('DELETE FROM colaboradores WHERE id = ?', [id]);
const setLogado = (id, logado) => run('UPDATE colaboradores SET logado = ? WHERE id = ?', [logado ? 1 : 0, id]);
const countLogados = async () => { const row = await getP('SELECT COUNT(*) AS c FROM colaboradores WHERE logado = 1'); return row?.c ?? 0; };
const listLogados = () => allP('SELECT * FROM colaboradores WHERE logado = 1 ORDER BY id DESC');

const bulkSet = async (ids=[]) => {
  await run('UPDATE colaboradores SET logado = 0');
  for (const id of ids) await run('UPDATE colaboradores SET logado = 1 WHERE id = ?', [id]);
};

// férias (agenda)
const feriasAll = () => allP('SELECT * FROM ferias ORDER BY mes, nome');
const feriasCreate = async (nome, mes) => {
  const info = await run('INSERT INTO ferias (nome, mes) VALUES (?,?)', [nome, mes]);
  return getP('SELECT * FROM ferias WHERE id = ?', [info.lastID]);
};

module.exports = {
  init,
  all,
  get,
  create,
  update,
  remove,
  setLogado,
  countLogados,
  listLogados,
  bulkSet,
  // férias
  feriasAll,
  feriasCreate,
};