// El estado de la party repartido en documentos de la base de datos compartida del artefacto.
// Un documento por personaje, objeto, ficha de la biblioteca y criatura, para que dos personas que
// cambian cosas distintas a la vez no se pisen; las imágenes van en documentos propios (cada
// documento admite como mucho 256 KiB) y el resto de la party en tres documentos pequeños.

import type { Estado } from '../domain/tipos';
import { huella, PREFIJO } from './imagenes';

/** Ruta del documento → cuerpo en JSON. */
export type Documentos = Map<string, string>;

export const DOC_PARTY = 'party/estado';
export const DOC_MOVIMIENTOS = 'party/movimientos';
export const DOC_REGISTRO = 'party/registro';
/** Marca de que la party ya subió sus datos (la escribe quien los sube, al final). */
export const DOC_META = 'party/meta';

export const LISTAS = ['personajes', 'objetos', 'biblioteca', 'bestiario'] as const;
export const COLECCIONES = [...LISTAS, 'imagenes'] as const;
type Lista = (typeof LISTAS)[number];

/** Tamaño máximo de un documento, con margen sobre los 256 KiB del almacén. */
export const MAX_DOCUMENTO = 250 * 1024;

/**
 * El almacén devuelve las colecciones ordenadas por id, no por llegada. Cada elemento guarda su
 * `_orden`, que no cambia en toda su vida: así añadir o borrar uno no reescribe los demás.
 */
export type Ordenes = Map<string, number>;

const claveOrden = (lista: Lista, id: string) => `${lista}/${id}`;

/**
 * Memoria de conversiones: el estado nunca se modifica en sitio (cada cambio crea objetos nuevos), así
 * que lo que no ha cambiado conserva la referencia y su JSON se reutiliza. Sin ella, cada cambio volvía
 * a serializar y a calcular la huella de todas las imágenes (decenas de milisegundos con muchas).
 */
export type Memoria = {
  json: WeakMap<object, string>;
  imagenes: Map<string, { ref: string; json: string }>;
  /** Cuerpo leído del almacén → elemento reconstruido (el almacén conserva el objeto si no cambia). */
  leidos: WeakMap<object, { url: string | undefined; x: Record<string, unknown> }>;
};
export const memoriaNueva = (): Memoria => ({ json: new WeakMap(), imagenes: new Map(), leidos: new WeakMap() });

export function aDocumentos(e: Estado, ordenes: Ordenes, memoria: Memoria = memoriaNueva()): Documentos {
  const docs: Documentos = new Map();
  const json = (x: object, f: () => unknown) => {
    let j = memoria.json.get(x);
    if (j === undefined) memoria.json.set(x, (j = JSON.stringify(f())));
    return j;
  };
  docs.set(DOC_PARTY, json(e.party, () => ({ party: e.party })));
  docs.set(DOC_MOVIMIENTOS, json(e.movimientos, () => ({ lista: e.movimientos })));
  docs.set(DOC_REGISTRO, JSON.stringify({ lista: e.registroMonedas ?? [] }));
  let siguiente = Math.max(-1, ...ordenes.values()) + 1;
  for (const lista of LISTAS) {
    for (const x of (e[lista] ?? []) as { id: string; imagenUrl?: string }[]) {
      const k = claveOrden(lista, x.id);
      if (!ordenes.has(k)) ordenes.set(k, siguiente++);
      const url = x.imagenUrl;
      let ref: string | undefined;
      if (url?.startsWith('data:')) {
        let img = memoria.imagenes.get(url);
        if (!img) memoria.imagenes.set(url, (img = { ref: huella(url), json: JSON.stringify({ url }) }));
        ref = img.ref;
        docs.set(`imagenes/${ref}`, img.json);
      }
      docs.set(`${lista}/${x.id}`, json(x, () => ({ ...x, ...(ref ? { imagenUrl: PREFIJO + ref } : {}), _orden: ordenes.get(k) })));
    }
  }
  return docs;
}

