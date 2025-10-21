// ===== Helpers =====
const api = (path, opts) =>
  fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts })
    .then(r => r.json().catch(() => {}));

const escapeHtml = s =>
  s ? s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) : '';

// ===== Data do dia =====
const dataHojeEl = document.getElementById('data-hoje');
if (dataHojeEl) {
  const dias=['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
  const meses=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const d = new Date();
  dataHojeEl.textContent = `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

// ===== Navegação =====
const views = document.querySelectorAll('.view');
const navBtns = document.querySelectorAll('.nav-btn');
const pageTitle = document.getElementById('page-title');

navBtns.forEach(b => b.addEventListener('click', () => {
  navBtns.forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  views.forEach(v => v.classList.add('hidden'));
  document.getElementById(b.dataset.view).classList.remove('hidden');
  pageTitle.innerText = b.innerText.trim();
  if (b.dataset.view === 'colaboradores') { resetSearchUi(); renderHighlights(); renderFerias(); }
  if (b.dataset.view === 'controle') loadControle();
  if (b.dataset.view === 'operacao') loadOperacao();
}));

// ===== Add menu / modais =====
const overlay = document.getElementById('overlay');
const addBtn = document.getElementById('btn-add');
const addMenu = document.getElementById('add-menu');

function closeMenus(){ addMenu.classList.add('hidden'); }
addBtn.addEventListener('click', (e)=>{ e.stopPropagation(); addMenu.classList.toggle('hidden'); });
document.addEventListener('click', closeMenus);

// modais
const modalAg = document.getElementById('modal-agente');
const modalFer = document.getElementById('modal-ferias');

function openModal(which){
  overlay.classList.remove('hidden');
  (which==='ag') ? modalAg.classList.remove('hidden') : modalFer.classList.remove('hidden');
}
function closeModal(which){
  overlay.classList.add('hidden');
  (which==='ag') ? modalAg.classList.add('hidden') : modalFer.classList.add('hidden');
}
overlay.addEventListener('click', ()=>{ closeModal('ag'); closeModal('fer'); });

document.querySelectorAll('[data-close="agente"]').forEach(b=>b.addEventListener('click', ()=>closeModal('ag')));
document.querySelectorAll('[data-close="ferias"]').forEach(b=>b.addEventListener('click', ()=>closeModal('fer')));

document.getElementById('menu-add-agente').addEventListener('click', ()=>{ closeMenus(); openModal('ag'); });
document.getElementById('menu-add-ferias').addEventListener('click', ()=>{ closeMenus(); openModal('fer'); });

// salvar agente
document.getElementById('agente-save').addEventListener('click', async ()=>{
  const nome = (document.getElementById('agente-nome').value||'').trim();
  if(!nome) return alert('Digite o nome');
  await api('/api/collaboradores', { method:'POST', body: JSON.stringify({ nome }) });
  document.getElementById('agente-nome').value='';
  closeModal('ag');
  resetSearchUi(); renderHighlights(); loadControle(); renderFerias();
});

// salvar férias
document.getElementById('ferias-save').addEventListener('click', async ()=>{
  const nome = (document.getElementById('ferias-nome').value||'').trim();
  const mes = Number(document.getElementById('ferias-mes').value);
  if(!nome || !mes) return alert('Preencha nome e mês');
  await api('/api/ferias', { method:'POST', body: JSON.stringify({ nome, mes }) });
  document.getElementById('ferias-nome').value=''; document.getElementById('ferias-mes').value='';
  closeModal('fer');
  renderFerias();
});

// ===== Export único (logados + não logados) =====
document.getElementById('export-todos').addEventListener('click', ()=>{
  // servidor deve expor /api/export-all.csv
  window.location.href = '/api/export-all.csv';
});

// ===== Busca / Tabela só quando buscar =====
const table = document.getElementById('table');
const tableBody = document.querySelector('#table tbody');
const searchInput = document.getElementById('search');
const searchHint = document.getElementById('search-hint');

function resetSearchUi(){
  table.classList.add('hidden');
  searchHint.classList.remove('hidden');
  tableBody.innerHTML='';
  searchInput.value='';
}

let searchTimeout;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(loadList, 250);
});

async function loadList() {
  const q = (searchInput.value||'').trim();
  if (!q) { resetSearchUi(); return; }

  const list = await api(`/api/collaboradores?q=${encodeURIComponent(q)}`) || [];
  tableBody.innerHTML = list.map(c => `
    <tr data-id="${c.id}">
      <td>${escapeHtml(c.nome)}</td>
      <td>${badgeStatus(c.status)}</td>
      <td>${c.logado ? '<span class="pill pill-green">Logado</span>' : ''}</td>
      <td>
        <button class="btn btn-sm" data-action="edit">✏️</button>
        <button class="btn btn-sm btn-red" data-action="delete">🗑️</button>
      </td>
    </tr>
  `).join('');

  table.classList.remove('hidden');
  searchHint.classList.add('hidden');

  tableBody.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click', async (ev)=>{
      const tr = ev.target.closest('tr'); const id = tr.dataset.id; const act = ev.target.dataset.action;
      if (act==='edit') {
        const novo = prompt('Novo nome:', tr.cells[0].innerText.trim());
        if(novo && novo.trim()) {
          await api(`/api/collaboradores/${id}`, { method:'PUT', body: JSON.stringify({ nome: novo.trim() }) });
          loadList(); renderHighlights(); loadControle(); renderFerias();
        }
      } else if (act==='delete') {
        if (!confirm('Remover colaborador?')) return;
        await fetch(`/api/collaboradores/${id}`, { method:'DELETE' });
        loadList(); renderHighlights(); loadControle(); renderFerias();
      }
   
      }
    });
  });
}

function badgeStatus(status){
  if(status==='ferias')   return '<span class="pill pill-amber">Férias</span>';
  if(status==='atestado') return '<span class="pill pill-red">Atestado</span>';
  return '<span class="pill pill-muted">Ativo</span>';
}

/* ===== Controle (checkbox list) ===== */
const controleList   = document.getElementById('controle-list');
const saveStatusBtn  = document.getElementById('save-status');

async function loadControle() {
  const list = await api('/api/collaboradores') || [];
  controleList.innerHTML = list.map(c => `
    <div class="list-row">
      <label><input type="checkbox" data-id="${c.id}" ${c.logado?'checked':''}/> ${escapeHtml(c.nome)}</label>
      <div>${c.logado?'<span class="pill pill-green">Logado</span>':''}</div>
    </div>
  `).join('');
}

saveStatusBtn.addEventListener('click', async ()=>{
  const checked = [...controleList.querySelectorAll('input[type=checkbox]:checked')].map(i=>i.dataset.id);
  await api('/api/status', { method:'POST', body: JSON.stringify({ logados: checked }) });
  alert('Status salvo');
  loadOperacao(); // atualiza o card de operação
  // se estiver na view de busca, mantém resultados
  if ((searchInput.value||'').trim()) loadList();
  renderHighlights();
});

/* ===== Operação ===== */
const totalLogadosEl     = document.getElementById('total-logados');
const ativosList         = document.getElementById('ativos-list');
const refreshOperacaoBtn = document.getElementById('refresh-operacao');

async function loadOperacao(){
  const res = await api('/api/ativos') || { total:0, list:[] };
  totalLogadosEl.innerText = res.total || 0;
  ativosList.innerHTML = (res.list||[]).map(c=>`
    <div class="list-row">
      <div><span style="color:green">●</span> ${escapeHtml(c.nome)}</div>
      <div><button class="btn btn-red" data-id="${c.id}" data-action="logout">Deslogar</button></div>
    </div>
  `).join('');

  ativosList.querySelectorAll('button[data-action=logout]').forEach(b=>b.addEventListener('click', async (ev)=>{
    const id = ev.target.dataset.id;
    await api(`/api/logado/${id}/0`, { method:'POST' });
    loadOperacao(); loadControle(); renderHighlights();
  }));
}
refreshOperacaoBtn.addEventListener('click', loadOperacao);

/* ===== Destaques: atestado/ferias ===== */
const listaDestaques = document.getElementById('destaques-list');
async function renderHighlights(){
  const list = await api('/api/collaboradores') || [];
  const dest = list.filter(c => c.status==='ferias' || c.status==='atestado');
  if(dest.length===0){
    listaDestaques.innerHTML = '<div class="muted">Nenhum colaborador marcado.</div>';
    return;
  }
  listaDestaques.innerHTML = dest.map(c=>`
    <div class="list-row">
      <div><strong>${escapeHtml(c.nome)}</strong></div>
      <div>${badgeStatus(c.status)}</div>
    </div>
  `).join('');
}

/* ===== Próximas férias (tabela ferias) ===== */
const listaFerias = document.getElementById('ferias-list');
const mesAtualEl  = document.getElementById('mes-atual');

async function renderFerias(){
  const ferias = await api('/api/ferias') || [];
  const meses=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  mesAtualEl.textContent = meses[new Date().getMonth()];
  if(ferias.length===0){
    listaFerias.innerHTML = '<div class="muted">Sem agentes cadastrados para férias.</div>';
    return;
  }
  listaFerias.innerHTML = ferias.map(f=>`
    <div class="list-row">
      <div><strong>${escapeHtml(f.nome)}</strong></div>
      <div class="pill pill-amber">${meses[(f.mes||0)-1]||'-'}</div>
    </div>
  `).join('');
}

/* ===== Inicial ===== */
renderHighlights();
renderFerias();
