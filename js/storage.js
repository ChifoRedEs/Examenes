// storage.js — localStorage y copia de seguridad (importar / exportar).
import { validar } from './fileParser.js';

const KEY = 'examenes_test_v1';
const vacio = () => ({ version: 1, tests: [], stats: [], fallos: {} });

function cargar() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); return d && d.version ? { ...vacio(), ...d } : vacio(); }
  catch { return vacio(); }
}
let data = cargar();

/** Guarda en localStorage. Devuelve false si el almacenamiento está lleno o bloqueado. */
function guardar() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
}

export const getTests = () => data.tests;
export const hasTest = id => data.tests.some(t => t.id === id);

export function saveTest(t) {
  const i = data.tests.findIndex(x => x.id === t.id);
  if (i >= 0) data.tests[i] = t; else data.tests.push(t);
  return guardar();
}
export function deleteTest(id) {
  data.tests = data.tests.filter(t => t.id !== id);
  data.stats = data.stats.filter(s => s.testId !== id);
  delete data.fallos[id];
  guardar();
}

/** Estadísticas: un registro por intento (primera ronda). */
export function addStat(s) { data.stats.push(s); if (data.stats.length > 500) data.stats.shift(); guardar(); }
export const lastStat = id => [...data.stats].reverse().find(s => s.testId === id);

/** Cuenta cuántas veces se ha fallado cada pregunta (id de pregunta → nº de fallos). */
export function addFallos(testId, ids) {
  const f = (data.fallos[testId] ??= {});
  ids.forEach(q => { f[q] = (f[q] || 0) + 1; });
  guardar();
}

export const usoKB = () => (new Blob([localStorage.getItem(KEY) || '']).size / 1024);

/** Descarga un archivo generado en el navegador. */
export function descargar(nombre, contenido, tipo = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  a.download = nombre;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function exportarBackup() {
  descargar('backup.json', JSON.stringify({ ...data, version: 1, exportado: new Date().toISOString() }, null, 2));
}

/** Fusiona un backup con los datos actuales (los tests con el mismo id se reemplazan). */
export function importarBackup(texto) {
  let raw;
  try { raw = JSON.parse(texto); } catch { throw new Error('El archivo no es un JSON válido.'); }
  if (!raw || !Array.isArray(raw.tests)) throw new Error('No parece una copia de seguridad de esta app.');
  let n = 0;
  raw.tests.forEach(t => { const { test } = validar(t); if (test) { saveTestMem(test); n++; } });
  if (Array.isArray(raw.stats)) {
    const vistos = new Set(data.stats.map(s => `${s.testId}|${s.fecha}`));
    raw.stats.forEach(s => { if (s?.testId && !vistos.has(`${s.testId}|${s.fecha}`)) data.stats.push(s); });
    data.stats.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  }
  Object.entries(raw.fallos || {}).forEach(([id, m]) => {
    const f = (data.fallos[id] ??= {});
    Object.entries(m || {}).forEach(([q, c]) => { f[q] = Math.max(f[q] || 0, Number(c) || 0); });
  });
  if (!guardar()) throw new Error('No hay espacio suficiente en el navegador.');
  return { tests: n };
}
function saveTestMem(t) { const i = data.tests.findIndex(x => x.id === t.id); if (i >= 0) data.tests[i] = t; else data.tests.push(t); }