/** Cuerpos leídos del almacén (ruta → objeto). Sin `party/estado` no hay partida compartida. */
export function deDocumentos(cuerpos: Map<string, Record<string, unknown>>, ordenes: Ordenes, memoria: Memoria = memoriaNueva()): Estado | null {
  const party = cuerpos.get(DOC_PARTY)?.party as Estado['party'] | undefined;
  if (!party) return null;
  const imagenes = new Map<string, string>();
  const listas = Object.fromEntries(LISTAS.map((l) => [l, [] as Record<string, unknown>[]])) as Record<Lista, Record<string, unknown>[]>;
  for (const [ruta, cuerpo] of cuerpos) {
    const [col, id] = ruta.split('/');
    if (col === 'imagenes') {
      if (typeof cuerpo.url === 'string') imagenes.set(id, cuerpo.url);
    } else if ((LISTAS as readonly string[]).includes(col)) {
      listas[col as Lista].push(cuerpo);
    }
  }
  const orden = (x: Record<string, unknown>) => (typeof x._orden === 'number' ? x._orden : Number.MAX_SAFE_INTEGER);
  const reconstruir = (l: Lista) => listas[l]
    .sort((a, b) => orden(a) - orden(b) || String(a.id).localeCompare(String(b.id)))
    .map((cuerpo) => {
      if (typeof cuerpo._orden === 'number') ordenes.set(claveOrden(l, String(cuerpo.id)), cuerpo._orden);
      const img = typeof cuerpo.imagenUrl === 'string' && cuerpo.imagenUrl.startsWith(PREFIJO) ? cuerpo.imagenUrl.slice(PREFIJO.length) : null;
      const url = img ? imagenes.get(img) : (cuerpo.imagenUrl as string | undefined);
      // Lo que no ha cambiado conserva el mismo objeto: la app no lo redibuja ni se vuelve a serializar
      const previo = memoria.leidos.get(cuerpo);
      if (previo && previo.url === url) return previo.x;
      const { _orden: _o, ...x } = cuerpo;
      if (img) {
        if (url) x.imagenUrl = url;
        else delete x.imagenUrl; // la imagen aún no ha llegado
      }
      memoria.leidos.set(cuerpo, { url, x });
      return x;
    });
  return {
    party,
    movimientos: (cuerpos.get(DOC_MOVIMIENTOS)?.lista as Estado['movimientos']) ?? [],
    registroMonedas: (cuerpos.get(DOC_REGISTRO)?.lista as Estado['registroMonedas']) ?? [],
    personajes: reconstruir('personajes') as unknown as Estado['personajes'],
    objetos: reconstruir('objetos') as unknown as Estado['objetos'],
    biblioteca: reconstruir('biblioteca') as unknown as Estado['biblioteca'],
    bestiario: reconstruir('bestiario') as unknown as Estado['bestiario'],
  };
}

/** Lo que hay que escribir y borrar para pasar de `antes` a `despues`. Solo lo que ha cambiado. */
export function diferencias(antes: Documentos, despues: Documentos) {
  const escribir: [string, string][] = [];
  const borrar: string[] = [];
  for (const [ruta, json] of despues) if (antes.get(ruta) !== json) escribir.push([ruta, json]);
  for (const ruta of antes.keys()) if (!despues.has(ruta)) borrar.push(ruta);
  // Primero las imágenes, para que nadie vea un objeto que apunta a una imagen que aún no está
  escribir.sort(([a], [b]) => Number(b.startsWith('imagenes/')) - Number(a.startsWith('imagenes/')));
  return { escribir, borrar };
}

/** Documentos que no caben en el almacén (normalmente imágenes antiguas guardadas más grandes). */
export const demasiadoGrandes = (docs: Documentos) => [...docs].filter(([, json]) => json.length > MAX_DOCUMENTO).map(([r]) => r);
