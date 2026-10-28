// Biblioteca de objetos: cada objeto que pasa por la party deja una ficha con su descripción, habilidades
// e imagen. La ficha sobrevive aunque el objeto se pierda, se gaste o se borre, y desde ella se recupera.

import { nombreDe, nuevoId } from './reglas';
import { crearObjeto, type ResultadoObjeto } from './objetos';
import { CAMPOS_FICHA, type DatosFicha, type Estado, type Ficha, type Objeto, type Propietario } from './tipos';

const normal = (s: string) => s.trim().toLocaleLowerCase('es');

export function datosFicha(o: DatosFicha): DatosFicha {
  const d: Partial<Record<keyof DatosFicha, unknown>> = {};
  for (const k of CAMPOS_FICHA) if (o[k] !== undefined) d[k] = o[k];
  return d as DatosFicha;
}

const igual = (a: DatosFicha, b: DatosFicha) => JSON.stringify(datosFicha(a)) === JSON.stringify(datosFicha(b));

/** Ficha que corresponde a un objeto: la suya o, si no tiene, una con el mismo nombre y rareza. */
export function fichaDe(e: Estado, o: Objeto): Ficha | undefined {
  const lista = e.biblioteca ?? [];
  return (o.fichaId ? lista.find((f) => f.id === o.fichaId) : undefined)
    ?? lista.find((f) => normal(f.nombre) === normal(o.nombre) && f.rareza === o.rareza);
}

/**
 * Guarda en la biblioteca los datos actuales del objeto `id` (creando la ficha si hace falta)
 * y enlaza el objeto con ella.
 */
export function registrar(e: Estado, id: string, ahora = Date.now()): Estado {
  const o = e.objetos.find((x) => x.id === id);
  if (!o) return e;
  const lista = e.biblioteca ?? [];
  const previa = fichaDe(e, o);
  const dueno = nombreDe(e, o.propietario);
  let biblioteca = lista;
  let fichaId = previa?.id;
  if (!previa) {
    fichaId = nuevoId('f');
    biblioteca = [...lista, { ...datosFicha(o), id: fichaId, creada: ahora, actualizada: ahora, creadaPor: o.creadoPor, ultimoDueno: dueno }];
  } else {
    // Enlazado a la ficha, el objeto manda (borrar un campo lo borra); encontrado solo por el nombre,
    // lo que el objeto no dice se conserva de la ficha
    const datos = o.fichaId === previa.id ? datosFicha(o) : { ...datosFicha(previa), ...datosFicha(o) };
    const cambia = !igual(previa, datos);
    if (cambia || previa.ultimoDueno !== dueno) {
      biblioteca = lista.map((f) => (f.id === previa.id
        ? { id: f.id, creada: f.creada, creadaPor: f.creadaPor, ...datos, actualizada: cambia ? ahora : f.actualizada, ultimoDueno: dueno }
        : f));
    }
  }
  const objetos = o.fichaId === fichaId ? e.objetos : e.objetos.map((x) => (x.id === id ? { ...x, fichaId } : x));
  return biblioteca === lista && objetos === e.objetos ? e : { ...e, biblioteca, objetos };
}

/** Da ficha a todos los objetos que aún no la tienen (partidas guardadas antes de existir la biblioteca). */
export function completarBiblioteca(e: Estado, ahora = Date.now()): Estado {
  let r = e;
  for (const o of e.objetos) if (!o.fichaId || !(r.biblioteca ?? []).some((f) => f.id === o.fichaId)) r = registrar(r, o.id, ahora);
  return r;
}

/** Objetos que existen ahora mismo de una ficha. */
export const ejemplares = (e: Estado, fichaId: string) => e.objetos.filter((o) => o.fichaId === fichaId);

/** Crea de nuevo un objeto a partir de su ficha y se lo da a `propietario`. */
export function recuperar(e: Estado, fichaId: string, propietario: Propietario, cantidad: number, actor: string): ResultadoObjeto {
  const f = (e.biblioteca ?? []).find((x) => x.id === fichaId);
  if (!f) return { ok: false, motivo: 'Esa ficha ya no está en la biblioteca' };
  const r = crearObjeto(e, { ...datosFicha(f), fichaId, cantidad, propietario, cargas: f.cargasMax }, actor);
  if (!r.ok) return r;
  return { ok: true, estado: registrar(r.estado, r.id), id: r.id };
}

/** Solo se puede olvidar lo que ya no tiene nadie: si no, volvería a aparecer al guardar. */
export function olvidar(e: Estado, fichaId: string): { ok: true; estado: Estado } | { ok: false; motivo: string } {
  const n = ejemplares(e, fichaId).length;
  if (n) return { ok: false, motivo: 'Alguien de la party todavía lo tiene' };
  return { ok: true, estado: { ...e, biblioteca: (e.biblioteca ?? []).filter((f) => f.id !== fichaId) } };
}

/** Cambia la imagen de una ficha y de todos sus ejemplares. */
export function cambiarImagenFicha(e: Estado, fichaId: string, url: string | undefined, ahora = Date.now()): Estado {
  return {
    ...e,
    biblioteca: (e.biblioteca ?? []).map((f) => (f.id === fichaId ? { ...f, imagenUrl: url, actualizada: ahora } : f)),
    objetos: e.objetos.map((o) => (o.fichaId === fichaId ? { ...o, imagenUrl: url } : o)),
  };
}
