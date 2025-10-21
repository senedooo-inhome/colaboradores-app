document.addEventListener('DOMContentLoaded', function () {
  console.log('[app] DOM pronto');

  // Helpers
  function api(path, opts) {
    return fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {}))
      .then(r => r.json().catch(() => {}));
  }
  function $(sel){ return document.querySelector(sel); }
  function $$(sel){ return document.querySelectorAll(sel); }
  function escapeHtml(s){
    if (!s) return '';
    return s.replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
  }

  // Data do dia
  var dataHojeEl = $('#data-hoje');
  if (dataHojeEl) {
    var dias  = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
    var meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    var d = new Date();
    dataHojeEl.textContent = dias[d.getDay()] + ', ' + d.getDate() + ' de ' + meses[d.getMonth()] + ' de ' + d.getFullYear();
  }

  // Navegação
  var views = $$('.view');
  var navBtns = $$('.nav-btn');
  var pageTitle = $('#page-title');

  function showView(id){
    views.forEach(v => v.classList.add('hidden'));
    var view = document.getElementById(id);
    if (view) view.classList.remove('hidden');
  }

  navBtns.forEach(btn => {
    btn.addEventListener('click', function(){
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showView(btn.dataset.view);
      if (pageTitle) pageTitle.innerText = btn.innerText.trim();

      if (btn.dataset.view === 'colaboradores') { loadList(); renderHighlights(); renderFerias(); }
      if (btn.dataset.view === 'controle')      { loadControle(); }
      if (btn.dataset.view === 'operacao')      { loadOperacao(); }
    });
  });

  // Menus e Modais
  var overlay  = $('#overlay');
  var addBtn   = $('#btn-add');
  var addMenu  = $('#add-menu');
  var modalAg  = $('#modal-agente');
  var modalFer = $('#modal-ferias');

  function show(el){ if (el) el.classList.remove('hidden'); }
  function hide(el){ if (el) el.classList.add('hidden'); }
  function closeMenus(){ hide(addMenu); }

  function openModal(which){
    show(overlay);
    closeMenus();
    if (which === 'ag') {
      show(modalAg);
      setTimeout(() => $('#agente-nome')?.focus(), 0);
    } else {
      show(modalFer);
      setTimeout(() => $('#ferias-nome')?.focus(), 0);
    }
  }
  function closeModal(which){
    if (which === 'ag')  hide(modalAg);
    if (which === 'fer') hide(modalFer);
    hide(overlay);
  }

  addBtn?.addEventListener('click', e => {
    e.stopPropagation();
    addMenu.classList.toggle('hidden');
  });
  document.addEventListener('click', closeMenus);
  overlay?.addEventListener('click', () => { closeModal('ag'); closeModal('fer'); });

  $$('#modal-agente [data-close="agente"]').forEach(b => b.addEventListener('click', () => closeModal('ag')));
  $$('#modal-ferias [data-close="ferias"]').forEach(b => b.addEventListener('click', () => closeModal('fer')));

  $('#menu-add-agente')?.addEventListener('click', () => { setAddMode(); openModal('ag'); });
  $('#menu-add-ferias')?.addEventListener('click', () => openModal('fer'));

  // Export CSV
  $('#export-todos')?.addEventListener('click', function(){
    fetch('/api/export-csv').then(r => {
      if (!r.ok) { alert('Falha ao exportar'); return; }
      return r.blob();
    }).then(blob => {
      if (!blob) return;
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'colaboradores.csv';
      a.click();
      URL.revokeObjectURL(url);
    });
  });

  // Tabela
  var table       = $('#table');
  var tableBody   = $('#table tbody');
  var searchInput = $('#search');
  var searchHint  = $('#search-hint');

  function badgeStatus(status){
    if (status === 'ferias')   return '<span class="pill pill-amber">Férias</span>';
    if (status === 'atestado') return '<span class="pill pill-red">Atestado</span>';
    if (status === 'folga')    return '<span class="pill pill-blue">Folga Compensação</span>';
    return '<span class="pill pill-muted">Ativo</span>';
  }

  function loadList(){
    var q = (searchInput?.value || '').trim().toLowerCase();
    api('/api/collaboradores').then(all => {
      all = all || [];
      var list = q ? all.filter(c => (c.nome || '').toLowerCase().includes(q)) : all;
      if (!table || !tableBody) return;

      if (!list.length) {
        tableBody.innerHTML = '<tr id="tbody-hint"><td colspan="4">Nenhum colaborador encontrado.</td></tr>';
        table.classList.remove('hidden');
        searchHint?.classList.add('hidden');
        return;
      }

      var html = '';
      list.forEach(c => {
        html += `<tr data-id="${c.id}" data-status="${c.status || 'ativo'}">
          <td>${escapeHtml(c.nome)}</td>
          <td>${badgeStatus(c.status)}</td>
          <td>${c.logado ? '<span class="pill pill-green">Logado</span>' : ''}</td>
          <td>
            <button class="btn btn-sm" data-action="edit">✏️</button>
            <button class="btn btn-sm btn-red" data-action="delete">🗑️</button>
          </td>
        </tr>`;
      });

      tableBody.innerHTML = html;
      table.classList.remove('hidden');
      searchHint?.classList.add('hidden');
    });
  }

  var searchTimeout;
  searchInput?.addEventListener('input', function(){
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(loadList, 250);
  });

  tableBody?.addEventListener('click', function(ev){
    var btn = ev.target.closest('button[data-action]');
    if (!btn) return;
    var tr  = btn.closest('tr');
    if (!tr) return;
    var id  = tr.getAttribute('data-id');
    var act = btn.getAttribute('data-action');
    if (!id) return;

    if (act === 'edit') {
      setEditMode({
        id: id,
        nome: tr.cells[0].innerText.trim(),
        status: tr.getAttribute('data-status') || 'ativo'
      });
      openModal('ag');
    } else if (act === 'delete') {
      if (!window.confirm('Remover colaborador?')) return;
      fetch('/api/collaboradores/' + id, { method:'DELETE' })
        .then(() => {
          loadList(); renderHighlights(); loadControle(); renderFerias();
        });
    }
  });

  // Modal Agente
  var agenteId = $('#agente-id');
  var agenteNome = $('#agente-nome');
  var agenteStatus = $('#agente-status');
  var agenteTitle = $('#agente-title');
  var agenteSave = $('#agente-save');

  function setAddMode(){
    agenteTitle.textContent = 'Adicionar agente';
    agenteId.value = '';
    agenteNome.value = '';
    agenteStatus.value = 'ativo';
  }

  function setEditMode(data){
    agenteTitle.textContent = 'Editar agente';
    agenteId.value = data.id;
    agenteNome.value = data.nome || '';
    agenteStatus.value = data.status || 'ativo';
  }

  agenteSave?.addEventListener('click', function(){
    var id = agenteId.value.trim();
    var nome = agenteNome.value.trim();
    var status = agenteStatus.value;
    if (!nome) { alert('Digite o nome'); return; }

    var method = id ? 'PUT' : 'POST';
    var url = id ? '/api/collaboradores/' + id : '/api/collaboradores';
    api(url, {
      method: method,
      body: JSON.stringify({ nome: nome, status: status })
    }).then(() => {
      closeModal('ag');
      loadList(); renderHighlights(); loadControle(); renderFerias();
    });
  });

  // Modal Férias
  var feriasNome = $('#ferias-nome');
  var feriasMes = $('#ferias-mes');
  var