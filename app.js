'use strict';

/* ==========================================================
   Gestor de tareas - JavaScript ES6+
   Modelo de una tarea:
   { id, titulo, descripcion, categoria, prioridad,
     fecha ('YYYY-MM-DD' o ''), completada, creada (timestamp) }
   ========================================================== */

const CLAVE_TAREAS = 'gestor-tareas:tareas';
const CLAVE_CATEGORIAS = 'gestor-tareas:categorias';
const CLAVE_TEMA = 'gestor-tareas:tema';
const CATEGORIAS_BASE = ['Escuela', 'Trabajo', 'Personal', 'Hogar'];
const PESO_PRIORIDAD = { alta: 0, media: 1, baja: 2 };

/* ---------- Iconos (SVG en línea) ---------- */
const svg = (contenido, tam = 18) =>
  `<svg aria-hidden="true" viewBox="0 0 24 24" width="${tam}" height="${tam}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${contenido}</svg>`;

const ICONOS = {
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 16),
  editar: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  borrar: svg('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>'),
  luna: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>', 20),
  sol: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', 20)
};

/* ---------- Referencias al DOM ---------- */
const $ = (selector) => document.querySelector(selector);

const form = $('#form-tarea');
const campoTitulo = $('#titulo');
const campoDescripcion = $('#descripcion');
const campoCategoria = $('#categoria');
const campoPrioridad = $('#prioridad');
const campoFecha = $('#fecha');
const mensaje = $('#mensaje');
const btnGuardar = $('#btn-guardar');
const btnCancelar = $('#btn-cancelar');
const btnNueva = $('#btn-nueva');
const btnTema = $('#btn-tema');
const formCategoria = $('#form-categoria');
const campoNuevaCategoria = $('#nueva-categoria');

const lista = $('#lista');
const resultado = $('#resultado');
const chips = $('#chips');
const tabs = $('#tabs');
const segmentos = $('#segmentos');
const filtroBuscar = $('#buscar');
const filtroPrioridad = $('#f-prioridad');
const filtroOrden = $('#f-orden');
const btnLimpiar = $('#btn-limpiar');

/* ---------- Persistencia (localStorage) ---------- */
const leer = (clave, porDefecto) => {
  try {
    const crudo = localStorage.getItem(clave);
    const dato = crudo ? JSON.parse(crudo) : null;
    return Array.isArray(dato) ? dato : porDefecto;
  } catch {
    return porDefecto; // JSON dañado o almacenamiento bloqueado
  }
};

const escribir = (clave, valor) => {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    mostrarMensaje('No se pudo guardar en el navegador. El almacenamiento está lleno o bloqueado.', 'error');
  }
};

/* ---------- Estado ---------- */
let tareas = leer(CLAVE_TAREAS, []);
let categorias = leer(CLAVE_CATEGORIAS, CATEGORIAS_BASE);
let editandoId = null;
let estadoActual = 'todas';
let categoriaActual = 'todas';

/* ---------- Utilidades ---------- */
const hoy = () => {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
};

const escapar = (texto) =>
  String(texto).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const normalizar = (texto) =>
  texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const crearId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const estaVencida = (t) => !t.completada && t.fecha !== '' && t.fecha < hoy();

const formatearFecha = (iso) => {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
};

// Cada categoría recibe un tono (0-359) calculado a partir de su nombre
const matiz = (nombre) => {
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};

// Días de diferencia entre hoy y una fecha 'YYYY-MM-DD'
const diasHasta = (iso) =>
  Math.round((new Date(`${iso}T00:00:00`) - new Date(`${hoy()}T00:00:00`)) / 86400000);

function textoFecha(t) {
  if (t.completada) return formatearFecha(t.fecha);
  const dif = diasHasta(t.fecha);
  if (dif === 0) return 'Vence hoy';
  if (dif === 1) return 'Vence mañana';
  if (dif === -1) return 'Venció ayer';
  if (dif < -1) return `Venció hace ${-dif} días`;
  if (dif <= 7) return `Vence en ${dif} días`;
  return `Vence el ${formatearFecha(t.fecha)}`;
}

function mostrarMensaje(texto, tipo = '') {
  mensaje.textContent = texto;
  mensaje.className = `mensaje ${tipo}`.trim();
}

