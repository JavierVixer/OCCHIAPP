// --- INVENTARIO.JS (IDs estables) ---
// Carga los productos desde localStorage
let productos = JSON.parse(localStorage.getItem("productos")) || [];

// Referencias DOM
const grid = document.querySelector(".table-card");
const formNuevo = document.querySelector("#ocNuevo form");
const formEditar = document.querySelector("#ocEditar form");
const searchInput = document.querySelector("#searchInput");
const sortSelect = document.querySelector("#sortSelect");
const exportPDFBtn = document.querySelector("#exportPDF");

// ===== IDs estables =====
const ID_BASE = "737440";
const COUNTER_KEY = "productos_counter";

// Inicializa/migra el contador con base en los productos existentes (si aplica)
function initCounter() {
  let c = parseInt(localStorage.getItem(COUNTER_KEY) || "0", 10);
  if (!c && c !== 0 || Number.isNaN(c)) {
    // Migración: si ya hay productos con IDs tipo 737440001, 737440002...
    const maxSeq = productos.reduce((max, p) => {
      const m = String(p.id || "").match(/^737440(\d{3})$/);
      if (!m) return max;
      const seq = parseInt(m[1], 10);
      return Math.max(max, seq);
    }, 0);
    c = maxSeq; // el siguiente será maxSeq+1
    localStorage.setItem(COUNTER_KEY, String(c));
  }
  return c;
}

// Genera el siguiente ID estable (no se reindexa jamás)
function generarID() {
  let c = parseInt(localStorage.getItem(COUNTER_KEY) || "0", 10);
  if (Number.isNaN(c)) c = 0;
  c += 1;
  localStorage.setItem(COUNTER_KEY, String(c));
  return ID_BASE + c.toString().padStart(3, "0");
}

// ===== Render =====
function renderProductos(lista = productos) {
  // Limpia filas antiguas (excluye cabecera)
  document.querySelectorAll(".grid-row").forEach(e => e.remove());

  lista.forEach((p, index) => {
    const row = document.createElement("div");
    row.className = "grid-row";
    row.innerHTML = `
      <div class="hide-sm text-center">
        <svg id="barcode-${index}"></svg>
        <div class="small text-muted">${p.id}</div>
      </div>
      <div>${p.modelo}</div>
      <div class="hide-sm"><span class="tag">${p.linea}</span></div>
      <div>$${parseFloat(p.precio).toFixed(2)}</div>
      <div>${p.cantidad}</div>
      <div class="row-actions">
        <button class="btn-occhi btn-sm" data-index="${index}" data-bs-toggle="offcanvas" data-bs-target="#ocEditar">Editar</button>
        <button class="btn-danger-occhi btn-sm" data-index="${index}">Eliminar</button>
      </div>
    `;
    const section = document.querySelector(".table-card");
    section.appendChild(row);

    // Código de barras
    try {
      JsBarcode(`#barcode-${index}`, p.id, {
        format: "CODE128",
        width: 1.2,
        height: 28,
        displayValue: false,
        margin: 2
      });
    } catch (err) {
      console.warn("JsBarcode error:", err);
    }
  });

  // Persistir
  localStorage.setItem("productos", JSON.stringify(productos));
}

// ===== Agregar =====
formNuevo.addEventListener("submit", e => {
  e.preventDefault();

  const modelo = formNuevo.querySelector("#inv_modelo").value.trim();
  const linea = formNuevo.querySelector("#inv_linea").value;
  const precioVal = formNuevo.querySelector("#inv_precio").value;
  const cantidadVal = formNuevo.querySelector("#inv_cantidad").value;

  const precio = parseFloat(precioVal);
  const cantidad = parseInt(cantidadVal, 10);

  if (!modelo || !linea || precioVal === "" || cantidadVal === "") {
    alert("Por favor completa todos los campos correctamente.");
    return;
  }
  if (isNaN(precio) || isNaN(cantidad)) {
    alert("Precio o cantidad inválidos.");
    return;
  }

  const nuevo = {
    id: generarID(), // ← estable
    modelo,
    linea,
    precio,
    cantidad
  };

  productos.push(nuevo);
  renderProductos();
  formNuevo.reset();

  const offcanvas = bootstrap.Offcanvas.getInstance(document.getElementById("ocNuevo"));
  if (offcanvas) offcanvas.hide();
});

