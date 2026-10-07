// fileParser.js — Validación de los tests JSON oficiales (data/tests/*.json).

/** Convierte texto a identificador seguro (sin tildes ni símbolos). */
export const slug = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Valida y normaliza un test. Devuelve { test, errores } (test es null si hay errores). */
export function validar(raw) {
  const errores = [];
  const categoria = String(raw?.categoria ?? '').trim();
  const titulo = String(raw?.titulo ?? '').trim();
  if (!categoria) errores.push('Falta la categoría.');
  if (!titulo) errores.push('Falta el título.');
  if (!Array.isArray(raw?.preguntas) || !raw.preguntas.length) errores.push('El test no tiene preguntas.');

  const preguntas = [];
  (Array.isArray(raw?.preguntas) ? raw.preguntas : []).forEach((p, i) => {
    const ref = `Pregunta ${i + 1}`;
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
    const q = { id: i + 1, texto, opciones, correcta }; // el id se asigna por posición
    if (p?.explicacion) q.explicacion = String(p.explicacion).trim();
    preguntas.push(q);
  });

  if (errores.length) return { test: null, errores };
  return { test: { categoria, titulo, preguntas }, errores };
}
