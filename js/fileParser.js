// fileParser.js — Procesa y valida archivos TXT y JSON de tests.

/** Convierte texto a identificador seguro (sin tildes ni símbolos). */
export const slug = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Valida y normaliza un test. Devuelve { test, errores }. */
export function validar(raw) {
  const errores = [];
  const categoria = String(raw?.categoria ?? '').trim();
  const titulo = String(raw?.titulo ?? '').trim();
  if (!categoria) errores.push('Falta la categoría.');
  if (!titulo) errores.push('Falta el título.');
  if (!Array.isArray(raw?.preguntas) || !raw.preguntas.length) errores.push('El test no tiene preguntas.');

  const preguntas = [];
  (Array.isArray(raw?.preguntas) ? raw.preguntas : []).forEach((p, i) => {
    const ref = `Pregunta ${i + 1}${p?.linea ? ` (línea ${p.linea})` : ''}`;
    const opciones = {};
    Object.entries(p?.opciones || {}).forEach(([k, v]) => {
      const t = String(v).trim();
      if (t) opciones[k.trim().toUpperCase()] = t;
    });
    const correcta = String(p?.correcta ?? '').trim().toUpperCase();
    const texto = String(p?.texto ?? '').trim();
    if (!texto) errores.push(`${ref}: falta el enunciado.`);
    if (Object.keys(opciones).length < 2) errores.push(`${ref}: necesita al menos 2 opciones.`);
    if (!opciones[correcta]) errores.push(`${ref}: la correcta «${correcta || 'vacía'}» no coincide con ninguna opción.`);
    const q = { id: i + 1, texto, opciones, correcta };
    if (p?.explicacion) q.explicacion = String(p.explicacion).trim();
    preguntas.push(q);
  });

  if (errores.length) return { test: null, errores };
  return { test: { id: slug(`${categoria}-${titulo}`), categoria, titulo, preguntas }, errores };
}

const clave = s => s.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const ETIQUETAS = /^(CATEGORIA|TITULO|PREGUNTA|CORRECTA|[A-F])$/;

/** Parser del formato TXT con etiquetas [Categoria] [Titulo] [Pregunta] [A..F] [Correcta]. */
export function parseTXT(texto) {
  const meta = { categoria: '', titulo: '' };
  const preguntas = [], errores = [];
  let q = null, ultimo = null; // 'ultimo' permite continuar textos de varias líneas
  const re = /^\s*\[([^\]]+)\]\s*(.*)$/;

  texto.replace(/^\uFEFF/, '').split(/\r?\n/).forEach((linea, i) => {
    const m = linea.match(re);
    const et = m && clave(m[1]);
    if (!m || !ETIQUETAS.test(et)) {
      if (linea.trim() && ultimo) ultimo.o[ultimo.k] = `${ultimo.o[ultimo.k]} ${linea.trim()}`.trim();
      return;
    }
    const v = m[2].trim(), n = i + 1;
    if (et === 'CATEGORIA') { meta.categoria = v; ultimo = { o: meta, k: 'categoria' }; }
    else if (et === 'TITULO') { meta.titulo = v; ultimo = { o: meta, k: 'titulo' }; }
    else if (et === 'PREGUNTA') { q = { texto: v, opciones: {}, correcta: '', linea: n }; preguntas.push(q); ultimo = { o: q, k: 'texto' }; }
    else if (!q) errores.push(`Línea ${n}: «[${m[1].trim()}]» aparece antes de la primera [Pregunta].`);
    else if (et === 'CORRECTA') { q.correcta = v; ultimo = null; }
    else { q.opciones[et] = v; ultimo = { o: q.opciones, k: et }; }
  });

  const r = validar({ ...meta, preguntas });
  return { test: r.test, errores: [...errores, ...r.errores] };
}

/** Parser del formato JSON. */
export function parseJSON(texto) {
  try { return validar(JSON.parse(texto)); }
  catch (e) { return { test: null, errores: [`El archivo no es un JSON válido: ${e.message}`] }; }
}
