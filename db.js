// db.js — inicializa banco SQLite e expõe operações
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Diretório do banco com fallback inteligente:
// 1) DATA_DIR (env)  2) /data (quando você tiver Disk)  3) /tmp (free/ephemeral)
const baseDir = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : '/tmp');
fs.mkdirSync(baseDir, { recursive: true });

const DB_PATH = path.join(baseDir, 'database.sqlite');
console.log('[DB] Usando banco em:', DB_PATH);

const db = new sqlite3.Database(DB_PATH);

// Helpers em Promise
const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });

const getP = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });

const allP = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

// Cria tabelas (ajuste seus campos conforme já tinha)
const init = async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS colaboradores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      logado INTEGER NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'ativo'
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

// ...demais funções (all, get, create, update, remove, etc) ficam iguais

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
  // inclua os exports de "ferias" se você já tem
};
