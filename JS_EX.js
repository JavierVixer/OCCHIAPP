/* OcchiApp - Gestión de expedientes (HC / Lista / Vista)
   Almacén: localStorage['occhiapp_pacientes'] => Array<Patient>
   Este archivo RELLENA todas las secciones de VIS_EXPEDIENTES (Datos, Anamnesis, Historia, Consultas, Finanzas, Próxima cita)
   y mantiene la lógica para FORM_HC y EXPEDIENTES.
*/

(function () {
  // ====== Utils ======
  const qs  = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s)
    .replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toArray = (v) => Array.isArray(v) ? v : (v ? [v] : []);

  const STORE_KEY = 'occhiapp_pacientes';

  function loadAll() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { console.error(e); return []; }
  }
  function saveAll(list) {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
  }
  function findById(id) {
    return loadAll().find(p => p.id === id);
  }
  function upsert(patient) {
    const list = loadAll();
    const i = list.findIndex(p => p.id === patient.id);
    if (i >= 0) list[i] = patient; else list.push(patient);
    saveAll(list);
  }
  function removeById(id) {
    saveAll(loadAll().filter(p => p.id !== id));
  }

  function getParam(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function onlyLetters(s='') {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z]/g, '');
  }

  // Iniciales "primer + último" (más natural)
  function initialsFromName(name='') {
    const words = String(name||'').trim().split(/\s+/).filter(Boolean);
    const first = (words[0] || '')[0] || 'X';
    const last  = (words[words.length-1] || '')[0] || 'X';
    const clean = (ch) => String(ch).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z]/g,'');
    return (clean(first) || 'X').toUpperCase() + (clean(last) || 'X').toUpperCase();
  }

  // genero -> M/F/N (N = no binario y “prefiero no decirlo”)
  function genderLetter(g) {
    const s = (g || '').toLowerCase();
    if (s.includes('mascul')) return 'M';
    if (s.includes('femen'))  return 'F';
    return 'N';
  }

  // ==== Normaliza fechas a DDMMYYYY ====
  function ddmmyyyyFromAny(dateStr = '') {
    if (!dateStr) return '00000000';

    // input type="date" => YYYY-MM-DD
    let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (m) {
      const yyyy = m[1], mm = m[2], dd = m[3];
      return `${dd}${mm}${yyyy}`;
    }

    // Escrito: DD/MM/YYYY
    m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateStr);
    if (m) {
      const dd = m[1], mm = m[2], yyyy = m[3];
      return `${dd}${mm}${yyyy}`;
    }

    // Fallback: solo dígitos
    const digits = (dateStr.match(/\d/g) || []).join('');
    // YYYYMMDD -> DDMMYYYY
    if (/^(19|20)\d{6}$/.test(digits)) {
      const yyyy = digits.slice(0,4);
      const mm = digits.slice(4,6);
      const dd = digits.slice(6,8);
      return `${dd}${mm}${yyyy}`;
    }
    // Si ya es DDMMYYYY
    if (/^\d{8}$/.test(digits)) return digits;

    return '00000000';
  }

  function calcAge(dateStr) {
    if (!dateStr) return '';
    const dmy = ddmmyyyyFromAny(dateStr);
    const dd = +dmy.slice(0,2);
    const mm = +dmy.slice(2,4);
    const yyyy = +dmy.slice(4);
    const b = new Date(yyyy, mm - 1, dd);
    if (isNaN(b)) return '';
    const today = new Date();
    let age = today.getFullYear() - b.getFullYear();
    const m = today.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
    return age < 0 ? '' : age;
  }

  // ID paciente con control de colisión
  function buildPatientId(base) {
    const g   = genderLetter(base.genero);
    const ini = initialsFromName(base.nombre);
    const src = base.fecha_nac || base.nacimiento || '';
    const ddmmyyyy = ddmmyyyyFromAny(src);
    return `P${g}${ini}${ddmmyyyy}`;
  }

  function uniqueId(baseId) {
    const list = loadAll();
    if (!list.some(p => p.id === baseId)) return baseId;
    let n = 2;
    while (list.some(p => p.id === `${baseId}-${n}`)) n++;
    return `${baseId}-${n}`;
  }

  function boolToSiNo(v) { return v ? 'Sí' : 'No'; }
  const fmtDMY = (s) => {
    const d = ddmmyyyyFromAny(s||'');
    return (d && d!=='00000000') ? `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}` : (s||'');
  };

  // ====== Agenda helpers (fuente de verdad: occhiapp_agenda) ======
  function loadAgenda() {
    try {
      const raw = localStorage.getItem('occhiapp_agenda');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }

  function citasDeAgendaPorPaciente(idPaciente, nombrePaciente) {
    const nom = String(nombrePaciente||'').trim().toLowerCase();
    const now = new Date();

    return loadAgenda()
      .filter(c => {
        // Match por id (preferido)
        if (idPaciente && c.idPaciente && String(c.idPaciente) === String(idPaciente)) return true;
        // Respaldo: por nombre exacto (case-insensitive)
        const n = String(c.pacienteNombre || c.paciente || '').trim().toLowerCase();
        return nom && n && n === nom;
      })
      .filter(c => {
        const t = new Date(c.fechaISO);
        return !isNaN(t) && t >= now;
      })
      .sort((a,b) => new Date(a.fechaISO) - new Date(b.fechaISO));
  }

  function citaToPresentable(c) {
    if (!c) return null;
    const d = new Date(c.fechaISO);
    const pad2 = (n)=> String(n).padStart(2,'0');
    const fecha = `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`;
    const hora  = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    return {
      fecha,
      hora,
      motivo: c.motivo || c.tipo || '—',
      estado: c.estado || '—',
      notas:  c.notas  || '—'
    };
  }


  // ====== Detectores de página ======
  const isFormHC         = !!qs('form.form-occhi'); // relajado, no depende del <title>
  const isList           = !!qs('#expedientesBody');
  const isViewExpediente = document.title.toLowerCase().includes('historia clínica')
                        || document.title.toLowerCase().includes('historia clinica');

  // ====== FORM_HC.html logic ======
  if (isFormHC) {
    const $form = qs('form.form-occhi');
    const idParam = getParam('id'); // si viene, es edición

    // Campos (IDs exactos como pasaste)
    const $nombre        = qs('#nombre');
    const $nacimiento    = qs('#nacimiento');
    const $edad          = qs('#edad');
    const $telefono      = qs('#telefono');
    const $correo        = qs('#correo');
    const $ocupacion     = qs('#ocupacion');
    const $genero        = qs('#genero');

    const $motivo        = qs('#motivo');
    const $usasLentes    = qs('#usasLentes');
    const $desdeLentes   = qs('#desdeLentes');
    const $ultimoExamen  = qs('#ultimoExamen');

    // Síntomas
    const $dolorCabeza   = qs('#dolorCabeza');
    const $mareos        = qs('#mareos');
    const $ojosRojos     = qs('#ojosRojos');
    const $irritacion    = qs('#irritacion');
    const $picazon       = qs('#picazon');
    const $lagrimeo      = qs('#lagrimeo');
    const $visionDoble   = qs('#visionDoble');
    const $visionBorrosa = qs('#visionBorrosa');
    const $arosLuz       = qs('#arosLuz');
    const $ojoSeco       = qs('#ojoSeco');
    const $miodesopsias  = qs('#miodesopsias');
    const $sintOtro      = qs('#sintOtro');

    // Historia médica general
    const $padeceEnfermedad = qs('#padeceEnfermedad');
    const $diabetes      = qs('#diabetes');
    const $diabetesDesde = qs('#diabetesDesde');
    const $hipertension  = qs('#hipertension');
    const $htaDesde      = qs('#htaDesde');
    const $txMedica      = qs('#txMedica');
    const $famEnf        = qs('#famEnf');
    const $otraMed       = qs('#otraMed');
    const $otraMedDesde  = qs('#otraMedDesde');

    // Historia médica ocular
    const $enfOcular     = qs('#enfOcular');
    const $catarata      = qs('#catarata');
    const $catarataDesde = qs('#catarataDesde');
    const $glaucoma      = qs('#glaucoma');
    const $glaucomaDesde = qs('#glaucomaDesde');
    const $dmae          = qs('#dmae');
    const $dmaeDesde     = qs('#dmaeDesde');
    const $retino        = qs('#retino');
    const $retinoDesde   = qs('#retinoDesde');
    const $alterNO       = qs('#alterNO');
    const $alterNODesde  = qs('#alterNODesde');
    const $otraOcular    = qs('#otraOcular');
    const $txOcular      = qs('#txOcular');
    const $ultOft        = qs('#ultOft');

    // Prefill si es edición
    if (idParam) {
      const p = findById(idParam);
      if (p) {
        $nombre.value     = p.nombre || '';
        $nacimiento.value = p.fecha_nac || '';
        $edad.value       = p.edad || calcAge(p.fecha_nac) || '';
        $telefono.value   = p.telefono || '';
        $correo.value     = p.correo || '';
        $ocupacion.value  = p.ocupacion || '';
        if ($genero) $genero.value = p.genero || 'Selecciona';

        $motivo.value        = p.motivo || '';
        $usasLentes.checked  = !!p.usasLentes;
        $desdeLentes.value   = p.desdeLentes || '';
        $ultimoExamen.value  = p.ultimoExamen || '';

        $dolorCabeza.checked   = !!p.sintomas?.dolorCabeza;
        $mareos.checked        = !!p.sintomas?.mareos;
        $ojosRojos.checked     = !!p.sintomas?.ojosRojos;
        $irritacion.checked    = !!p.sintomas?.irritacion;
        $picazon.checked       = !!p.sintomas?.picazon;
        $lagrimeo.checked      = !!p.sintomas?.lagrimeo;
        $visionDoble.checked   = !!p.sintomas?.visionDoble;
        $visionBorrosa.checked = !!p.sintomas?.visionBorrosa;
        $arosLuz.checked       = !!p.sintomas?.arosLuz;
        $ojoSeco.checked       = !!p.sintomas?.ojoSeco;
        $miodesopsias.checked  = !!p.sintomas?.miodesopsias;
        $sintOtro.value        = p.sintomas?.otro || '';

        $padeceEnfermedad.checked = !!p.histmed?.padeceEnfermedad;
        $diabetes.checked         = !!p.histmed?.diabetes;
        $diabetesDesde.value      = p.histmed?.diabetesDesde || '';
        $hipertension.checked     = !!p.histmed?.hipertension;
        $htaDesde.value           = p.histmed?.htaDesde || '';
        $txMedica.value           = p.histmed?.txMedica || '';
        $famEnf.value             = p.histmed?.famEnf || '';
        $otraMed.value            = p.histmed?.otraMed || '';
        $otraMedDesde.value       = p.histmed?.otraMedDesde || '';

        $enfOcular.checked       = !!p.histOcular?.enfOcular;
        $catarata.checked        = !!p.histOcular?.catarata;
        $catarataDesde.value     = p.histOcular?.catarataDesde || '';
        $glaucoma.checked        = !!p.histOcular?.glaucoma;
        $glaucomaDesde.value     = p.histOcular?.glaucomaDesde || '';
        $dmae.checked            = !!p.histOcular?.dmae;
        $dmaeDesde.value         = p.histOcular?.dmaeDesde || '';
        $retino.checked          = !!p.histOcular?.retino;
        $retinoDesde.value       = p.histOcular?.retinoDesde || '';
        $alterNO.checked         = !!p.histOcular?.alterNO;
        $alterNODesde.value      = p.histOcular?.alterNODesde || '';
        $otraOcular.value        = p.histOcular?.otraOcular || '';
        $txOcular.value          = p.histOcular?.txOcular || '';
        $ultOft.value            = p.histOcular?.ultOft || '';
      }
    }

    // Autocalcular edad si no la escriben
    $nacimiento?.addEventListener('change', () => {
      if (!$edad.value) $edad.value = calcAge($nacimiento.value) || '';
    });

    // Guardar por submit del form (más robusto)
    $form?.addEventListener('submit', (ev) => {
      ev.preventDefault();

      // Validación mínima
      if (!$nombre.value.trim() || !$nacimiento.value) {
        alert('Nombre y fecha de nacimiento son obligatorios.');
        return;
      }

      const base = {
        nombre: $nombre.value.trim(),
        fecha_nac: $nacimiento.value,
        edad: $edad.value || calcAge($nacimiento.value) || '',
        telefono: $telefono.value.trim(),
        correo: $correo.value.trim(),
        ocupacion: $ocupacion.value.trim(),
        genero: $genero?.value || '',
        motivo: $motivo.value.trim(),
        usasLentes: !!$usasLentes.checked,
        desdeLentes: $desdeLentes.value.trim(),
        ultimoExamen: $ultimoExamen.value.trim(),
        sintomas: {
          dolorCabeza: !!$dolorCabeza.checked,
          mareos: !!$mareos.checked,
          ojosRojos: !!$ojosRojos.checked,
          irritacion: !!$irritacion.checked,
          picazon: !!$picazon.checked,
          lagrimeo: !!$lagrimeo.checked,
          visionDoble: !!$visionDoble.checked,
          visionBorrosa: !!$visionBorrosa.checked,
          arosLuz: !!$arosLuz.checked,
          ojoSeco: !!$ojoSeco.checked,
          miodesopsias: !!$miodesopsias.checked,
          otro: $sintOtro.value.trim(),
        },
        histmed: {
          padeceEnfermedad: !!$padeceEnfermedad.checked,
          diabetes: !!$diabetes.checked,
          diabetesDesde: $diabetesDesde.value.trim(),
          hipertension: !!$hipertension.checked,
          htaDesde: $htaDesde.value.trim(),
          txMedica: $txMedica.value.trim(),
          famEnf: $famEnf.value.trim(),
          otraMed: $otraMed.value.trim(),
          otraMedDesde: $otraMedDesde.value.trim(),
        },
        histOcular: {
          enfOcular: !!$enfOcular.checked,
          catarata: !!$catarata.checked,
          catarataDesde: $catarataDesde.value.trim(),
          glaucoma: !!$glaucoma.checked,
          glaucomaDesde: $glaucomaDesde.value.trim(),
          dmae: !!$dmae.checked,
          dmaeDesde: $dmaeDesde.value.trim(),
          retino: !!$retino.checked,
          retinoDesde: $retinoDesde.value.trim(),
          alterNO: !!$alterNO.checked,
          alterNODesde: $alterNODesde.value.trim(),
          otraOcular: $otraOcular.value.trim(),
          txOcular: $txOcular.value.trim(),
          ultOft: $ultOft.value.trim(),
        },
      };

      if (idParam) {
        // Mantener mismo id
        const prev = findById(idParam) || {};
        base.id = prev.id || buildPatientId(base);
        // Mantener sus colecciones si existen
        base.consultas = Array.isArray(prev.consultas) ? prev.consultas : [];
        base.finanzas  = Array.isArray(prev.finanzas)  ? prev.finanzas  : [];
        base.citas     = Array.isArray(prev.citas)     ? prev.citas     : [];
      } else {
        base.id = uniqueId(buildPatientId(base));
        base.consultas = [];
        base.finanzas  = [];
        base.citas     = [];
      }

      upsert(base);
      location.href = 'EXPEDIENTES.html';
    });

    // Soporte para botón explícito si existe
    const $btnGuardar = qsa('button, .btn-primario').find(b => (b.matches('button[type="submit"]') || b.classList.contains('btn-primario')));
    $btnGuardar?.addEventListener('click', () => $form?.requestSubmit());
  }

  // ====== EXPEDIENTES.html logic ======
  if (isList) {
    const $tbody = qs('#expedientesBody');

    function safeAge(p) {
      const e = (p.edad != null && p.edad !== '') ? p.edad : calcAge(p.fecha_nac);
      return e || '';
    }

    function renderRow(p) {
      return `
        <tr>
          <td>${esc(p.id)}</td>
          <td title="${esc(p.nombre||'')}">${esc(p.nombre||'')}</td>
          <td>${esc(p.genero||'')}</td>
          <td>${esc(safeAge(p))}</td>
          <td class="right">
            <div class="row-actions">
              <button class="btn-row icon-btn" data-act="ver" data-id="${esc(p.id)}" title="Ver" aria-label="Ver">
                <img src="IMAGENES/VER.png" alt="Ver" width="24" height="24">
              </button>
              <button class="btn-row icon-btn" data-act="edit" data-id="${esc(p.id)}" title="Editar" aria-label="Editar">
                <img src="IMAGENES/EDITAR.png" alt="Editar" width="24" height="24">
              </button>
              <button class="btn-row-danger icon-btn" data-act="del" data-id="${esc(p.id)}" title="Eliminar" aria-label="Eliminar">
                <img src="IMAGENES/BASURA.png" alt="Eliminar" width="24" height="24">
              </button>
            </div>
          </td>
        </tr>`;
    }

    function paint() {
      const list = loadAll();
      if (!list.length) {
        $tbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align:center; padding:12px;">Aún no hay expedientes. Usa "Nuevo".</td>
          </tr>`;
        return;
      }
      $tbody.innerHTML = list.map(renderRow).join('');
    }

    $tbody.addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-act]');
      if (!b) return;
      const id = b.getAttribute('data-id');
      const act = b.getAttribute('data-act');

      if (act === 'ver') {
        location.href = `VIS_EXPEDIENTES.html?id=${encodeURIComponent(id)}`;
      } else if (act === 'edit') {
        location.href = `FORM_HC.html?id=${encodeURIComponent(id)}`;
      } else if (act === 'del') {
        if (confirm('¿Eliminar este expediente?')) {
          removeById(id);
          paint();
        }
      }
    });

    paint();
  }

  // ====== VIS_EXPEDIENTES.html logic ======
  if (isViewExpediente) {
    const id = getParam('id');
    const p = id ? findById(id) : null;
    const $sheet = qs('main.sheet');

    if (!p) {
      if ($sheet) $sheet.innerHTML = `
        <section class="section">
          <h2 class="sec-title">Expediente</h2>
          <p>No se encontró el expediente. Vuelve a <a class="lnk" href="EXPEDIENTES.html">Expedientes</a>.</p>
        </section>`;
      return;
    }

    // Fecha bonita siempre en DD/MM/YYYY
    const dmy = ddmmyyyyFromAny(p.fecha_nac || '');
    const fechaBonita = (dmy !== '00000000') ? `${dmy.slice(0,2)}/${dmy.slice(2,4)}/${dmy.slice(4)}` : (p.fecha_nac || '');

    function liYN(lbl, v) {
      return `<div><span class="label">${esc(lbl)}:</span> <span class="value">${esc(boolToSiNo(!!v))}</span></div>`;
    }
    function rowYN(lbl, v) {
      return `<div class="rowline"><span class="label">${esc(lbl)}:</span> <span class="value">${esc(boolToSiNo(!!v))}</span></div>`;
    }
    function maybe(label, v) {
      return v ? `<div class="rowline"><span class="label">${esc(label)}:</span> <span class="value">${esc(v)}</span></div>` : '';
    }

    const sintomas = p.sintomas || {};
    const hm = p.histmed || {};
    const ho = p.histOcular || {};

    // Colecciones conocidas (ya no usamos p.citas como fuente de verdad)
    const consultas = Array.isArray(p.consultas) ? p.consultas.slice() : [];
    const finanzas  = Array.isArray(p.finanzas)  ? p.finanzas.slice()  : [];

    // Ordenar por fecha asc si traen 'fecha'
    const byDate = (a,b) => {
      const A = ddmmyyyyFromAny(a.fecha||''); // DDMMYYYY
      const B = ddmmyyyyFromAny(b.fecha||'');
      return A.localeCompare(B);
    };
    consultas.sort(byDate);
    finanzas.sort(byDate);

    // Próxima cita desde la Agenda global por id (respaldo: nombre)
    const futurasAgenda = citasDeAgendaPorPaciente(p.id, p.nombre);
    const proximaCitaObj = futurasAgenda[0] || null;

    // Objeto listo para pintar en UI (fecha, hora, motivo, estado, notas)
    let proximaCita = citaToPresentable(proximaCitaObj);

    // Respaldo opcional: si no hay nada en Agenda y existiera p.citas legacy, úsala
    if (!proximaCita && Array.isArray(p.citas) && p.citas.length) {
      const dd8 = (s='') => {
        const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
        return m ? `${m[1]}${m[2]}${m[3]}` : '00000000';
      };
      const cc = p.citas.slice().sort((a,b)=> dd8(a.fecha).localeCompare(dd8(b.fecha)));
      const today = ddmmyyyyFromAny(new Date().toISOString().slice(0,10));
      const fut = cc.find(x => dd8(x.fecha) >= today) || cc[0] || null;
      if (fut) proximaCita = {
        fecha: fut.fecha || '—',
        hora:  fut.hora  || '—',
        motivo: fut.motivo || '—',
        estado: fut.estado || '—',
        notas:  fut.notas  || '—'
      };
    }


    const htmlConsultas = consultas.length
      ? consultas.map((c, i) => `
        <div class="trow">
          <div>${i + 1}ª</div>
          <div>${fmtDMY(c.fecha)}</div>
          <div>${esc(c.notas || '–')}</div>
          <div class="right actions">
            <button class="btn-row icon-btn" data-action="ver-consulta" data-idx="${i}" title="Ver" aria-label="Ver esta consulta">
              <img src="IMAGENES/VER.png" alt="Ver" width="24" height="24">
            </button>
            <button class="btn-row icon-btn" data-action="edit-consulta" data-idx="${i}" title="Editar" aria-label="Editar esta consulta">
              <img src="IMAGENES/EDITAR.png" alt="Editar" width="24" height="24">
            </button>
            <button class="btn-row-danger icon-btn" data-action="del-consulta" data-idx="${i}" title="Eliminar" aria-label="Eliminar esta consulta">
              <img src="IMAGENES/BASURA.png" alt="Eliminar" width="24" height="24">
            </button>
          </div>
        </div>
      `).join('')
      : `<div class="trow"><div class="full">Sin consultas registradas.</div></div>`;


    const htmlFinanzas = finanzas.length
      ? finanzas.map(mov=>`
        <div class="trow">
          <div>${esc(mov.tipo||'')}</div>
          <div>${fmtDMY(mov.fecha)}</div>
          <div class="right">${esc(mov.monto||'')}</div>
        </div>`).join('')
      : `<div class="trow"><div class="full">Sin movimientos.</div></div>`;

    const parseMonto = (m) => {
      if (typeof m === 'number') return m;
      const s = String(m||'').replace(/\s/g,'');
      const num = parseFloat(s.replace(/[^0-9.]/g,''));
      return isNaN(num) ? 0 : num;
    };
    const totalVendido = finanzas.filter(x=>String(x.tipo).toLowerCase()==='venta')
                                 .reduce((a,x)=>a+parseMonto(x.monto),0);
    const totalPagado  = finanzas.filter(x=>String(x.tipo).toLowerCase()==='pago')
                                 .reduce((a,x)=>a+parseMonto(x.monto),0);
    const adeudo = Math.max(0, totalVendido - totalPagado);

    const html = `
      <!-- Encabezado / Datos Generales -->
      <section class="section">
        <h2 class="sec-title">Datos Generales</h2>
        <div class="dg">
          <div class="avatar" aria-hidden="true"></div>
          <div class="grid">
            <div><span class="label">Nombre:</span> <span class="value" id="hc-nombre">${esc(p.nombre||'')}</span></div>
            <div><span class="label">Fecha de nacimiento:</span> <span class="value">${esc(fechaBonita)}</span></div>
            <div><span class="label">Edad:</span> <span class="value">${esc((p.edad||calcAge(p.fecha_nac)||''))}</span></div>
            <div><span class="label">Sexo:</span> <span class="value">${esc(p.genero||'')}</span></div>
            <div><span class="label">Ocupación:</span> <span class="value">${esc(p.ocupacion||'')}</span></div>
            <div><span class="label">Teléfono:</span> <span class="value">${esc(p.telefono||'')}</span></div>
            <div><span class="label">Correo:</span> <span class="value">${esc(p.correo||'')}</span></div>
            <div><span class="label">ID Paciente:</span> <span class="value">${esc(p.id||'')}</span></div>
          </div>
        </div>
      </section>

      <!-- Anamnesis -->
      <section class="section">
        <h2 class="sec-title">Anamnesis</h2>
        <div class="two">
          <div>
            ${maybe('Motivo de consulta', p.motivo)}
            ${maybe('Último examen de la vista', p.ultimoExamen)}
          </div>
          <div>
            ${rowYN('¿Usa lentes?', p.usasLentes)}
            ${maybe('¿Desde cuándo?', p.desdeLentes)}
          </div>
        </div>

        <h3 class="sub">Síntomas</h3>
        <div class="symp">
          ${liYN('Dolor de cabeza', sintomas.dolorCabeza)}
          ${liYN('Mareos', sintomas.mareos)}
          ${liYN('Ojos rojos', sintomas.ojosRojos)}
          ${liYN('Irritación', sintomas.irritacion)}
          ${liYN('Picazón', sintomas.picazon)}
          ${liYN('Lagrimeo', sintomas.lagrimeo)}
          ${liYN('Visión doble', sintomas.visionDoble)}
          ${liYN('Visión borrosa', sintomas.visionBorrosa)}
          ${liYN('Aros de luz', sintomas.arosLuz)}
          ${liYN('Ojo seco', sintomas.ojoSeco)}
          ${liYN('Miodesopsias', sintomas.miodesopsias)}
          <div class="full">${maybe('Otro', sintomas.otro)}</div>
        </div>
      </section>

      <!-- Historia médica -->
      <section class="section">
        <h2 class="sec-title">Historia médica</h2>
        <div class="two">
          <div>
            ${rowYN('¿Padece alguna enfermedad?', hm.padeceEnfermedad)}
            ${rowYN('Diabetes', hm.diabetes)}
            ${maybe('¿Desde cuándo? (Diabetes)', hm.diabetesDesde)}
          </div>
          <div>
            ${rowYN('Hipertensión', hm.hipertension)}
            ${maybe('¿Desde cuándo? (Hipertensión)', hm.htaDesde)}
            ${maybe('Tx', hm.txMedica)}
            ${maybe('Familiares con enfermedad', hm.famEnf)}
            ${maybe('Otra', hm.otraMed)}
            ${maybe('¿Desde cuándo? (Otra)', hm.otraMedDesde)}
          </div>
        </div>

        <h3 class="sub">Historia médica ocular</h3>
        <div class="two">
          <div>
            ${rowYN('¿Enfermedad ocular?', ho.enfOcular)}
            ${rowYN('Catarata', ho.catarata)}
            ${maybe('¿Desde cuándo? (Catarata)', ho.catarataDesde)}
            ${rowYN('DMAE', ho.dmae)}
            ${maybe('¿Desde cuándo? (DMAE)', ho.dmaeDesde)}
          </div>
          <div>
            ${rowYN('Glaucoma', ho.glaucoma)}
            ${maybe('¿Desde cuándo? (Glaucoma)', ho.glaucomaDesde)}
            ${rowYN('Retinopatía diabética', ho.retino)}
            ${maybe('¿Desde cuándo? (Retinopatía)', ho.retinoDesde)}
            ${rowYN('Alteración en N.O.', ho.alterNO)}
            ${maybe('¿Desde cuándo? (N.O.)', ho.alterNODesde)}
            ${maybe('Otra', ho.otraOcular)}
            ${maybe('Tx', ho.txOcular)}
            ${maybe('Última consulta con oftalmólogo', ho.ultOft)}
          </div>
        </div>
      </section>

      <!-- Consultas / Exámenes clínicos -->
      <section class="section">
        <h2 class="sec-title">Consultas / Exámenes clínicos</h2>
        <div class="table-card">
          <div class="thead">
            <div>Consulta</div><div>Fecha</div><div>Notas</div><div class="right">Acciones</div>
          </div>
          ${htmlConsultas}
        </div>
      </section>

      <!-- Finanzas -->
      <section class="section">
        <h2 class="sec-title">Finanzas</h2>
        <div class="two">
          <div class="table-card">
            <div class="thead">
              <div>Tipo</div><div>Fecha</div><div class="right">Monto</div>
            </div>
            ${htmlFinanzas}
          </div>
          <div class="totals">
            <div class="rowline"><span class="label">Total vendido:</span> <span class="value">$ ${totalVendido.toFixed(2)}</span></div>
            <div class="rowline"><span class="label">Pagado:</span> <span class="value">$ ${totalPagado.toFixed(2)}</span></div>
            <div class="rowline"><span class="label">Adeudo:</span> <span class="value strong">$ ${adeudo.toFixed(2)}</span></div>
          </div>
        </div>
      </section>

      <!-- Próxima cita -->
      <section class="section">
        <h2 class="sec-title">Próxima cita</h2>
        <div class="appointment">
          <div class="rowline"><span class="label">Fecha:</span>  <span class="value">${proximaCita ? proximaCita.fecha  : '—'}</span></div>
          <div class="rowline"><span class="label">Hora:</span>   <span class="value">${proximaCita ? proximaCita.hora   : '—'}</span></div>
          <div class="rowline"><span class="label">Motivo:</span> <span class="value">${proximaCita ? esc(proximaCita.motivo) : '—'}</span></div>
          <div class="rowline"><span class="label">Estado:</span> <span class="value">${proximaCita ? esc(proximaCita.estado) : '—'}</span></div>
          <div class="rowline"><span class="label">Notas:</span>  <span class="value">${proximaCita ? esc(proximaCita.notas)  : '—'}</span></div>
        </div>
      </section>
    `;

    if ($sheet) $sheet.innerHTML = html;

    // Hook para futuras acciones (ver consulta, etc.)
    $sheet.addEventListener('click', (ev) => {
      const a = ev.target.closest('a[data-action="ver-consulta"]');
      if (a) {
        ev.preventDefault();
        const idx = +a.getAttribute('data-idx');
        const c = consultas[idx];
        if (c) {
          alert(`Consulta ${idx+1}\\nFecha: ${fmtDMY(c.fecha)}\\nNotas: ${c.notas||'—'}`);
        }
      }
    });
  }

})();