// portada.js — Frase motivadora de la portada (una por día; el botón muestra otra).
const FRASES = [
  'Cada pregunta que repasas hoy es una plaza más cerca.',
  'La constancia pesa más que el talento el día del examen.',
  'No necesitas hacerlo perfecto. Necesitas hacerlo hoy.',
  'Un tema más estudiado es un miedo menos.',
  'Equivocarte en el repaso sale más barato que equivocarte en el examen.',
  'Poco a poco, todos los días: así se llega lejos.',
  'Tu yo del examen te dará las gracias por lo que hagas hoy.',
  'Descansar también forma parte de estudiar.',
  'Los errores de hoy son los aciertos de mañana.',
  'Empieza con diez preguntas. Lo difícil es sentarse, no continuar.',
  'La disciplina te lleva donde la motivación no llega.',
  'Respira, repasa, repite.'
];

export function iniciarPortada() {
  const ahora = new Date();
  const diaDelAnio = Math.floor((ahora - new Date(ahora.getFullYear(), 0, 0)) / 864e5);
  let i = diaDelAnio % FRASES.length;
  const texto = document.querySelector('#frase-texto');
  const pintar = () => { texto.textContent = FRASES[i]; };
  pintar();
  document.querySelector('#btn-frase').addEventListener('click', () => { i = (i + 1) % FRASES.length; pintar(); });
}