/* ---------- Tema claro / oscuro ---------- */
function aplicarTema(tema) {
  document.documentElement.setAttribute('data-tema', tema);
  const oscuro = tema === 'oscuro';
  btnTema.innerHTML = oscuro ? ICONOS.sol : ICONOS.luna;
  btnTema.setAttribute('aria-label', oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
}

btnTema.addEventListener('click', () => {
  const nuevo = document.documentElement.getAttribute('data-tema') === 'oscuro' ? 'claro' : 'oscuro';
  aplicarTema(nuevo);
  try { localStorage.setItem(CLAVE_TEMA, nuevo); } catch { /* sin almacenamiento: no pasa nada */ }
});

/* ---------- Validación ---------- */
function validar(datos) {
  const titulo = datos.titulo.trim();

  if (titulo.length < 3) return { campo: campoTitulo, error: 'El título debe tener al menos 3 caracteres.' };
  if (titulo.length > 80) return { campo: campoTitulo, error: 'El título no puede pasar de 80 caracteres.' };
  if (!categorias.includes(datos.categoria)) return { campo: campoCategoria, error: 'Selecciona una categoría válida.' };
  if (!(datos.prioridad in PESO_PRIORIDAD)) return { campo: campoPrioridad, error: 'Selecciona una prioridad válida.' };

  if (datos.fecha !== '') {
    if (Number.isNaN(Date.parse(datos.fecha))) return { campo: campoFecha, error: 'La fecha no es válida.' };
    if (editandoId === null && datos.fecha < hoy()) {
      return { campo: campoFecha, error: 'La fecha límite no puede estar en el pasado.' };
    }
  }

  const duplicada = tareas.some(
    (t) => t.id !== editandoId
      && t.categoria === datos.categoria
      && normalizar(t.titulo) === normalizar(titulo)
  );
  if (duplicada) return { campo: campoTitulo, error: 'Ya existe una tarea con ese título en esta categoría.' };

  return null;
}

/* ---------- Categorías ---------- */
function pintarSelectCategoria() {
  const actual = campoCategoria.value;
  campoCategoria.innerHTML = categorias
    .map((c) => `<option value="${escapar(c)}">${escapar(c)}</option>`)
    .join('');
  if (categorias.includes(actual)) campoCategoria.value = actual;
}

function pintarChips() {
  const cuenta = (c) => tareas.filter((t) => t.categoria === c).length;
  const chip = (valor, nombre, n, h) => `
    <button type="button" class="chip" data-categoria="${escapar(valor)}"
            aria-pressed="${categoriaActual === valor}">
      ${h === undefined ? '' : `<span class="punto" style="--h:${h}"></span>`}
      ${escapar(nombre)} <span class="cuenta">${n}</span>
    </button>`;

  chips.innerHTML = chip('todas', 'Todas las categorías', tareas.length)
    + categorias.map((c) => chip(c, c, cuenta(c), matiz(c))).join('');
}

chips.addEventListener('click', (e) => {
  const boton = e.target.closest('[data-categoria]');
  if (!boton) return;
  categoriaActual = boton.dataset.categoria;
  render();
});

formCategoria.addEventListener('submit', (e) => {
  e.preventDefault();
  const nombre = campoNuevaCategoria.value.trim();

  if (nombre.length < 2) return mostrarMensaje('La categoría debe tener al menos 2 caracteres.', 'error');
  if (categorias.some((c) => normalizar(c) === normalizar(nombre))) {
    return mostrarMensaje('Esa categoría ya existe.', 'error');
  }

  categorias = [...categorias, nombre];
  escribir(CLAVE_CATEGORIAS, categorias);
  pintarSelectCategoria();
  campoCategoria.value = nombre;
  campoNuevaCategoria.value = '';
  mostrarMensaje(`Categoría "${nombre}" creada.`, 'exito');
  render();
});

/* ---------- Filtrado, búsqueda y orden ---------- */
function obtenerVisibles() {
  const texto = normalizar(filtroBuscar.value.trim());
  const prioridad = filtroPrioridad.value;

  const visibles = tareas.filter((t) => {
    if (texto && !normalizar(`${t.titulo} ${t.descripcion}`).includes(texto)) return false;
    if (categoriaActual !== 'todas' && t.categoria !== categoriaActual) return false;
    if (prioridad !== 'todas' && t.prioridad !== prioridad) return false;
    if (estadoActual === 'pendientes' && t.completada) return false;
    if (estadoActual === 'completadas' && !t.completada) return false;
    if (estadoActual === 'vencidas' && !estaVencida(t)) return false;
    return true;
  });

  const comparadores = {
    creacion: (a, b) => b.creada - a.creada,
    fecha: (a, b) => (a.fecha || '9999-99-99').localeCompare(b.fecha || '9999-99-99'),
    prioridad: (a, b) => PESO_PRIORIDAD[a.prioridad] - PESO_PRIORIDAD[b.prioridad],
    titulo: (a, b) => a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base' })
  };
  return visibles.sort(comparadores[filtroOrden.value]);
}

/* ---------- Render ---------- */
function plantillaTarea(t) {
  const vencida = estaVencida(t);
  const clases = ['tarea', `prio-${t.prioridad}`, t.completada ? 'completada' : '']
    .filter(Boolean).join(' ');

  let fecha = '';
  if (t.fecha) {
    const claseFecha = vencida ? 'vencida' : (!t.completada && diasHasta(t.fecha) === 0 ? 'hoy' : '');
    fecha = `<span class="fecha ${claseFecha}">${textoFecha(t)}</span>`;
  }

  return `
    <li class="${clases}" data-id="${t.id}">
      <label class="check">
        <input type="checkbox" ${t.completada ? 'checked' : ''} data-accion="alternar"
               aria-label="Completada: ${escapar(t.titulo)}">
        <span class="caja">${ICONOS.check}</span>
      </label>
      <div>
        <p class="titulo">${escapar(t.titulo)}</p>
        ${t.descripcion ? `<p class="desc">${escapar(t.descripcion)}</p>` : ''}
        <div class="meta">
          <span class="cat"><span class="punto" style="--h:${matiz(t.categoria)}"></span>${escapar(t.categoria)}</span>
          <span class="prio">Prioridad ${t.prioridad}</span>
          ${fecha}
        </div>
      </div>
      <div class="botones">
        <button type="button" class="btn-fila" data-accion="editar" aria-label="Editar: ${escapar(t.titulo)}">${ICONOS.editar}</button>
        <button type="button" class="btn-fila borrar" data-accion="eliminar" aria-label="Eliminar: ${escapar(t.titulo)}">${ICONOS.borrar}</button>
      </div>
    </li>`;
}

function pintarEncabezado() {
  const total = tareas.length;
  const completadas = tareas.filter((t) => t.completada).length;
  const vencidas = tareas.filter(estaVencida).length;
  const pendientes = total - completadas;

  // Fecha de hoy
  const fechaLarga = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  $('#hero-fecha').textContent = fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1);

  // Frase de estado
  let estado;
  if (total === 0) estado = 'Aún no tienes tareas';
  else if (pendientes === 0) estado = 'Todo al día';
  else estado = `Te ${pendientes === 1 ? 'queda' : 'quedan'} ${pendientes} ${pendientes === 1 ? 'tarea' : 'tareas'} por hacer`;
  $('#hero-estado').textContent = estado;

  let detalle;
  if (total === 0) detalle = 'Agrega la primera con el formulario.';
  else if (vencidas > 0) detalle = `${vencidas} ${vencidas === 1 ? 'tarea vencida' : 'tareas vencidas'}. Empieza por ${vencidas === 1 ? 'esa' : 'esas'}.`;
  else detalle = `${completadas} de ${total} completadas.`;
  $('#hero-detalle').textContent = detalle;

  // Barra de segmentos: una pieza por tarea (completadas, vencidas, pendientes)
  segmentos.setAttribute('aria-label', `${completadas} de ${total} tareas completadas`);
  if (total === 0) {
    segmentos.innerHTML = '<span class="segmentos-vacio"></span>';
  } else {
    const orden = [
      ...tareas.filter((t) => t.completada).map(() => 'hecha'),
      ...tareas.filter(estaVencida).map(() => 'vencida'),
      ...tareas.filter((t) => !t.completada && !estaVencida(t)).map(() => '')
    ];
    segmentos.innerHTML = orden
      .map((clase, i) => `<span class="seg ${clase}" style="--i:${Math.min(i, 24)}"></span>`)
      .join('');
  }

  // Pestañas con contador
  $('#n-todas').textContent = total;
  $('#n-pendientes').textContent = pendientes;
  $('#n-completadas').textContent = completadas;
  $('#n-vencidas').textContent = vencidas;
  tabs.querySelectorAll('button').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.estado === estadoActual)));
}

