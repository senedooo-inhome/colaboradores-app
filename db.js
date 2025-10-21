// db.js
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const DB_PATH = process.env.RENDER ? '/data/database.sqlite' : path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(DB_PATH);

const run = (sql, params = []) => new Promise((res, rej) => {
  db.run(sql, params, function (err) { if (err) rej(err); else res(this); });
});
const get = (sql, params = []) => new Promise((res, rej) => {
  db.get(sql, params, (err, row) => err ? rej(err) : res(row));
});
const all = (sql, params = []) => new Promise((res, rej) => {
  db.all(sql, params, (err, rows) => err ? rej(err) : res(rows));
});

const init = async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS colaboradores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ativo',
      logado INTEGER NOT NULL DEFAULT 0
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS ferias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      mes INTEGER NOT NULL
    )
  `);
};

const allColab = () => all('SELECT * FROM colaboradores ORDER BY id DESC');
const getColab = (id) => get('SELECT * FROM colaboradores WHERE id = ?', [id]);
const create = async (nome, status = 'ativo') => {
  const info = await run('INSERT INTO colaboradores (nome, status, logado) VALUES (?, ?, 0)', [nome, status]);
  return getColab(info.lastID);
};
const update = async (id, nome, status = 'ativo') => {
  await run('UPDATE colaboradores SET nome = ?, status = ? WHERE id = ?', [nome, status, id]);
  return getColab(id);
};
const remove = (id) => run('DELETE FROM colaboradores WHERE id = ?', [id]);
const setLogado = (id, logado) => run('UPDATE colaboradores SET logado = ? WHERE id = ?', [logado ? 1 : 0, id]);
const countLogados = async () => (await get('SELECT COUNT(*) AS c FROM colaboradores WHERE logado = 1')).c || 0;
const listLogados = () => all('SELECT * FROM colaboradores WHERE logado = 1 ORDER BY id DESC');
const bulkSet = async (ids = []) => {
  await run('UPDATE colaboradores SET logado = 0');
  for (const id of ids) await run('UPDATE colaboradores SET logado = 1 WHERE id = ?', [id]);
};
const resetLogados = () => run('UPDATE colaboradores SET logado = 0');

/* férias */
const feriasAll = () => all('SELECT * FROM ferias ORDER BY mes ASC, id DESC');
const feriasCreate = async (nome, mes) => {
  const r = await run('INSERT INTO ferias (nome, mes) VALUES (?, ?)', [nome, Number(mes)]);
  return get('SELECT * FROM ferias WHERE id = ?', [r.lastID]);
};
const feriasRemove = (id) => run('DELETE FROM ferias WHERE id = ?', [id]);

module.exports = {
  init,
  all: allColab,
  get: getColab,
  create,
  update,
  remove,
  setLogado,
  countLogados,
  listLogados,
  bulkSet,
  resetLogados,
  feriasAll,
  feriasCreate,
  feriasRemove,
};
