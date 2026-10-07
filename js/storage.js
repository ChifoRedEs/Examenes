// storage.js — Estadísticas en localStorage y copia de seguridad (importar / exportar).
const KEY = 'examenes_test_stats_v1';
const vacio = () => ({ version: 1, stats: [], fallos: {} });

function cargar() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); return d && d.version ? { ...vacio(), ...d } : vacio(); }
  catch { return vacio(); }
}
let data = cargar();

/** Guarda en localStorage. Devuelve false si el almacenamiento está lleno o bloqueado. */
function guardar() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
}

/** Un registro por intento (solo la primera ronda). */
export function addStat(s) { data.stats.push(s); if (data.stats.length > 1000) data.stats.shift(); guardar(); }
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
  descargar('backup_estadisticas.json', JSON.stringify({ ...data, exportado: new Date().toISOString() }, null, 2));
}

/** Fusiona un backup con las estadísticas actuales (sin duplicar intentos). */
export function importarBackup(texto) {
  let raw;
  try { raw = JSON.parse(texto); } catch { throw new Error('El archivo no es un JSON válido.'); }
  if (!raw || !Array.isArray(raw.stats)) throw new Error('No parece una copia de estadísticas de esta app.');
  const vistos = new Set(data.stats.map(s => `${s.testId}|${s.fecha}`));
  let n = 0;
  raw.stats.forEach(s => {
    if (s?.testId && s.fecha && !vistos.has(`${s.testId}|${s.fecha}`)) { data.stats.push(s); vistos.add(`${s.testId}|${s.fecha}`); n++; }
  });
  data.stats.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  Object.entries(raw.fallos || {}).forEach(([id, m]) => {
    const f = (data.fallos[id] ??= {});
    Object.entries(m || {}).forEach(([q, c]) => { f[q] = Math.max(f[q] || 0, Number(c) || 0); });
  });
  if (!guardar()) throw new Error('No hay espacio suficiente en el navegador.');
  return { intentos: n };
}
