/* OcchiApp - JS_EC.js
   Lógica de Examen Clínico:
   - FORM_EC.html: crear/editar consultas en patient.consultas[]
   - VIS_EXAMEN_CLINICO.html: renderizar la consulta (AV en formato 20/(valor))
   - VIS_EXPEDIENTES.html: navegación a nueva consulta y ver/editar/eliminar consultas (sin romper JS_EX.js)
*/

(function () {
  // ===== Utils mínimos (compatibles con JS_EX.js) =====
  const qs  = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s)
    .replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const STORE_KEY = 'occhiapp_pacientes';

  function loadAll() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); }
    catch { return []; }
  }
  function saveAll(list) { localStorage.setItem(STORE_KEY, JSON.stringify(list)); }
  function findById(id) { return loadAll().find(p => p.id === id); }
  function upsert(patient) {
    const list = loadAll();
    const i = list.findIndex(p => p.id === patient.id);
    if (i >= 0) list[i] = patient; else list.push(patient);
    saveAll(list);
  }
  function getParam(name) { return new URLSearchParams(location.search).get(name); }

  // Normaliza a DDMMYYYY
  function ddmmyyyyFromAny(dateStr = '') {
    if (!dateStr) return '00000000';
    let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (m) return `${m[3]}${m[2]}${m[1]}`;
    m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateStr);
    if (m) return `${m[1]}${m[2]}${m[3]}`;
    const digits = (dateStr.match(/\d/g) || []).join('');
    if (/^(19|20)\d{6}$/.test(digits)) return `${digits.slice(6,8)}${digits.slice(4,6)}${digits.slice(0,4)}`;
    if (/^\d{8}$/.test(digits)) return digits;
    return '00000000';
  }
  const fmtDMY = (s) => {
    const d = ddmmyyyyFromAny(s||'');
    return (d && d!=='00000000') ? `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}` : (s||'');
  };

  // AV: muestra "20/valor" si hay valor, si no "—"
  const fmtAV = (v) => {
    const s = String(v||'').trim();
    if (!s) return '—';
    // si el usuario ya escribió 20/xx, respétalo
    if (/^\s*20\s*\/\s*\S+/.test(s)) return s.replace(/\s+/g,'').replace('20/','20/');
    return `20/${s}`;
  };

  // Detectores ligeros por contenido
  const isFormEC = !!qs('form.form-examen');  // FORM_EC.html
  const isVisEC  = document.title.toLowerCase().includes('examen clínico') ||
                   document.title.toLowerCase().includes('examen clinico'); // VIS_EXAMEN_CLINICO.html
  const isVisExp = document.title.toLowerCase().includes('historia clínica') ||
                   document.title.toLowerCase().includes('historia clinica'); // VIS_EXPEDIENTES.html

  // ===== 1) FORM_EC.html: guardar / editar consulta =====
  if (isFormEC) {
    const id  = getParam('id');              // id del paciente (obligatorio)
    const idx = getParam('idx');             // índice de consulta (opcional, para editar)
    const editIndex = (idx != null) ? parseInt(idx, 10) : null;

    const p = id ? findById(id) : null;
  if (!p) {
  alert('No se encontró el paciente. Regresando al expediente.');
  location.href = `VIS_EXPEDIENTES.html${id ? '?id=' + encodeURIComponent(id) : ''}`;
  return;
  }

    p.consultas = Array.isArray(p.consultas) ? p.consultas : [];

    // Campos (coinciden con tu FORM_EC.html)
    const $form = qs('form.form-examen');

    // Datos de la consulta
    const $fecha = qs('#fecha');
    const $motivo = qs('#motivo');
    const $notas = qs('#notas');

    // AV
    const $av_od_cc = qs('#av_od_cc');
    const $av_od_sc = qs('#av_od_sc');
    const $av_od_ae = qs('#av_od_ae');
    const $av_oi_cc = qs('#av_oi_cc');
    const $av_oi_sc = qs('#av_oi_sc');
    const $av_oi_ae = qs('#av_oi_ae');

    // RX del PX
    const $od_sph_p = qs('#od_sph_p');
    const $od_cyl_p = qs('#od_cyl_p');
    const $od_axis_p= qs('#od_axis_p');
    const $od_add_p = qs('#od_add_p');
    const $oi_sph_p = qs('#oi_sph_p');
    const $oi_cyl_p = qs('#oi_cyl_p');
    const $oi_axis_p= qs('#oi_axis_p');
    const $oi_add_p = qs('#oi_add_p');
    const $dxPx     = qs('#dxPx');

    // RX Final
    const $od_sph_f = qs('#od_sph_f');
    const $od_cyl_f = qs('#od_cyl_f');
    const $od_axis_f= qs('#od_axis_f');
    const $od_add_f = qs('#od_add_f');
    const $od_dnp_f = qs('#od_dnp_f');
    const $od_alt_f = qs('#od_alt_f');
    const $oi_sph_f = qs('#oi_sph_f');
    const $oi_cyl_f = qs('#oi_cyl_f');
    const $oi_axis_f= qs('#oi_axis_f');
    const $oi_add_f = qs('#oi_add_f');
    const $oi_dnp_f = qs('#oi_dnp_f');
    const $oi_alt_f = qs('#oi_alt_f');
    const $tratamiento = qs('#tratamiento');
    const $diagnostico = qs('#diagnostico');

    // Observaciones
    const $observaciones = qs('#observaciones');

    // Prefill si es edición
    if (editIndex != null && !Number.isNaN(editIndex) && p.consultas[editIndex]) {
      const c = p.consultas[editIndex];

      $fecha.value  = c.fecha || '';
      $motivo.value = c.motivo || '';
      $notas.value  = c.notas  || '';

      // AV guardamos crudos (sin 20/)
      $av_od_cc.value = c.av?.od?.cc || '';
      $av_od_sc.value = c.av?.od?.sc || '';
      $av_od_ae.value = c.av?.od?.ae || '';
      $av_oi_cc.value = c.av?.oi?.cc || '';
      $av_oi_sc.value = c.av?.oi?.sc || '';
      $av_oi_ae.value = c.av?.oi?.ae || '';

      $od_sph_p.value  = c.rxPx?.od?.sph || '';
      $od_cyl_p.value  = c.rxPx?.od?.cyl || '';
      $od_axis_p.value = c.rxPx?.od?.axis|| '';
      $od_add_p.value  = c.rxPx?.od?.add || '';
      $oi_sph_p.value  = c.rxPx?.oi?.sph || '';
      $oi_cyl_p.value  = c.rxPx?.oi?.cyl || '';
      $oi_axis_p.value = c.rxPx?.oi?.axis|| '';
      $oi_add_p.value  = c.rxPx?.oi?.add || '';
      $dxPx.value      = c.rxPx?.dx || '';

      $od_sph_f.value  = c.rxFinal?.od?.sph || '';
      $od_cyl_f.value  = c.rxFinal?.od?.cyl || '';
      $od_axis_f.value = c.rxFinal?.od?.axis|| '';
      $od_add_f.value  = c.rxFinal?.od?.add || '';
      $od_dnp_f.value  = c.rxFinal?.od?.dnp || '';
      $od_alt_f.value  = c.rxFinal?.od?.alt || '';
      $oi_sph_f.value  = c.rxFinal?.oi?.sph || '';
      $oi_cyl_f.value  = c.rxFinal?.oi?.cyl || '';
      $oi_axis_f.value = c.rxFinal?.oi?.axis|| '';
      $oi_add_f.value  = c.rxFinal?.oi?.add || '';
      $oi_dnp_f.value  = c.rxFinal?.oi?.dnp || '';
      $oi_alt_f.value  = c.rxFinal?.oi?.alt || '';
      $tratamiento.value = c.tx || '';
      $diagnostico.value = c.dx || '';
      $observaciones.value = c.obs || '';
    }

    // Guardar por submit
    $form?.addEventListener('submit', (ev) => {
      ev.preventDefault();

      if (!$fecha.value) {
        alert('La fecha es obligatoria.');
        return;
      }

      // Construir objeto de consulta
      const consulta = {
        fecha: $fecha.value,                 // guardamos como YYYY-MM-DD si es input date
        motivo: $motivo.value || '',
        notas: $notas.value || '',
        av: {
          od: { cc: ($av_od_cc.value||'').trim(), sc: ($av_od_sc.value||'').trim(), ae: ($av_od_ae.value||'').trim() },
          oi: { cc: ($av_oi_cc.value||'').trim(), sc: ($av_oi_sc.value||'').trim(), ae: ($av_oi_ae.value||'').trim() },
        },
        rxPx: {
          od: { sph: $od_sph_p.value, cyl: $od_cyl_p.value, axis: $od_axis_p.value, add: $od_add_p.value },
          oi: { sph: $oi_sph_p.value, cyl: $oi_cyl_p.value, axis: $oi_axis_p.value, add: $oi_add_p.value },
          dx: $dxPx.value || ''
        },
        rxFinal: {
          od: { sph: $od_sph_f.value, cyl: $od_cyl_f.value, axis: $od_axis_f.value, add: $od_add_f.value, dnp: $od_dnp_f.value, alt: $od_alt_f.value },
          oi: { sph: $oi_sph_f.value, cyl: $oi_cyl_f.value, axis: $oi_axis_f.value, add: $oi_add_f.value, dnp: $oi_dnp_f.value, alt: $oi_alt_f.value }
        },
        tx: $tratamiento.value || '',
        dx: $diagnostico.value || '',
        obs: $observaciones.value || ''
      };

      // Insertar o actualizar
      let nextIdx = 0;
      if (editIndex != null && !Number.isNaN(editIndex) && p.consultas[editIndex]) {
        p.consultas[editIndex] = consulta;
        nextIdx = editIndex;
      } else {
        p.consultas.push(consulta);
        nextIdx = p.consultas.length - 1;
      }

      upsert(p);
      // Ir a la vista de la consulta recién guardada
      location.href = `VIS_EXAMEN_CLINICO.html?id=${encodeURIComponent(p.id)}&idx=${nextIdx}`;
    });
  }

  // ===== 2) VIS_EXAMEN_CLINICO.html: imprimir consulta =====
  if (isVisEC && !isFormEC && !isVisExp) {
    const id  = getParam('id');
    const idx = parseInt(getParam('idx') || '0', 10);

    const p = id ? findById(id) : null;
    if (!p) { alert('Paciente no encontrado.'); location.href = 'EXPEDIENTES.html'; return; }
    p.consultas = Array.isArray(p.consultas) ? p.consultas : [];
    const c = p.consultas[idx];
    if (!c) { alert('Consulta no encontrada.'); location.href = `VIS_EXPEDIENTES.html?id=${encodeURIComponent(id)}`; return; }

    // Encabezado
    const $ec_fecha  = qs('#ec_fecha');
    const $ec_motivo = qs('#ec_motivo');
    if ($ec_fecha)  $ec_fecha.value  = fmtDMY(c.fecha);
    if ($ec_motivo) $ec_motivo.value = c.motivo || '—';

    // AV
    const setTxt = (idSel, val) => { const el = qs(idSel); if (el) el.textContent = val; };

    setTxt('#av_od_cc', fmtAV(c.av?.od?.cc));
    setTxt('#av_od_sc', fmtAV(c.av?.od?.sc));
    setTxt('#av_od_ae', fmtAV(c.av?.od?.ae));
    setTxt('#av_oi_cc', fmtAV(c.av?.oi?.cc));
    setTxt('#av_oi_sc', fmtAV(c.av?.oi?.sc));
    setTxt('#av_oi_ae', fmtAV(c.av?.oi?.ae));

    // RX del PX
    setTxt('#rxp_od_sph',  c.rxPx?.od?.sph || '—');
    setTxt('#rxp_od_cyl',  c.rxPx?.od?.cyl || '—');
    setTxt('#rxp_od_axis', c.rxPx?.od?.axis|| '—');
    setTxt('#rxp_od_add',  c.rxPx?.od?.add || '—');

    setTxt('#rxp_oi_sph',  c.rxPx?.oi?.sph || '—');
    setTxt('#rxp_oi_cyl',  c.rxPx?.oi?.cyl || '—');
    setTxt('#rxp_oi_axis', c.rxPx?.oi?.axis|| '—');
    setTxt('#rxp_oi_add',  c.rxPx?.oi?.add || '—');

    setTxt('#rxp_dx', c.rxPx?.dx || '—');

    // RX FINAL
    setTxt('#rxf_od_sph',  c.rxFinal?.od?.sph || '—');
    setTxt('#rxf_od_cyl',  c.rxFinal?.od?.cyl || '—');
    setTxt('#rxf_od_axis', c.rxFinal?.od?.axis|| '—');
    setTxt('#rxf_od_add',  c.rxFinal?.od?.add || '—');
    setTxt('#rxf_od_dnp',  c.rxFinal?.od?.dnp || '—');
    setTxt('#rxf_od_alt',  c.rxFinal?.od?.alt || '—');

    setTxt('#rxf_oi_sph',  c.rxFinal?.oi?.sph || '—');
    setTxt('#rxf_oi_cyl',  c.rxFinal?.oi?.cyl || '—');
    setTxt('#rxf_oi_axis', c.rxFinal?.oi?.axis|| '—');
    setTxt('#rxf_oi_add',  c.rxFinal?.oi?.add || '—');
    setTxt('#rxf_oi_dnp',  c.rxFinal?.oi?.dnp || '—');
    setTxt('#rxf_oi_alt',  c.rxFinal?.oi?.alt || '—');

    // Tx/Dx/Obs
    const $rxf_tx = qs('#rxf_tx');
    const $rxf_dx = qs('#rxf_dx');
    const $obs    = qs('#obs_text');
    if ($rxf_tx) $rxf_tx.value = c.tx || '';
    if ($rxf_dx) $rxf_dx.value = c.dx || '';
    if ($obs)    $obs.textContent = c.obs || '—';

    // Ajustar botón Regresar
    const $back = qsa('a.btn-secundario, a.back, a[href*="VIS_EXPEDIENTES.html"]')[0];
    if ($back) $back.setAttribute('href', `VIS_EXPEDIENTES.html?id=${encodeURIComponent(p.id)}`);

    // Ajustar (por si el HTML tenía placeholder __ID__)
    qsa('a[href*="__ID__"]').forEach(a=>{
      a.href = a.href.replace('__ID__', encodeURIComponent(p.id));
    });
  }

  // ===== 3) VIS_EXPEDIENTES.html: pegamento (no re-render) =====
  if (isVisExp) {
    const id = getParam('id');
    const p = id ? findById(id) : null;

    // Asegurar que "Nuevo examen clínico" lleva ?id=...
    if (p) {
      qsa('a[href$="FORM_EC.html"]').forEach(a=>{
        a.setAttribute('href', `FORM_EC.html?id=${encodeURIComponent(p.id)}`);
      });
    }

    // Ver consulta: interceptar (fase captura) para evitar alerta del handler viejo
    document.addEventListener('click', (ev) => {
      const a = ev.target.closest('a[data-action="ver-consulta"]');
      if (!a) return;
      ev.preventDefault();
      ev.stopPropagation(); // bloquea el listener antiguo
      const idx = parseInt(a.getAttribute('data-idx') || '0', 10);
      const pid = id || getParam('id');
      if (pid) location.href = `VIS_EXAMEN_CLINICO.html?id=${encodeURIComponent(pid)}&idx=${idx}`;
    }, true);

    // Soporte a iconos si existen (.icon-btn)
    document.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.icon-btn[data-action]');
      if (!btn) return;
      ev.preventDefault();
      const action = btn.getAttribute('data-action');
      const idx = parseInt(btn.getAttribute('data-idx')||'0',10);
      const pid = id || getParam('id');
      if (!pid) return;
      const patient = findById(pid);
      if (!patient) return;
      patient.consultas = Array.isArray(patient.consultas) ? patient.consultas : [];

      if (action === 'ver-consulta') {
        location.href = `VIS_EXAMEN_CLINICO.html?id=${encodeURIComponent(pid)}&idx=${idx}`;
      } else if (action === 'edit-consulta') {
        location.href = `FORM_EC.html?id=${encodeURIComponent(pid)}&idx=${idx}`;
      } else if (action === 'del-consulta') {
        if (confirm('¿Eliminar esta consulta?')) {
          if (patient.consultas[idx]) {
            patient.consultas.splice(idx,1);
            upsert(patient);
            // Si tu render es estático, con recargar basta;
            // si es dinámico, JS_EX.js repintará la tabla:
            location.reload();
          }
        }
      }
    }, true);
  }

})();
