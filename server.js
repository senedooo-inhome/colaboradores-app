// server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ---------------- API: Colaboradores ---------------- */
app.get('/api/collaboradores', async (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase();
    const list = await db.all();
    const filtered = q ? list.filter(c => (c.nome || '').toLowerCase().includes(q)) : [];
    res.json(filtered);
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Falha ao listar' });
  }
});

app.post('/api/collaboradores', async (req, res) => {
  try {
    const { nome, status = 'ativo' } = req.body || {};
    if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });
    const novo = await db.create(nome.trim(), status);
    res.status(201).json(novo);
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Falha ao criar' });
  }
});

app.put('/api/collaboradores/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nome, status } = req.body || {};
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });
    if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });
    const updated = await db.update(id, nome.trim(), status || 'ativo');
    if (!updated) return res.status(404).json({ error: 'Não encontrado' });
    res.json(updated);
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Falha ao atualizar' });
  }
});

app.delete('/api/collaboradores/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });
    await db.remove(id);
    res.status(204).end();
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Falha ao remover' });
  }
});

app.post('/api/status', async (req, res) => {
  try {
    const { logados } = req.body || {};
    const ids = Array.isArray(logados) ? logados.map(Number).filter(Number.isFinite) : [];
    await db.bulkSet(ids);
    const total = await db.countLogados();
    res.json({ success: true, totalLogados: total });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Falha ao salvar status' });
  }
});

app.post('/api/logado/:id/:val', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });
    const val = req.params.val === '1' || req.params.val === 'true';
    await db.setLogado(id, val);
    res.json({ success: true });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Falha ao atualizar status' });
  }
});

app.get('/api/ativos', async (req, res) => {
  try {
    res.json({ total: await db.countLogados(), list: await db.listLogados() });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Falha ao listar ativos' });
  }
});

/* ---------------- API: Férias ---------------- */
app.get('/api/ferias', async (req, res) => {
  try {
    const list = await db.feriasAll();
    res.json(list);
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Falha ao listar férias' });
  }
});

app.post('/api/ferias', async (req, res) => {
  try {
    const { nome, mes } = req.body || {};
    if (!nome || !mes) return res.status(400).json({ error: 'Nome e mês são obrigatórios' });
    const saved = await db.feriasCreate(nome.trim(), mes);
    res.status(201).json(saved);
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Falha ao criar férias' });
  }
});

app.delete('/api/ferias/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });
    await db.feriasRemove(id);
    res.status(204).end();
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Falha ao remover férias' });
  }
});

/* ---------------- Export único (CSV) ---------------- */
app.get('/api/export-all.csv', async (req, res) => {
  try {
    const list = await db.all();
    const rows = [
      ['nome', 'status', 'logado'],
      ...list.map(c => [c.nome, c.status || 'ativo', c.logado ? '1' : '0']),
    ];
    const csv = rows.map(r => r.map(s => `"${String(s).replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="colaboradores.csv"');
    res.send(csv);
  } catch (e) {
    console.error(e); res.status(500).send('Falha ao exportar');
  }
});

/* ---------------- Reset diário 00:00 ---------------- */
let ultimoDia = null;
async function resetDiarioSePrecisar() {
  const hoje = new Date().toISOString().slice(0, 10);
  if (ultimoDia && ultimoDia !== hoje) {
    await db.resetLogados();
    console.log('[RESET] Logins zerados para a data', hoje);
  }
  ultimoDia = hoje;
}
setInterval(resetDiarioSePrecisar, 60 * 1000);

/* ---------------- Boot ---------------- */
(async () => {
  await db.init();
  await resetDiarioSePrecisar();
  app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
})();
