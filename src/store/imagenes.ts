// Las imágenes (data URL) pesan mucho y se repiten: la del objeto y la de su ficha en la biblioteca.
// Al guardar se sustituyen por una referencia a una tabla común, y al leer se restituyen.

import type { Estado } from '../domain/tipos';

export const PREFIJO = 'img:';
type Guardado = Estado & { imagenes?: Record<string, string> };

/** Dos hashes de 32 bits sobre toda la cadena: la clave la comparten todos los navegadores de la party. */
export function huella(s: string) {
  let a = 0x811c9dc5, b = 5381;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = (Math.imul(b, 33) ^ c) >>> 0;
  }
  return `${s.length.toString(36)}${a.toString(36)}${b.toString(36)}`;
}

export function aGuardar(e: Estado): Guardado {
  const imagenes: Record<string, string> = {};
  const ref = <T extends { imagenUrl?: string }>(x: T): T => {
    const url = x.imagenUrl;
    if (!url || !url.startsWith('data:')) return x;
    let k = huella(url);
    while (imagenes[k] !== undefined && imagenes[k] !== url) k += '_';
    imagenes[k] = url;
    return { ...x, imagenUrl: PREFIJO + k };
  };
  return {
    ...e,
    personajes: e.personajes.map(ref),
    objetos: e.objetos.map(ref),
    biblioteca: e.biblioteca?.map(ref),
    bestiario: e.bestiario?.map(ref),
    imagenes,
  };
}

export function deGuardado(g: Guardado): Estado {
  const { imagenes, ...e } = g;
  if (!imagenes) return e;
  // La misma cadena para el objeto y su ficha: en memoria tampoco se duplica
  const url = <T extends { imagenUrl?: string }>(x: T): T =>
    x.imagenUrl?.startsWith(PREFIJO) ? { ...x, imagenUrl: imagenes[x.imagenUrl.slice(PREFIJO.length)] } : x;
  return {
    ...e, personajes: e.personajes.map(url), objetos: e.objetos.map(url), biblioteca: e.biblioteca?.map(url), bestiario: e.bestiario?.map(url),
  };
}
