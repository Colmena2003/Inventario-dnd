// Enlace entre quien lanza una tirada y la mesa 3D que la anima: así un objeto puede esperar a que los
// dados se paren antes de aplicar su efecto (curar, gastar la poción). No importa three, que pesa.

/** Tiradas hechas en este navegador: estas se ven siempre en 3D, las de los demás según la preferencia. */
export const propias = new Set<string>();

const esperando = new Map<string, () => void>();

/**
 * Se resuelve cuando la mesa enseña el resultado de esa tirada (o no puede animarla). Si la mesa no
 * contesta en `maxMs`, se resuelve igual: el efecto no se queda colgado.
 */
export function esperarTirada(id: string, maxMs = 15000): Promise<void> {
  return new Promise((ok) => {
    const t = setTimeout(() => { esperando.delete(id); ok(); }, maxMs);
    esperando.set(id, () => { clearTimeout(t); esperando.delete(id); ok(); });
  });
}

/** La mesa avisa de que esa tirada ya se ha parado. */
export const tiradaParada = (id: string) => esperando.get(id)?.();
