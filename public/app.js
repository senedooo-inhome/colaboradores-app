document.addEventListener('DOMContentLoaded', () => {
  console.log('[app] DOM pronto');

  // ===== Helpers =====
  const api = (path, opts) =>
    fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts })
      .then(r => r.json().catch(() => {}));

  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function escapeHtml(s){
    return s ? s.replace(/[&<>"']/g, (m)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])) : '';
  }

  // ===== Data do dia =====
  const dataHojeEl = $('#data-hoje');
  if (dataHojeEl) {
    const dias=['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
    const meses=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    const d = new Date();
    dataHojeEl.textContent = `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
  }

  // ===== Navegação =====
  const views = $$('.view');
  const navBtns = $$('.nav-btn');
  const pageTitle = $('#page-title');

  navBtns.forEach(b => b.addEventListener('click', () => {
    navBtns.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    views.forEach(v => v.classList.add('hidden'));
    const v = document.getElementById(b.dataset.view);
    if (v) v.classList.remove('hidden');
    if (pageTitle) pageTitle.innerText = b.innerText.trim();

    if (b.dataset.view === 'colaboradores') { resetSearchUi(); renderHighlights(); renderFerias(); }
    if (b.dataset.view === 'controle') loadControle();
    if (b.dataset.view === 'operacao') loadOperacao();
  }));

  // ===== Menus e Modais =====
  const overlay   = $('#overlay');
  const addBtn    = $('#btn-add');
  const addMenu   = $('#add-menu');
  const modalAg   = $('#modal-agente');
  const modalFer  = $('#modal-ferias');

  function show(el){ el && el.classList.remove('hidden'); }
  function hide(el){ el && el.classList.add('hidden'); }

  function openModal(which){
    show(overlay);
    if (which === 'ag') show(modalAg); else show(modalFer);
  }
  function closeModal(which){
    if (which === 'ag') hide(modalAg);
    if (which === 'fer') hide(modalFer);
    hide(overlay);
  }
  function closeMenus(){ hide(addMenu); }

  if (addBtn && addMenu) {
    addBtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      addMenu.classList.toggle('hidden');
    });
    document.addEventListener('click', closeMenus);
  }

  if (overlay) overlay.addEventListener('click', ()=>{ closeModal('ag'); closeModal('fer'); });

  const btnCloseAgs = document.querySelectorAll('[data-close="agente"]');
  btnCloseAgs.forEach(b=>b.addEventListener('click', ()=>closeModal('ag')));

  const btnCloseFes = document.querySelectorAll('[data-close="ferias"]');
  btnCloseFes.forEach(b=>b.addEventListener('click', ()=>closeModal('fer')));

  const btnMenuAddAg = $('#menu-add-agente');
  if (btnMenuAddAg) btnMenuAddAg.addEventListener('click', ()=>{ closeMenus(); openModal('ag'); });
  const btnMenuAddFe = $('#menu-add-ferias');
  if (btnMenuAddFe) btnMenuAddFe.addEventListener('click', ()=>{ closeMenus(); openModal('fer'); });

  // ===== Salvar agente =====
  const agenteNome = $('#agente-nome');
  const agenteSave = $('#agente-save');
  if (agenteSave) {
    agenteSave.addEventListener('click', async ()=>{
      const nome = (agenteNome?.value || '').trim();
      if(!nome) return alert('Digite o nome');
      await api('/api/collaboradores', { method:'POST', body: JSON.stringify({ nome }) });
      if (agenteNome) agenteNome.value='';
      closeModal('ag');
      resetSearchUi(); renderHighlights(); loadControle(); renderFerias();
    });
  }

  // ===== Salvar férias =====
  const feriasNome = $('#ferias-nome');
  const feriasMes  = $('#ferias-mes');
  const feriasSave = $('#ferias-save');
  if (feriasSave) {
    feriasSave.addEventListener('click', async ()=>{
      const nome = (feriasNome?.value || '').trim();
      const mes  = Number(feriasMes?.value);
      if(!nome || !mes) return alert('Preencha nome e mês');
      await api('/api/ferias', { method:'POST', body: JSON.stringify({ nome, mes }) });
      if (feriasNome) feriasNome.value='';
      if (feriasMes)  feriasMes.value='';
      closeModal('fer');
      renderFerias();
    });
  }

  // ===== Export único =====
  const exportBtn = $('#export-todos');
  if (exportBtn) {
    exportBtn.addEventListener('click', async ()=>{
      const r = await fetch('/api/export-csv');
      if (!r.ok) { alert('Falha ao exportar'); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'colaboradores.csv'; a.click();
      URL.revokeObjectURL(url);
    });
  }

  // ===== Busca / Tabela =====
  const table      = $('#table');
  const tableBody  = $('#table tbody');
  const searchInput= $('#search');
  const searchHint = $('#search-hint');

  function resetSearchUi(){
    table?.classList.add('hidden');
    searchHint?.classList.remove('hidden');
    if (tableBody) tableBody.innerHTML='';
    if (searchInput) searchInput.value='';
  }

  let searchTimeout;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(loadList, 250);
    });
  }

  async function loadList() {
    const q = (searchInput?.value||'').trim();
    if (!q) { resetSearchUi(); return; }

    const list = await api(`/api/collaboradores?q=${encodeURIComponent(q)}`) || [];
    if (tableBody) {
      tableBody.innerHTML = list.map(c => `
        <tr data-id="${c.id}">
          <td>${escapeHtml(c.nome)}</td>
          <td>${badgeStatus(c.status)}</td>
          <td>${c.logado ? '<span class="pill pill-green">Logado</span>' : ''}</td>
          <td>
            <button class="btn" data-action="edit">✏️</button>
            <button class="btn btn-red" data-action="delete">🗑️</button>
          </td>
        </tr>
      `).join('');
    }
    table?.classList.remove('hidden');
    searchHint?.classList.add('hidden');
  }

  function badgeStatus(status){
    if(status==='ferias')   return '<span class="pill pill-amber">Férias</span>';
    if(status==='atestado') return '<span class="pill pill-red">Atestado</span>';
    return '<span class="pill pill-muted">Ativo</span>';
  }

  // Delegação de eventos na tabela (evita perder handlers ao re-render)
  if (tableBody) {
    tableBody.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('button[data-action]');
      if (!btn) return;
      const tr = btn.closest('tr');
      const id = tr?.dataset.id;
      const act = btn.dataset.action;
      if (!id) return;

      if (act === 'edit') {
        const currentName = tr.cells[0].innerText.trim();
        const novo = prompt('Novo nome:', currentName);
        if(novo && novo.trim()) {
          await api(`/api/collaboradores/${id}`, { method:'PUT', body: JSON.stringify({ nome: novo.trim() }) });
          loadList(); renderHighlights(); loadControle(); renderFerias();
        }
      } else if (act === 'delete') {
        if (!confirm('Remover colaborador?')) return;
        await fetch(`/api/collaboradores/${id}`, { method: 'DELETE' });
        loadList(); renderHighlights(); loadControle(); renderFerias();
      }
    });
  }

  // ===== Controle (checkbox list) =====
  const controleList  = $('#controle-list');
  const saveStatusBtn = $('#save-status');

  async function loadControle() {
    const list = await api('/api/collaboradores') || [];
    if (controleList) {
      controleList.innerHTML = list.map(c => `
        <div class="list-row">
          <label><input type="checkbox" data-id="${c.id}" ${c.logado?'checked':''}/> ${escapeHtml(c.nome)}</label>
          <div>${c.logado?'<span class="pill pill-green">Logado</span>':''}</div>
        </div>
      `).join('');
    }
  }

  if (saveStatusBtn) {
    saveStatusBtn.addEventListener('click', async ()=>{
      const checked = [...controleList?.querySelectorAll('input[type=checkbox]:checked') || []].map(i=>i.dataset.id);
      await api('/api/status', { method:'POST', body: JSON.stringify({ logados: checked }) });
      alert('Status salvo');
      loadOperacao();
      if ((searchInput?.value||'').trim()) loadList();
      renderHighlights();
    });
  }

  // ===== Operação =====
  const totalLogadosEl     = $('#total-logados');
  const ativosList         = $('#ativos-list');
  const refreshOperacaoBtn = $('#refresh-operacao');

  async function loadOperacao(){
    const res = await api('/api/ativos') || { total:0, list:[] };
    if (totalLogadosEl) totalLogadosEl.innerText = res.total || 0;
    if (ativosList) {
      ativosList.innerHTML = (res.list||[]).map(c=>`
        <div class="list-row">
          <div><span style="color:green">●</span> ${escapeHtml(c.nome)}</div>
          <div><button class="btn btn-red" data-id="${c.id}" data-action="logout">Deslogar</button></div>
        </div>
      `).join('');
    }
  }

  if (ativosList) {
    ativosList.addEventListener('click', async (ev)=>{
      const btn = ev.target.closest('button[data-action=logout]');
      if (!btn) return;
      const id = btn.dataset.id;
      await api(`/api/logado/${id}/0`, { method:'POST' });
      loadOperacao(); loadControle(); renderHighlights();
    });
  }

  refreshOperacaoBtn?.addEventListener('click', loadOperacao);

  // ===== Destaques =====
  const listaDestaques = $('#destaques-list');
  async function renderHighlights(){
    const list = await api('/api/collaboradores') || [];
    const dest = list.filter(c => c.status==='ferias' || c.status==='atestado');
    if (!listaDestaques) return;
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

  // ===== Próximas férias =====
  const listaFerias = $('#ferias-list');
  const mesAtualEl  = $('#mes-atual');
  async function renderFerias(){
    const ferias = await api('/api/ferias') || [];
    const meses=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    if (mesAtualEl) mesAtualEl.textContent = meses[new Date().getMonth()];
    if(!listaFerias) return;
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

  // ===== Inicial =====
  renderHighlights();
  renderFerias();
  console.log('[app] inicializado');
});

