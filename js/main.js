// main.js — Controlador principal y navegación.
import * as ui from './ui.js';
import * as store from './storage.js';
import { Sesion } from './testEngine.js';
import { parseTXT, parseJSON, validar } from './fileParser.js';

let oficiales = [], sesion = null, timer = null, config = {};

/* ---------- Tests oficiales (manifest.json) ---------- */
const getJSON = async u => { const r = await fetch(u, { cache: 'no-cache' }); if (!r.ok) throw new Error(r.status); return r.json(); };

async function cargarOficiales() {
  oficiales = [];
  try {
    const m = await getJSON('./data/manifest.json');
    for (const c of m.categorias || []) for (const f of c.archivos || []) {
      try {
        const raw = await getJSON(`./data/tests/${f}`);
        const { test, errores } = validar({ ...raw, categoria: raw.categoria || c.nombre });
        if (test) oficiales.push({ ...test, id: `of-${test.id}`, origen: 'oficial' });
        else console.warn(`Test oficial «${f}» ignorado:`, errores);
      } catch (e) { console.warn(`No se pudo cargar ${f}`, e); }
    }
  } catch (e) { console.info('Sin manifest.json', e); }
}

/* ---------- Menú ---------- */
function menu() {
  const todos = [...oficiales, ...store.getTests().map(t => ({ ...t, origen: 'propio' }))];
  const cats = new Map();
  todos.forEach(t => { if (!cats.has(t.categoria)) cats.set(t.categoria, []); cats.get(t.categoria).push(t); });
  ui.renderMenu(cats, {
    onStart: iniciar, ultimo: store.lastStat,
    onDelete: async t => { if (await ui.confirmar(`¿Eliminar «${t.titulo}» y sus estadísticas?`)) { store.deleteTest(t.id); menu(); ui.toast('Test eliminado'); } }
  });
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

/* ---------- Crear: subida de archivos ---------- */
async function subir(input, parser) {
  const msgs = [];
  for (const f of input.files) {
    const { test, errores } = parser(await f.text());
    if (!test || errores.length) { msgs.push({ texto: `«${f.name}» no se pudo importar:`, errores }); continue; }
    if (store.hasTest(test.id) && !await ui.confirmar(`Ya existe «${test.titulo}» en ${test.categoria}. ¿Reemplazarlo?`)) continue;
    msgs.push(store.saveTest(test)
      ? { ok: true, texto: `«${test.titulo}» importado en ${test.categoria} (${test.preguntas.length} preguntas).` }
      : { texto: `«${f.name}»: no hay espacio en el navegador.`, errores: ['Exporta un backup y elimina tests antiguos.'] });
  }
  input.value = '';
  ui.mensajesCrear(msgs); menu();
}

const PLANTILLAS = {
  txt: ['plantilla_test.txt', `[Categoria] Celador\n[Titulo] Tema 1 Celador\n\n[Pregunta] ¿Cuál grupo de medicamentos es el más comúnmente implicado en una caída?\n[A] Antihistamínicos de primera generación\n[B] Antidiabéticos orales\n[C] Vasodilatadores\n[D] Benzodiacepinas\n[Correcta] D\n`, 'text/plain'],
  json: ['plantilla_test.json', JSON.stringify({ categoria: 'Celador', titulo: 'Tema 1 Celador', preguntas: [{ id: 1, texto: '¿Cuál grupo de medicamentos es el más comúnmente implicado en una caída?', opciones: { A: 'Antihistamínicos de primera generación', B: 'Antidiabéticos orales', C: 'Vasodilatadores', D: 'Benzodiacepinas' }, correcta: 'D', explicacion: 'Opcional: texto que se muestra tras responder.' }] }, null, 2), 'application/json']
};

/* ---------- Inicio ---------- */
function actualizarUso() { ui.$('#uso-almacen').textContent = `Espacio usado en este navegador: ${store.usoKB().toFixed(1)} KB de unos 5 000 KB disponibles.`; }

document.addEventListener('DOMContentLoaded', async () => {
  ui.initModales();
  document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => { if (b.dataset.go === 'pantalla-guardado') actualizarUso(); ui.mostrar(b.dataset.go); }));
  ui.$('#in-txt').addEventListener('change', e => subir(e.target, parseTXT));
  ui.$('#in-json').addEventListener('change', e => subir(e.target, parseJSON));
  document.querySelectorAll('[data-plantilla]').forEach(b => b.addEventListener('click', () => store.descargar(...PLANTILLAS[b.dataset.plantilla].slice(0, 1), PLANTILLAS[b.dataset.plantilla][1], PLANTILLAS[b.dataset.plantilla][2])));
  ui.$('#btn-exportar').addEventListener('click', () => { store.exportarBackup(); ui.toast('Backup descargado'); });
  ui.$('#in-backup').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      if (await ui.confirmar('Se fusionará con tus datos actuales; los tests con el mismo nombre se reemplazarán. ¿Continuar?')) {
        const r = store.importarBackup(await f.text()); menu(); actualizarUso(); ui.toast(`Backup restaurado: ${r.tests} tests`);
      }
    } catch (err) { ui.toast(err.message); }
    e.target.value = '';
  });
  await cargarOficiales();
  menu();
  ui.mostrar('pantalla-menu');
});
