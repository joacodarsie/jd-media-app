/**
 * Sonidos sutiles (18/10/2026): un «tic» al completar una tarea y dos notas al
 * aprobar una pieza. Se generan con el navegador (sin archivos) y se apagan
 * desde Mi perfil; la preferencia queda en este dispositivo.
 */
const CLAVE = "jd_sonidos";

export function sonidosActivos(): boolean {
  try {
    return localStorage.getItem(CLAVE) !== "off";
  } catch {
    return false;
  }
}

export function setSonidos(on: boolean) {
  try {
    localStorage.setItem(CLAVE, on ? "on" : "off");
  } catch {
    /* sin almacenamiento: quedan como estaban */
  }
}

let ctx: AudioContext | null = null;

function nota(frecuencia: number, empieza: number, dura: number, volumen = 0.06) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gan = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frecuencia;
  const t = ctx.currentTime + empieza;
  gan.gain.setValueAtTime(0, t);
  gan.gain.linearRampToValueAtTime(volumen, t + 0.012);
  gan.gain.exponentialRampToValueAtTime(0.0001, t + dura);
  osc.connect(gan).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dura + 0.02);
}

export function sonar(cual: "hecha" | "aprobada") {
  if (typeof window === "undefined" || !sonidosActivos()) return;
  try {
    ctx = ctx ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (cual === "hecha") {
      nota(1318, 0, 0.12, 0.05);
      nota(1760, 0.06, 0.18, 0.04);
    } else {
      nota(784, 0, 0.18);
      nota(1175, 0.11, 0.3);
    }
  } catch {
    /* sin audio: no pasa nada */
  }
}
