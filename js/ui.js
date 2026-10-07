// ui.js — Manipulación del DOM, pantallas, modales y renderizado.
const LET = 'ABCDEF';
export const $ = (s, r = document) => r.querySelector(s);

/** Crea elementos de forma segura (textContent, nunca innerHTML). */
export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach(c => c != null && e.append(c.nodeType ? c : document.createTextNode(c)));
  return e;
}

export const fmtTiempo = s => { s = Math.max(0, s); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

/** Muestra una pantalla y actualiza la barra de navegación. */
export function mostrar(id) {
  document.querySelectorAll('.pantalla').forEach(s => { s.hidden = s.id !== id; });
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('activo', b.dataset.go === id));
  $('#nav').hidden = ['pantalla-test', 'pantalla-resultado'].includes(id);
  window.scrollTo(0, 0);
}

let tt;
export function toast(m) {
  const t = $('#toast'); t.textContent = m; t.classList.add('visible');
  clearTimeout(tt); tt = setTimeout(() => t.classList.remove('visible'), 2800);
}

/* ---------- Modales ---------- */
export function initModales() {
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-modal]');
    if (b) $('#' + b.dataset.modal).showModal();
    if (e.target instanceof HTMLDialogElement) e.target.close(); // clic en el fondo
  });
}
export function confirmar(msg) {
  return new Promise(res => {
    const d = $('#modal-confirm'); $('#confirm-msg').textContent = msg; d.returnValue = '';
    d.addEventListener('close', () => res(d.returnValue === 'si'), { once: true }); d.showModal();
  });
}
export function configExamen(n) {
  return new Promise(res => {
    const d = $('#modal-examen'); $('#ex-min').value = n; d.returnValue = '';
    d.addEventListener('close', () => res(d.returnValue === 'si'
      ? { minutos: Math.max(0, parseInt($('#ex-min').value, 10) || 0), penal: parseFloat($('#ex-pen').value) || 0 } : null), { once: true });
    d.showModal();
  });
}

/* ---------- Menú principal ---------- */
export function renderMenu(cats, { onStart, onDelete, ultimo }) {
  const cont = $('#menu-lista');
  const abiertas = new Set([...cont.querySelectorAll('details[open] .cat-nombre')].map(e => e.textContent));
  cont.replaceChildren();
  if (!cats.size) {
    cont.append(h('div', { class: 'vacio' }, h('p', { class: 'vacio-icono' }, '📚'),
      h('p', {}, h('b', {}, 'Todavía no hay tests')), h('p', { class: 'ayuda' }, 'Ve a «Crear» y sube tu primer test en TXT o JSON.')));
    return;
  }
  [...cats.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es')).forEach(([nombre, tests]) => {
    const det = h('details', { class: 'categoria', open: abiertas.has(nombre) },
      h('summary', {}, h('span', { class: 'cat-nombre' }, nombre), h('span', { class: 'cuenta' }, `${tests.length} test${tests.length > 1 ? 's' : ''}`)));
    tests.sort((a, b) => a.titulo.localeCompare(b.titulo, 'es', { numeric: true })).forEach(t => {
      const u = ultimo(t.id);
      det.append(h('article', { class: 'tarjeta-test' },
        h('div', {}, h('h3', {}, t.titulo),
          h('p', { class: 'meta' }, `${t.preguntas.length} preguntas`, u ? ` · Último: ${u.nota.toFixed(1)}/10` : '',
            h('span', { class: `etiqueta ${t.origen}` }, t.origen === 'oficial' ? 'Oficial' : 'Propio'))),
        h('div', { class: 'tarjeta-acciones' },
          h('button', { class: 'btn btn-primario', onclick: () => onStart(t, 'repaso') }, 'Repaso'),
          h('button', { class: 'btn btn-sec', onclick: () => onStart(t, 'examen') }, 'Examen'),
          t.origen === 'propio' ? h('button', { class: 'btn-icono', 'aria-label': `Eliminar ${t.titulo}`, onclick: () => onDelete(t) }, '🗑') : null)));
    });
    cont.append(det);
  });
}

/* ---------- Pregunta en curso ---------- */
export function setTemporizador(txt, alerta = false) {
  const el = $('#temporizador'); if (!el) return;
  el.textContent = txt; el.classList.toggle('alerta', alerta);
}

