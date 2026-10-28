// Las imágenes (data URL) pesan mucho y se repiten: la del objeto y la de su ficha en la biblioteca.
// Al guardar se sustituyen por una referencia a una tabla común, y al leer se restituyen.

import type { Estado } from '../domain/tipos';

const PREFIJO = 'img:';
type Guardado = Estado & { imagenes?: Record<string, string> };

function huella(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i += 7) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return `${s.length.toString(36)}${h.toString(36)}`;
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