// ===== Editar / Eliminar =====
let indexEdit = null;

document.addEventListener("click", e => {
  // Editar
  if (e.target.matches(".btn-occhi.btn-sm")) {
    indexEdit = e.target.dataset.index;
    const p = productos[indexEdit];
    if (!p) return;
    formEditar.querySelector("#ed_id").value = p.id;
    formEditar.querySelector("#ed_modelo").value = p.modelo;
    formEditar.querySelector("#ed_linea").value = p.linea;
    formEditar.querySelector("#ed_precio").value = p.precio;
    formEditar.querySelector("#ed_cantidad").value = p.cantidad;
  }

  // Eliminar (NO reindexar IDs)
  if (e.target.matches(".btn-danger-occhi.btn-sm")) {
    const i = e.target.dataset.index;
    if (!productos[i]) return;
    if (confirm(`¿Eliminar ${productos[i].modelo}?`)) {
      productos.splice(i, 1);
      renderProductos();
    }
  }
});

// Guardar cambios de edición
formEditar.addEventListener("submit", e => {
  e.preventDefault();
  if (indexEdit === null) return;

  const id = formEditar.querySelector("#ed_id").value; // se conserva
  const modelo = formEditar.querySelector("#ed_modelo").value.trim();
  const linea = formEditar.querySelector("#ed_linea").value;
  const precio = parseFloat(formEditar.querySelector("#ed_precio").value);
  const cantidad = parseInt(formEditar.querySelector("#ed_cantidad").value, 10);

  if (!modelo || !linea || isNaN(precio) || isNaN(cantidad)) {
    alert("Por favor completa todos los campos correctamente.");
    return;
  }

  productos[indexEdit] = { id, modelo, linea, precio, cantidad };
  renderProductos();

  const offcanvas = bootstrap.Offcanvas.getInstance(document.getElementById("ocEditar"));
  if (offcanvas) offcanvas.hide();
});

// ===== Buscar =====
if (searchInput) {
  searchInput.addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    const filtrados = productos.filter(p =>
      String(p.id).toLowerCase().includes(q) ||
      p.modelo.toLowerCase().includes(q) ||
      p.linea.toLowerCase().includes(q)
    );
    renderProductos(filtrados);
  });
}

// ===== Ordenar =====
if (sortSelect) {
  sortSelect.addEventListener("change", e => {
    const criterio = e.target.value;
    if (!criterio) {
      renderProductos();
      return;
    }
    const copia = [...productos];
    copia.sort((a, b) => {
      if (criterio === "precio" || criterio === "cantidad") {
        return a[criterio] - b[criterio];
      }
      return String(a[criterio]).localeCompare(String(b[criterio]));
    });
    renderProductos(copia);
  });
}

// ===== Exportar PDF =====
if (exportPDFBtn) {
  exportPDFBtn.addEventListener("click", () => {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.text("Inventario de Productos", 14, 20);
      const data = productos.map(p => [p.id, p.modelo, p.linea, p.precio.toFixed(2), p.cantidad]);
      doc.autoTable({
        head: [["ID", "Modelo", "Línea", "Precio", "Cantidad"]],
        body: data,
        startY: 30
      });
      doc.save("inventario.pdf");
    } catch (err) {
      console.error("Error exportando a PDF:", err);
      alert("No fue posible exportar a PDF. Revisa la consola para más detalles.");
    }
  });
}

// ===== Inicialización =====
initCounter();
renderProductos();
