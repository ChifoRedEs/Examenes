// testEngine.js — Lógica del test: barajado, rondas, resultados y bucle de falladas.

/** Fisher-Yates: devuelve una copia barajada. */
export const shuffle = a => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
};

export class Sesion {
  /** modo: 'repaso' | 'examen'. opciones: { minutos, penal } (solo examen). */
  constructor(test, modo, { minutos = 0, penal = 0 } = {}) {
    Object.assign(this, { test, modo, modoRonda: modo, minutos, penal, ronda: 1, bloqueos: {}, inicio: Date.now() });
    this.armar(test.preguntas);
  }

  /** Baraja preguntas y opciones. 'orden' guarda las claves originales en el orden mostrado. */
  armar(preguntas) {
    this.items = shuffle(preguntas).map(p => ({ p, orden: shuffle(Object.keys(p.opciones)), resp: null }));
    this.idx = 0;
  }

  actual() { return this.items[this.idx]; }
  acierta(it) { return it.resp === it.p.correcta; }

  /** Repaso: respuesta definitiva. Examen: se puede cambiar o desmarcar. */
  responder(k) {
    const it = this.actual();
    if (this.modoRonda === 'repaso') { if (it.resp === null) it.resp = k; }
    else it.resp = it.resp === k ? null : k;
  }
  siguiente() { if (this.idx < this.items.length - 1) { this.idx++; return true; } return false; }
  anterior() { if (this.idx > 0) this.idx--; }

  resultados() {
    let aciertos = 0, fallos = 0, blancos = 0;
    this.items.forEach(it => (it.resp === null ? blancos++ : this.acierta(it) ? aciertos++ : fallos++));
    const total = this.items.length;
    const pen = this.modoRonda === 'examen' ? this.penal : 0;
    const nota = Math.max(0, (aciertos - fallos * pen) / total * 10);
    return { total, aciertos, fallos, blancos, nota, segundos: this.segundos() };
  }

  /** Preguntas no acertadas (falladas o en blanco). */
  falladas() { return this.items.filter(it => !this.acierta(it)); }

  /** Nueva ronda solo con las falladas; la opción que se falló queda bloqueada. */
  iniciarBucle() {
    const f = this.falladas();
    f.forEach(it => { if (it.resp !== null) (this.bloqueos[it.p.id] ??= []).push(it.resp); });
    this.armar(f.map(it => it.p));
    this.modoRonda = 'repaso';
    this.ronda++;
    this.inicio = Date.now();
  }

  segundos() { return Math.round((Date.now() - this.inicio) / 1000); }
  /** Segundos restantes (solo examen con límite) o null. */
  restante() { return this.modoRonda === 'examen' && this.minutos > 0 ? this.minutos * 60 - this.segundos() : null; }
}