function hayFiltrosActivos() {
  return filtroBuscar.value.trim() !== ''
    || filtroPrioridad.value !== 'todas'
    || estadoActual !== 'todas'
    || categoriaActual !== 'todas';
}

function render() {
  // Si la categoría filtrada ya no existe, se vuelve a "todas"
  if (categoriaActual !== 'todas' && !categorias.includes(categoriaActual)) categoriaActual = 'todas';

  const visibles = obtenerVisibles();

  if (visibles.length === 0) {
    lista.innerHTML = tareas.length === 0
      ? `<li class="vacio"><strong>Tu lista está vacía</strong><p>Escribe un título en el formulario y pulsa "Agregar tarea".</p></li>`
      : `<li class="vacio"><strong>No hay tareas con estos filtros</strong><p>Prueba con otra búsqueda o quita los filtros.</p>
         <button type="button" class="btn" data-accion="limpiar-filtros">Quitar filtros</button></li>`;
  } else {
    lista.innerHTML = visibles.map(plantillaTarea).join('');
  }

  resultado.textContent = tareas.length && hayFiltrosActivos()
    ? `Mostrando ${visibles.length} de ${tareas.length} tareas.`
    : '';

  pintarEncabezado();
  pintarChips();
}

/* ---------- Formulario: agregar y editar ---------- */
function limpiarFormulario() {
  form.reset();
  campoPrioridad.value = 'media';
  editandoId = null;
  btnGuardar.textContent = 'Agregar tarea';
  btnCancelar.hidden = true;
  $('#titulo-form').textContent = 'Nueva tarea';
  [campoTitulo, campoFecha].forEach((c) => c.classList.remove('invalido'));
}

