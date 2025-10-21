const express = require('express');
const path = require('path');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ===================== API: Colaboradores ===================== */

// Listar (com busca opcional ?q=)
app.get('/api/collaboradores', async (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase();
    const list = await db.all();
    const filtered = q
      ? list.filter(c => (c.nome || '').toLowerCase().includes(q))
      : list;
    res.json(filtered);
  } catch (err) {
    console.error('GET /api/collaboradores ->', err);
    res.status(500).json({ error: 'Falha ao listar colaboradores' });
  }
});

// Criar (com status)
app.post('/api/collaboradores', async (req, res) => {
  try {
    const { nome, status } = req.body || {};
    if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });

    const allowed = new Set(['ativo','ferias','atestado','folga']);
    const st = allowed.has((status || '').toLowerCase()) ? status.toLowerCase() : 'ativo';

    const novo = await db.create(nome.trim(), st);
    res.status(201).json(novo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao criar colaborador' });
  }
});

// Atualizar nome e/ou status
app.put('/api/collaboradores/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });

    const { nome, status } = req.body || {};
    if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });

    const allowed = new Set(['ativo','ferias','atestado','folga']);
    const st = allowed.has((status || '').toLowerCase()) ? status.toLowerCase() : undefined;

    const updated = await db.update(id, nome.trim(), st); // st pode ser undefined
    if (!updated) return res.status(404).json({ error: 'Colaborador não encontrado' });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao atualizar colaborador' });
  }
});

// Remover
app.delete('/api/collaboradores/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });

    await db.remove(id);
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /api/collaboradores/:id ->', err);
    res.status(500).json({ error: 'Falha ao remover colaborador' });
  }
});

// Salvar status em lote (logados)
app.post('/api/status', async (req, res) => {
  try {
    const { logados } = req.body || {};
    const ids = Array.isArray(logados) ? logados.map(Number).filter(Number.isFinite) : [];
    await db.bulkSet(ids);
    const total = await db.countLogados();
    res.json({ success: true, totalLogados: total });
  } catch (err) {
    console.error('POST /api/status ->', err);
    res.status(500).json({ error: 'Falha ao salvar status' });
  }
});

// Operações individuais de logado
app.post('/api/logado/:id/:val', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });

    const val = req.params.val === '1' || req.params.val === 'true';
    await db.setLogado(id, val);
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/logado/:id/:val ->', err);
    res.status(500).json({ error: 'Falha ao atualizar status' });
  }
});

// Ativos (para Operação)
app.get('/api/ativos', async (_req, res) => {
  try {
    const total = await db.countLogados();
    const list = await db.listLogados();
    res.json({ total, list });
  } catch (err) {
    console.error('GET /api/ativos ->', err);
    res.status(500).json({ error: 'Falha ao listar ativos' });
  }
});

/* ===================== API: Férias ===================== */

// Listar férias
app.get('/api/ferias', async (_req, res) => {
  try {
    const list = await db.feriasAll();
    res.json(list);
  } catch (err) {
    console.error('GET /api/ferias ->', err);
    res.status(500).json({ error: 'Falha ao listar férias' });
  }
});

// Criar férias
app.post('/api/ferias', async (req, res) => {
  try {
    const { nome, mes } = req.body || {};
    if (!nome || !nome.trim() || !Number(mes)) {
      return res.status(400).json({ error: 'Nome e mês são obrigatórios' });
    }

    const novo = await db.feriasAdd(nome.trim(), Number(mes));
    res.status(201).json(novo);
  } catch (err) {
    console.error('POST /api/ferias ->', err);
    res.status(500).json({ error: 'Falha ao cadastrar férias' });
  }
});

app.listen(PORT, () => {
  console.log(`[server] rodando em http://localhost:${PORT}`);
});