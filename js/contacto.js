// contacto.js — Enlace de WhatsApp. El número no se muestra en pantalla: se monta aquí.
const NUMERO = ['34', '637', '018', '162'].join(''); // prefijo del país + número, sin + ni espacios
const MENSAJE = "Hola, ¿puedes crear un nuevo Test para mí en la aplicación 'Exámenes y Test' con este PDF que adjunto? Gracias";

export const urlWhatsApp = () => `https://wa.me/${NUMERO}?text=${encodeURIComponent(MENSAJE)}`;

export function iniciarContacto() {
  const enlace = document.querySelector('#wa-link');
  if (enlace) enlace.href = urlWhatsApp();
}