form.addEventListener('submit', (e) => {
  e.preventDefault();

  const datos = {
    titulo: campoTitulo.value,
    descripcion: campoDescripcion.value.trim(),
    categoria: campoCategoria.value,
    prioridad: campoPrioridad.value,
    fecha: campoFecha.value
  };

  [campoTitulo, campoFecha].forEach((c) => c.classList.remove('invalido'));
  const problema = validar(datos);
  if (problema) {
    problema.campo.classList.add('invalido');
    problema.campo.focus();
    return mostrarMensaje(problema.error, 'error');
  }

  datos.titulo = datos.titulo.trim();

  if (editandoId === null) {
    tareas = [{ id: crearId(), ...datos, completada: false, creada: Date.now() }, ...tareas];
    mostrarMensaje('Tarea agregada.', 'exito');
  } else {
    tareas = tareas.map((t) => (t.id === editandoId ? { ...t, ...datos } : t));
    mostrarMensaje('Cambios guardados.', 'exito');
  }

  escribir(CLAVE_TAREAS, tareas);
  limpiarFormulario();
  render();
});

btnCancelar.addEventListener('click', () => {
  limpiarFormulario();
  mostrarMensaje('Edición cancelada.');
});

btnNueva.addEventListener('click', () => {
  campoTitulo.scrollIntoView({ block: 'center' });
  campoTitulo.focus();
});

/* ---------- Acciones sobre la lista (delegación de eventos) ---------- */
function quitarFiltros() {
  filtroBuscar.value = '';
  filtroPrioridad.value = 'todas';
  estadoActual = 'todas';
  categoriaActual = 'todas';
  render();
}

lista.addEventListener('click', (e) => {
  const boton = e.target.closest('[data-accion]');
  if (!boton) return;

  if (boton.dataset.accion === 'limpiar-filtros') return quitarFiltros();

  const fila = boton.closest('.tarea');
  if (!fila) return;
  const id = fila.dataset.id;
  const tarea = tareas.find((t) => t.id === id);
  if (!tarea) return;

  switch (boton.dataset.accion) {
    case 'alternar':
      tareas = tareas.map((t) => (t.id === id ? { ...t, completada: !t.completada } : t));
      escribir(CLAVE_TAREAS, tareas);
      render();
      break;

    case 'editar':
      editandoId = id;
      campoTitulo.value = tarea.titulo;
      campoDescripcion.value = tarea.descripcion;
      campoCategoria.value = tarea.categoria;
      campoPrioridad.value = tarea.prioridad;
      campoFecha.value = tarea.fecha;
      btnGuardar.textContent = 'Guardar cambios';
      btnCancelar.hidden = false;
      $('#titulo-form').textContent = 'Editar tarea';
      mostrarMensaje('Modifica los campos y guarda los cambios.');
      campoTitulo.scrollIntoView({ block: 'center' });
      campoTitulo.focus();
      break;

    case 'eliminar':
      if (confirm(`¿Eliminar la tarea "${tarea.titulo}"?`)) {
        tareas = tareas.filter((t) => t.id !== id);
        escribir(CLAVE_TAREAS, tareas);
        if (editandoId === id) limpiarFormulario();
        mostrarMensaje('Tarea eliminada.', 'exito');
        render();
      }
      break;
  }
});

btnLimpiar.addEventListener('click', () => {
  const cantidad = tareas.filter((t) => t.completada).length;
  if (cantidad === 0) return mostrarMensaje('No hay tareas completadas para eliminar.', 'error');
  if (confirm(`¿Eliminar ${cantidad} tarea(s) completada(s)?`)) {
    tareas = tareas.filter((t) => !t.completada);
    escribir(CLAVE_TAREAS, tareas);
    mostrarMensaje(`${cantidad} tarea(s) eliminada(s).`, 'exito');
    render();
  }
});

/* ---------- Búsqueda y filtros ---------- */
tabs.addEventListener('click', (e) => {
  const boton = e.target.closest('[data-estado]');
  if (!boton) return;
  estadoActual = boton.dataset.estado;
  render();
});

filtroBuscar.addEventListener('input', render);
filtroPrioridad.addEventListener('change', render);
filtroOrden.addEventListener('change', render);

/* ---------- Inicio ---------- */
aplicarTema(document.documentElement.getAttribute('data-tema') || 'claro');
pintarSelectCategoria();
render();
