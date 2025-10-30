/* JS_AGENDA.js
   Cableado de enlace a FORM_Ag desde VIS_EXPEDIENTES (sin tocar EC).
   - Toma ?id de la URL
   - Toma nombre desde #hc-nombre (si existe)
   - Agrega ?id=... (&p=...) a links que terminen en FORM_Ag*.html
*/
(function () {
  const qs  = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  document.addEventListener('DOMContentLoaded', () => {
    const params    = new URLSearchParams(location.search);
    const idPaciente = params.get('id');
    if (!idPaciente) return;

    const nombrePaciente = (qs('#hc-nombre')?.textContent || '').trim();

    // Igual que tu patrón de EC, pero para FORM_Ag / FORM_Ag_Ag
    qsa('a[href$="FORM_Ag.html"]').forEach(a => {
      const base = a.getAttribute('href') || '';
      const sep  = base.includes('?') ? '&' : '?';
      const href = base
        + sep + 'id=' + encodeURIComponent(idPaciente)
        + (nombrePaciente ? '&p=' + encodeURIComponent(nombrePaciente) : '');
      a.setAttribute('href', href);
    });
  });
})();
/* JS_AGENDA_FORM.js
   Lógica de guardado para FORM_Ag (ambas variantes).
   - Fuente de verdad: localStorage['occhiapp_agenda']
   - Réplica (si aplica): localStorage['occhiapp_pacientes'] -> p.citas[]
*/
(function () {
  // ---------- helpers ----------
  const qs  = (sel, root=document) => root.querySelector(sel);
  const esc = (s) => (s == null ? '' : String(s));
  const pad2 = (n) => String(n).padStart(2, '0');

  function toISOFromLocal(dateStr, timeStr) {
    // dateStr: "YYYY-MM-DD", timeStr: "HH:MM"
    const [Y, M, D] = dateStr.split('-').map(n => parseInt(n,10));
    const [h, m]    = timeStr.split(':').map(n => parseInt(n,10));
    const d = new Date(Y, (M-1), D, h, m, 0, 0); // local time
    return d.toISOString(); // ISO (UTC)
  }

  function loadAgenda() {
    try {
      const raw = localStorage.getItem('occhiapp_agenda');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }
  function saveAgenda(list) {
    const sorted = list.slice().sort((a,b) => esc(a.fechaISO).localeCompare(esc(b.fechaISO)));
    localStorage.setItem('occhiapp_agenda', JSON.stringify(sorted));
  }

  function loadPacientes() {
    try {
      const raw = localStorage.getItem('occhiapp_pacientes');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }
  function savePacientes(list) {
    localStorage.setItem('occhiapp_pacientes', JSON.stringify(list));
  }

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c=>{
      const r = Math.random()*16|0, v = c==='x'?r:(r&0x3|0x8);
      return v.toString(16);
    });
  }

  // ---------- boot ----------
  document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(location.search);
    const idPaciente = params.get('id') || '';     // presente si viene desde expediente
    const nombreQS   = (params.get('p') || '').trim();

    // Campos (ajusta si tus ids difieren)
    const $pac   = qs('#paciente');  // input o select
    const $mot   = qs('#motivo');    // select
    const $est   = qs('#estado');    // select
    const $fec   = qs('#fecha');     // input type=date (YYYY-MM-DD)
    const $hor   = qs('#hora');      // input type=time (HH:MM)
    const $not   = qs('#notas');     // textarea
    const $btn   = qs('#btn-guardar, button[type="submit"]');

    // Prefill nombre si venimos del expediente
    if (idPaciente && $pac) {
      if ($pac.tagName === 'SELECT') {
        // Si fuera un select, crea una opción fija de solo lectura visual
        const opt = document.createElement('option');
        opt.value = idPaciente;
        opt.textContent = nombreQS || '(Paciente)';
        opt.selected = true;
        $pac.innerHTML = '';
        $pac.appendChild(opt);
        $pac.setAttribute('disabled', 'disabled'); // solo lectura visual
      } else {
        $pac.value = nombreQS || '';
        $pac.setAttribute('readonly', 'readonly');
      }
    }

    // Guardar
    if ($btn) {
      $btn.addEventListener('click', (ev) => {
        // Si tu formulario usa submit real, puedes hacer ev.preventDefault()
        // y manejar todo aquí. Ajusta según tu HTML.
        ev.preventDefault();

        // Validaciones mínimas
        const fechaStr = ($fec?.value || '').trim();
        const horaStr  = ($hor?.value || '').trim();
        const motivo   = ($mot?.value || '').trim();
        const estado   = ($est?.value || '').trim();
        const notas    = ($not?.value || '').trim();

        if (!fechaStr || !horaStr || !motivo || !estado) {
          alert('Completa Fecha, Hora, Motivo y Estado.');
          return;
        }

        // Resolver paciente
        let pacienteNombre = '';
        let pacienteId = idPaciente || '';

        if (pacienteId) {
          // nombre viene de QS o del campo
          pacienteNombre = nombreQS || ($pac?.value || '');
        } else {
          // Variante general: el select trae id o nombre
          const raw = ($pac?.value || '').trim();
          // Heurística: si parece UUID o ID conocido, úsalo; si no, deja como null y guarda nombre visible.
          const looksLikeId = /^[a-zA-Z0-9_-]{6,}$/.test(raw);
          pacienteId = looksLikeId ? raw : '';
          pacienteNombre = looksLikeId ? ($pac?.selectedOptions?.[0]?.textContent || '') : raw;
        }

        // Construir cita
        const cita = {
          idCita: uuid(),
          idPaciente: pacienteId || null,
          pacienteNombre: pacienteNombre,
          motivo,
          estado,
          notas,
          fechaISO: toISOFromLocal(fechaStr, horaStr),
          createdAtISO: new Date().toISOString()
        };

        // Guardar en agenda global
        const agenda = loadAgenda();
        agenda.push(cita);
        saveAgenda(agenda);

        // Redirección
        if (pacienteId) {
          location.href = `VIS_EXPEDIENTES.html?id=${encodeURIComponent(pacienteId)}`;
        } else {
          // Variante general → vuelve a Agenda
          location.href = `AGENDA.html`;
        }
      });
    }
  });
})();

