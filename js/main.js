// main.js — Controlador principal y navegación.
import * as ui from './ui.js';
import * as store from './storage.js';
import { Sesion } from './testEngine.js';
import { slug, validar } from './fileParser.js';

let tests = [], sesion = null, timer = null, config = {};

/* ---------- Carga de tests (data/manifest.json) ---------- */
const getJSON = async u => { const r = await fetch(u, { cache: 'no-cache' }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); };

/** Lee el manifest y todos los tests. Devuelve la lista de archivos con problemas. */
async function cargarTests() {
  tests = [];
  const fallidos = [];
  try {
    const m = await getJSON('./data/manifest.json');
    for (const c of m.categorias || []) for (const f of c.archivos || []) {
      try {
        const raw = await getJSON(`./data/tests/${f}`);
        const { test, errores } = validar({ ...raw, categoria: raw.categoria || c.nombre });
        if (test) tests.push({ ...test, id: slug(f.replace(/\.json$/i, '')) }); // el id sale del nombre del archivo
        else { fallidos.push(f); console.warn(`Test «${f}» ignorado:`, errores); }
      } catch (e) { fallidos.push(f); console.warn(`No se pudo cargar ${f}`, e); }
    }
  } catch (e) { console.warn('No se pudo leer data/manifest.json', e); }
  return fallidos;
}

/* ---------- Menú ---------- */
function menu() {
  const cats = new Map();
  tests.forEach(t => { if (!cats.has(t.categoria)) cats.set(t.categoria, []); cats.get(t.categoria).push(t); });
  ui.renderMenu(cats, { onStart: iniciar, ultimo: store.lastStat });
}

/* ---------- Flujo de test ---------- */
async function iniciar(test, modo) {
  config = { test, modo };
  if (modo === 'examen') {
    const o = await ui.configExamen(test.preguntas.length);
    if (!o) return;
    config = { ...config, ...o };
  }
  sesion = new Sesion(test, modo, config);
  ui.mostrar('pantalla-test');
  pintar();
  clearInterval(timer);
  timer = setInterval(tick, 1000);
}

function tick() {
  if (!sesion) return;
  const r = sesion.restante();
  if (r === null) return ui.setTemporizador(ui.fmtTiempo(sesion.segundos()));
  ui.setTemporizador(ui.fmtTiempo(r), r <= 60);
  if (r <= 0) { ui.toast('Se acabó el tiempo'); terminar(); }
}

function pintar() {
  ui.renderPregunta(sesion, {
    onAnswer: k => { sesion.responder(k); pintar(); },
    onNext: () => { if (sesion.siguiente()) { pintar(); window.scrollTo(0, 0); } else terminar(); },
    onPrev: () => { sesion.anterior(); pintar(); window.scrollTo(0, 0); },
    onFinish: async () => {
      const r = sesion.resultados();
      if (!r.blancos || await ui.confirmar(`Tienes ${r.blancos} pregunta${r.blancos > 1 ? 's' : ''} sin responder. ¿Finalizar igualmente?`)) terminar();
    },
    onExit: async () => { if (await ui.confirmar('¿Salir? Se perderá el progreso de este test.')) salir(); }
  });
  tick();
}

function terminar() {
  clearInterval(timer);
  const res = sesion.resultados();
  if (sesion.ronda === 1) { // las estadísticas cuentan solo la primera ronda
    store.addStat({ testId: sesion.test.id, fecha: new Date().toISOString(), modo: sesion.modo, aciertos: res.aciertos, fallos: res.fallos, blancos: res.blancos, nota: res.nota, segundos: res.segundos });
    store.addFallos(sesion.test.id, sesion.falladas().map(it => it.p.id));
  }
  ui.renderResultado(sesion, res, {
    onBucle: () => { sesion.iniciarBucle(); ui.mostrar('pantalla-test'); pintar(); timer = setInterval(tick, 1000); },
    onRepetir: () => iniciar(config.test, config.modo),
    onMenu: salir
  });
  ui.mostrar('pantalla-resultado');
}

function salir() { clearInterval(timer); sesion = null; menu(); ui.mostrar('pantalla-menu'); }

/* ---------- Inicio ---------- */
function actualizarUso() { ui.$('#uso-almacen').textContent = `Espacio usado en este navegador: ${store.usoKB().toFixed(1)} KB de unos 5 000 KB disponibles.`; }

document.addEventListener('DOMContentLoaded', async () => {
  ui.initModales();
  document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => { if (b.dataset.go === 'pantalla-guardado') actualizarUso(); ui.mostrar(b.dataset.go); }));
  ui.$('#btn-exportar').addEventListener('click', () => { store.exportarBackup(); ui.toast('Estadísticas descargadas'); });
  ui.$('#in-backup').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      if (await ui.confirmar('Se añadirán a tus estadísticas actuales los intentos que no tengas. ¿Continuar?')) {
        const r = store.importarBackup(await f.text()); actualizarUso(); ui.toast(`Importados ${r.intentos} intentos nuevos`);
        menu();
      }
    } catch (err) { ui.toast(err.message); }
    e.target.value = '';
  });
  const fallidos = await cargarTests();
  menu();
  ui.mostrar('pantalla-menu');
  if (fallidos.length) ui.toast(`No se pudo cargar: ${fallidos.join(', ')} (detalles en la consola)`);
});