export function renderPregunta(s, cb) {
  const it = s.actual(), repaso = s.modoRonda === 'repaso', resuelta = repaso && it.resp !== null;
  const total = s.items.length, n = s.idx + 1, r = s.resultados();
  const bloq = s.bloqueos[it.p.id] || [];

  $('#test-cabecera').replaceChildren(
    h('div', { class: 'barra-sup' },
      h('button', { class: 'btn-texto', onclick: cb.onExit }, '← Salir'),
      h('span', { class: 'ronda' }, s.ronda > 1 ? `Repaso de falladas · ronda ${s.ronda}` : (s.modo === 'examen' ? 'Examen' : 'Repaso')),
      h('span', { id: 'temporizador', class: 'temporizador' })),
    h('div', { class: 'progreso', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': n }, h('div', { style: `width:${n / total * 100}%` })),
    h('div', { class: 'contadores' }, h('span', {}, `Pregunta ${n} de ${total}`),
      repaso ? h('span', {}, h('b', { class: 'ok' }, `✓ ${r.aciertos}`), '  ', h('b', { class: 'ko' }, `✗ ${r.fallos}`))
             : h('span', {}, `Respondidas ${r.aciertos + r.fallos}`)));

  const opciones = it.orden.map((k, pos) => {
    const elegida = it.resp === k, esCor = k === it.p.correcta, esBloq = bloq.includes(k);
    let cls = 'opcion';
    if (resuelta) { if (esCor) cls += ' correcta'; else if (elegida) cls += ' incorrecta'; }
    else if (elegida) cls += ' elegida';
    if (esBloq) cls += ' bloqueada';
    const marca = resuelta ? (esCor ? '✓' : elegida ? '✗' : '') : (esBloq ? '✗' : '');
    return h('label', { class: cls },
      h('input', { type: 'checkbox', checked: elegida, disabled: resuelta || esBloq, 'aria-label': `Opción ${LET[pos]}`, onchange: () => cb.onAnswer(k) }),
      h('span', { class: 'letra' }, LET[pos]), h('span', { class: 'texto' }, it.p.opciones[k]), h('span', { class: 'marca', 'aria-hidden': 'true' }, marca));
  });

  const ok = s.acierta(it), posCor = it.orden.indexOf(it.p.correcta);
  $('#test-cuerpo').replaceChildren(
    h('div', { class: 'enunciado' }, h('p', {}, it.p.texto)),
    h('div', { class: 'opciones', role: 'group', 'aria-label': 'Opciones de respuesta' }, opciones),
    h('div', { class: `solucion${ok ? '' : ' fallo'}`, hidden: !resuelta, 'aria-live': 'polite' }, resuelta ? [
      h('p', {}, h('b', {}, ok ? '¡Correcto!' : `Incorrecta. La respuesta correcta es la ${LET[posCor]}:`), ok ? '' : ` ${it.p.opciones[it.p.correcta]}`),
      it.p.explicacion ? h('p', {}, it.p.explicacion) : null] : []));

  const ultima = s.idx === total - 1;
  $('#test-pie').replaceChildren(h('div', { class: 'pie-acciones' },
    !repaso && s.idx > 0 ? h('button', { class: 'btn btn-sec', onclick: cb.onPrev }, 'Anterior') : null,
    repaso ? h('button', { class: 'btn btn-primario', disabled: !resuelta, onclick: cb.onNext }, ultima ? 'Ver resultado' : 'Siguiente')
           : h('button', { class: 'btn btn-primario', onclick: ultima ? cb.onFinish : cb.onNext }, ultima ? 'Finalizar examen' : 'Siguiente'),
    !repaso && !ultima ? h('button', { class: 'btn btn-sec', onclick: cb.onFinish }, 'Finalizar') : null));
}

/* ---------- Resultados ---------- */
export function renderResultado(s, res, cb) {
  const f = s.falladas();
  const cifra = (v, t, c = '') => h('div', { class: 'cifra' }, h('b', { class: c }, v), h('span', {}, t));
  const examen = s.modoRonda === 'examen';
  const pen = { 0.25: '1/4', 0.3333: '1/3', 0.5: '1/2' }[s.penal];
  $('#resultado').replaceChildren(
    h('div', { class: 'tarjeta resumen' },
      h('h2', {}, s.ronda > 1 ? `Ronda ${s.ronda} completada` : 'Resultado'),
      h('p', { class: `nota ${res.nota >= 5 ? 'aprobado' : 'suspenso'}` }, res.nota.toFixed(2), h('small', {}, ' / 10')),
      h('div', { class: 'cifras' }, cifra(res.aciertos, 'Aciertos', 'ok'), cifra(res.fallos, 'Fallos', 'ko'),
        res.blancos ? cifra(res.blancos, 'En blanco') : null, cifra(fmtTiempo(res.segundos), 'Tiempo')),
      examen && pen ? h('p', { class: 'ayuda', style: 'margin-top:12px' }, `Cada fallo resta ${pen} de acierto.`) : null),
    f.length ? h('details', { class: 'tarjeta revision' }, h('summary', {}, `Ver las ${f.length} no acertadas`),
      h('ol', {}, f.map(it => h('li', {}, h('p', {}, h('b', {}, it.p.texto)),
        h('p', { class: 'ko' }, `Tu respuesta: ${it.resp ? it.p.opciones[it.resp] : 'en blanco'}`),
        h('p', { class: 'ok' }, `Correcta: ${it.p.opciones[it.p.correcta]}`),
        it.p.explicacion ? h('p', { class: 'ayuda' }, it.p.explicacion) : null))))
      : h('p', { class: 'felicidades' }, '🎉 ¡Todas acertadas!'),
    h('div', { class: 'acciones-fin' },
      f.length ? h('button', { class: 'btn btn-primario', onclick: cb.onBucle }, `Repasar ${f.length} no acertada${f.length > 1 ? 's' : ''}`) : null,
      h('button', { class: 'btn btn-sec', onclick: cb.onRepetir }, 'Repetir el test'),
      h('button', { class: 'btn btn-sec', onclick: cb.onMenu }, 'Volver al menú')));
}

/* ---------- Mensajes de subida ---------- */
export function mensajesCrear(lista) {
  $('#crear-msg').replaceChildren(...lista.map(m => h('li', { class: m.ok ? 'ok' : 'error' }, m.texto,
    m.errores ? h('ul', {}, m.errores.slice(0, 8).map(e => h('li', { style: 'background:none;padding:0;margin:0' }, e)),
      m.errores.length > 8 ? h('li', { style: 'background:none;padding:0;margin:0' }, `…y ${m.errores.length - 8} errores más.`) : null) : null)));
}