// --- Preservar ?id (y opcionalmente ?p) en los enlaces de regreso/cancelar ---
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(location.search);
    const idPaciente = params.get('id') || '';
    const nombreQS   = (params.get('p') || '').trim();

    if (!idPaciente) return;

    // Enlaces que apuntan a VIS_EXPEDIENTES desde FORM_Ag
    const sels = [
      'a.back[href^="VIS_EXPEDIENTES"]',
      'a.btn-secundario[href^="VIS_EXPEDIENTES"]'
    ];
    sels.forEach(sel => {
      document.querySelectorAll(sel).forEach(a => {
        try {
          const url = new URL(a.getAttribute('href'), location.href);
          url.searchParams.set('id', idPaciente);
          if (nombreQS) url.searchParams.set('p', nombreQS);
          a.setAttribute('href', url.pathname + url.search);
        } catch {
          // Fallback: concatenar si el href es relativo "raro"
          const base = a.getAttribute('href') || 'VIS_EXPEDIENTES.html';
          const sep  = base.includes('?') ? '&' : '?';
          a.setAttribute('href',
            base + sep + 'id=' + encodeURIComponent(idPaciente) +
            (nombreQS ? '&p=' + encodeURIComponent(nombreQS) : '')
          );
        }
      });
    });
  });
})();

// --- Asegurar que el submit del formulario dispare la misma lógica que el click ---
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form.form-stack');
    const btnGuardar = document.querySelector('#btn-guardar, button[type="submit"]');
    if (!form || !btnGuardar) return;

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      // Reutiliza el handler ya asociado al botón:
      btnGuardar.click();
    });
  });
})();

