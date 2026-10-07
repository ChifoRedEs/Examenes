// contacto.js — Enlace de WhatsApp. El número no se muestra en pantalla: se monta aquí.
const NUMERO = ['34', '637', '018', '162'].join(''); // prefijo del país + número, sin + ni espacios
const MENSAJE = "Hola 👋 Estoy usando «Exámenes y Test». Te paso un test en PDF que quiero incluir en la app para practicarlo ahí. ¿Me ayudas a convertirlo? ¡Gracias!";

export const urlWhatsApp = () => `https://wa.me/${NUMERO}?text=${encodeURIComponent(MENSAJE)}`;

export function iniciarContacto() {
  const enlace = document.querySelector('#wa-link');
  if (enlace) enlace.href = urlWhatsApp();
}