// --- INDEX: Render "Próximas 5" desde occh iapp_agenda (usa pacienteNombre + fechaISO) ---
(function () {
  const qs  = (sel, root=document) => root.querySelector(sel);
  const esc = (s) => (s == null ? '' : String(s));
  const pad2 = (n) => String(n).padStart(2, '0');

  function loadAgenda() {
    try {
      const raw = localStorage.getItem('occhiapp_agenda');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }

  function toParts(iso) {
    const d = new Date(iso);
    return {
      yyyy: d.getFullYear(),
      mm: pad2(d.getMonth()+1),
      dd: pad2(d.getDate()),
      HH: pad2(d.getHours()),
      MM: pad2(d.getMinutes())
    };
  }

  function renderProximas5() {
    const host = qs('#proximas-citas');
    if (!host) return;

    host.innerHTML = '';
    const now = new Date();
    const futuras = loadAgenda()
      .filter(c => {
        const t = new Date(c.fechaISO);
        return !isNaN(t) && t >= now;
      })
      .sort((a,b) => new Date(a.fechaISO) - new Date(b.fechaISO))
      .slice(0, 5);

    if (!futuras.length) {
      host.innerHTML = `<div class="item"><span class="name muted">Sin citas</span><span class="date">—</span></div>`;
      return;
    }

    futuras.forEach(c => {
      const { yyyy, mm, dd, HH, MM } = toParts(c.fechaISO);
      const nombre = c.pacienteNombre || c.paciente || '—';
      const item = document.createElement('div');
      item.className = 'item';

      const spName = document.createElement('span');
      spName.className = 'name';
      spName.textContent = esc(nombre);

      const spDate = document.createElement('span');
      spDate.className = 'date';
      spDate.textContent = `${dd}/${mm}/${yyyy}, ${HH}:${MM}`;

      item.appendChild(spName);
      item.appendChild(spDate);
      host.appendChild(item);
    });
  }

  document.addEventListener('DOMContentLoaded', renderProximas5);
})();

// --- AGENDA: pintar Hoy/Mañana/Pasado y Calendario usando occhiapp_agenda ---
(function () {
  const qs  = (sel, root=document) => root.querySelector(sel);
  const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const pad2 = (n) => String(n).padStart(2, '0');

  function loadAgenda() {
    try {
      const raw = localStorage.getItem('occhiapp_agenda');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }

  function sameYMD(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }

  function fromISO(iso) {
    const d = new Date(iso);
    return { d, yyyy: d.getFullYear(), mm: pad2(d.getMonth()+1), dd: pad2(d.getDate()), HH: pad2(d.getHours()), MM: pad2(d.getMinutes()) };
  }

  function renderRowNombreHora(container, nombre, hora) {
    const row = document.createElement('div');
    row.className = 'row';
    const c1 = document.createElement('div'); c1.textContent = nombre || '—';
    const c2 = document.createElement('div'); c2.textContent = hora || '—';
    row.appendChild(c1); row.appendChild(c2);
    container.appendChild(row);
  }

  function fillDayList(container, dateObj) {
    if (!container) return;
    container.innerHTML = '';
    const delDia = loadAgenda()
      .filter(c => !isNaN(new Date(c.fechaISO)) && sameYMD(new Date(c.fechaISO), dateObj))
      .sort((a,b) => new Date(a.fechaISO) - new Date(b.fechaISO));
    if (!delDia.length) { renderRowNombreHora(container, '—', '—'); return; }
    delDia.forEach(c => {
      const p = c.pacienteNombre || c.paciente || '—';
      const { HH, MM } = fromISO(c.fechaISO);
      renderRowNombreHora(container, p, `${HH}:${MM}`);
    });
  }

  function initHoyManianaPasado() {
    const $hoy = qs('#hoy-list');
    const $man = qs('#maniana-list');
    const $pas = qs('#pasado-list');
    if (!$hoy && !$man && !$pas) return;

    const base = new Date();
    const hoy = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    const maniana = new Date(hoy); maniana.setDate(hoy.getDate() + 1);
    const pasado  = new Date(hoy); pasado.setDate(hoy.getDate() + 2);

    fillDayList($hoy, hoy);
    fillDayList($man, maniana);
    fillDayList($pas, pasado);
  }

  const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const DOW = ['L','M','X','J','V','S','D'];

  function initCalendar() {
    const cal = qs('#calendar');
    const listDia = qs('#agenda-dia');
    if (!cal || !listDia) return;

    let view = (() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() }; })();

    function drawMonth() {
      cal.innerHTML = '';

      // Nav
      const nav = document.createElement('div'); nav.className = 'cal-nav';
      const prev = document.createElement('button'); prev.type = 'button'; prev.textContent = '◀';
      const title = document.createElement('strong'); title.className = 'cal-title';
      const next = document.createElement('button'); next.type = 'button'; next.textContent = '▶';
      const updateTitle = () => { title.textContent = `${MONTHS[view.month]} ${view.year}`; };
      updateTitle();
      prev.addEventListener('click', () => { view.month--; if (view.month < 0){view.month = 11; view.year--;} drawMonth(); });
      next.addEventListener('click', () => { view.month++; if (view.month > 11){view.month = 0; view.year++;} drawMonth(); });
      nav.appendChild(prev); nav.appendChild(title); nav.appendChild(next);
      cal.appendChild(nav);

      // Head dow
      const head = document.createElement('div'); head.className = 'cal-head';
      DOW.forEach(d => { const c = document.createElement('div'); c.textContent = d; head.appendChild(c); });
      cal.appendChild(head);

      // Body
      const grid = document.createElement('div'); grid.className = 'cal-body';
      const first = new Date(view.year, view.month, 1);
      const firstDow = (first.getDay() + 6) % 7; // 0 = lunes
      const daysInMonth = new Date(view.year, view.month+1, 0).getDate();
      for (let i=0;i<firstDow;i++){ const f=document.createElement('div'); f.className='cal-cell cal-filler'; grid.appendChild(f); }

      const agenda = loadAgenda();

      for (let day=1; day<=daysInMonth; day++) {
        const cellDate = new Date(view.year, view.month, day);

        const cell = document.createElement('button'); cell.type='button'; cell.className='cal-cell';
        const label = document.createElement('div'); label.className='cal-daynum'; label.textContent=String(day);
        cell.appendChild(label);

        // badge contador
        const delDia = agenda.filter(c => !isNaN(new Date(c.fechaISO)) && sameYMD(new Date(c.fechaISO), cellDate));
        if (delDia.length) {
          const badge = document.createElement('div'); badge.className='cal-badge'; badge.title=`${delDia.length} cita(s)`; badge.textContent=delDia.length;
          cell.appendChild(badge);
        }

      // NUEVO (con colapse + editar/eliminar)
      cell.addEventListener('click', () => {
        qsa('.cal-cell', grid).forEach(b => b.classList.remove('active'));
        cell.classList.add('active');

        const ESTADOS = ['Pendiente','Confirmada','Cancelada','Atendida'];

        function loadAgenda() {
          try {
            const raw = localStorage.getItem('occhiapp_agenda');
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
          } catch { return []; }
        }
        function saveAgenda(list) {
          localStorage.setItem('occhiapp_agenda', JSON.stringify(list));
        }
        const agendaDeEseDia = () =>
          loadAgenda()
            .filter(k => !isNaN(new Date(k.fechaISO)) && sameYMD(new Date(k.fechaISO), cellDate))
            .sort((a,b)=> new Date(a.fechaISO)-new Date(b.fechaISO));

        function pintarLista() {
          listDia.innerHTML = '';
          const lst = agendaDeEseDia();
          if (!lst.length) {
            listDia.innerHTML = `<div class="table-row"><div class="muted">Sin citas</div></div>`;
            return;
          }

          lst.forEach(c => {
            const nombre = c.pacienteNombre || c.paciente || '—';
            const { HH, MM } = fromISO(c.fechaISO);
            const cid = c.idCita || c.id || `${nombre}|${c.fechaISO}`; // fallback

            const det = document.createElement('details');
            det.className = 'day-item';
            det.dataset.cid = cid;

            // Cabecera del colapse
            const sum = document.createElement('summary');
            sum.className = 'day-head';
            sum.innerHTML = `
              <span class="dh-col name">${nombre}</span>
              <span class="dh-col motivo">${(c.motivo || c.tipo || '—')}</span>
              <span class="dh-col estado">${(c.estado || 'Pendiente')}</span>
              <span class="dh-col notas">${(c.notas ? c.notas : '—')}</span>
              <span class="dh-col hora">${HH}:${MM}</span>
            `;

            det.appendChild(sum);

            // Cuerpo del colapse
            const body = document.createElement('div');
            body.className = 'day-body';
            body.innerHTML = `
              <div class="rowline"><span class="label">Estado:</span> <span class="value" data-f="estado">${c.estado || 'Pendiente'}</span></div>
              <div class="rowline"><span class="label">Notas:</span> <span class="value" data-f="notas">${c.notas || '—'}</span></div>

              <div class="actions">
                <button class="btn-ghost btn-edit">Editar</button>
                <button class="btn-danger btn-del">Eliminar</button>
              </div>
            `;
            det.appendChild(body);

            // ---- Editar (toggle a modo edición dentro del colapse) ----
            const btnEdit = body.querySelector('.btn-edit');
            btnEdit.addEventListener('click', () => {
              const editing = body.classList.toggle('editing');

              // Si entra a edición, reemplazamos spans por inputs/select
              if (editing) {
                const estadoSpan = body.querySelector('[data-f="estado"]');
                const notasSpan  = body.querySelector('[data-f="notas"]');

                const sel = document.createElement('select');
                sel.className = 'input';
                ESTADOS.forEach(s => {
                  const opt = document.createElement('option');
                  opt.value = s; opt.textContent = s;
                  if ((c.estado || 'Pendiente') === s) opt.selected = true;
                  sel.appendChild(opt);
                });

                const ta = document.createElement('textarea');
                ta.className = 'input';
                ta.rows = 3;
                ta.value = c.notas || '';

                estadoSpan.replaceWith(sel);
                notasSpan.replaceWith(ta);

                btnEdit.textContent = 'Guardar';
                // Añade cancelar
                let btnCancel = body.querySelector('.btn-cancel');
                if (!btnCancel) {
                  btnCancel = document.createElement('button');
                  btnCancel.className = 'btn-ghost btn-cancel';
                  btnCancel.textContent = 'Cancelar';
                  body.querySelector('.actions').insertBefore(btnCancel, body.querySelector('.btn-del'));
                  btnCancel.addEventListener('click', () => {
                    body.classList.remove('editing');
                    pintarLista(); // restaurar vista
                  });
                }

                // Guardar cambios
                btnEdit.onclick = () => {
                  const ag = loadAgenda();
                  const i = ag.findIndex(x => (x.idCita || x.id || `${(x.pacienteNombre||x.paciente||'')}|${x.fechaISO}`) === cid);
                  if (i >= 0) {
                    ag[i].estado = sel.value;
                    ag[i].notas  = ta.value.trim();
                    saveAgenda(ag);
                  }
                  body.classList.remove('editing');
                  pintarLista();      // refresca listado
                  initHoyManianaPasado(); // refresca tarjetas
                  initCalendar();         // refresca badges
                };
              } else {
                // si sale de edición sin guardar
                pintarLista();
              }
            });

            // ---- Eliminar ----
            const btnDel = body.querySelector('.btn-del');
            btnDel.addEventListener('click', () => {
              if (!confirm('¿Eliminar esta cita?')) return;
              const nueva = loadAgenda().filter(x => (x.idCita || x.id || `${(x.pacienteNombre||x.paciente||'')}|${x.fechaISO}`) !== cid);
              saveAgenda(nueva);
              pintarLista();
              initHoyManianaPasado();
              initCalendar();
            });

            listDia.appendChild(det);
          });
        }

        // Pinta al entrar
        pintarLista();
      });


        grid.appendChild(cell);
      }

      const totalCells = firstDow + daysInMonth;
      const remainder = totalCells % 7;
      if (remainder) {
        for (let i=0; i<(7-remainder); i++) {
          const f=document.createElement('div'); f.className='cal-cell cal-filler'; grid.appendChild(f);
        }
      }

      cal.appendChild(grid);
    }

    drawMonth();
  }

  document.addEventListener('DOMContentLoaded', () => {
    initHoyManianaPasado();
    initCalendar();
  });
})();

