// Biblioteca de objetos: una ficha por cada objeto que la party ha conocido, lo tenga alguien o no. Se
// guarda sola al crear o editar un objeto y sirve para recuperarlo (volver a dárselo a alguien) y para
// apuntar el botín del bestiario.

import { crearObjeto, validarObjeto } from './objetos';
import { nombreDe, nuevoId } from './reglas';
import { CAMPOS_FICHA, type DatosFicha, type Estado, type FichaObjeto, type Objeto, type Propietario } from './tipos';

/** La parte del objeto que describe qué es (sin dueño, cantidad ni estado). */
export function datosFicha(o: Partial<Objeto>): DatosFicha {
  const r: Record<string, unknown> = {};
  for (const k of CAMPOS_FICHA) if (o[k] !== undefined) r[k] = structuredClone(o[k]);
  return r as unknown as DatosFicha;
}

const iguales = (a: Partial<Objeto>, b: Partial<Objeto>) => JSON.stringify(datosFicha(a)) === JSON.stringify(datosFicha(b));
const clave = (s: string) => s.trim().toLocaleLowerCase('es');

/** Ficha de un objeto: la suya, o una con el mismo nombre y rareza. */
export function fichaDe(e: Estado, o: Objeto): FichaObjeto | undefined {
  const lista = e.biblioteca ?? [];
  return (o.fichaId ? lista.find((f) => f.id === o.fichaId) : undefined) ?? lista.find((f) => clave(f.nombre) === clave(o.nombre) && f.rareza === o.rareza);
}

export const objetosDeFicha = (e: Estado, fichaId: string) => e.objetos.filter((o) => o.fichaId === fichaId);

/**
 * Guarda en la biblioteca lo que es ahora un objeto recién creado o editado: crea su ficha o la pone al
 * día, y apunta en el objeto de qué ficha sale. Devuelve el mismo estado si no cambia nada.
 */
export function registrarEnBiblioteca(e: Estado, objetoId: string, ahora = Date.now()): Estado {
  const o = e.objetos.find((x) => x.id === objetoId);
  if (!o) return e;
  const lista = e.biblioteca ?? [];
  const f = fichaDe(e, o);
  const dueno = nombreDe(e, o.propietario);
  let biblioteca = lista;
  let id = f?.id;
  if (!f) {
    id = nuevoId('f');
    biblioteca = [...lista, { ...datosFicha(o), id, creada: ahora, actualizada: ahora, creadaPor: o.creadoPor, ultimoDueno: dueno }];
  } else {
    // Un objeto de otra ficha con el mismo nombre solo completa lo que a la ficha le falte
    const datos = o.fichaId === f.id ? datosFicha(o) : { ...datosFicha(f), ...datosFicha(o) };
    const cambia = !iguales(f, datos);
    if (cambia || f.ultimoDueno !== dueno) {
      biblioteca = lista.map((x) => (x.id === f.id
        ? { id: x.id, creada: x.creada, creadaPor: x.creadaPor, ...datos, actualizada: cambia ? ahora : x.actualizada, ultimoDueno: dueno }
        : x));
    }
  }
  const objetos = o.fichaId === id ? e.objetos : e.objetos.map((x) => (x.id === objetoId ? { ...x, fichaId: id } : x));
  return biblioteca === lista && objetos === e.objetos ? e : { ...e, biblioteca, objetos };
}

/**
 * Mantiene la biblioteca al día después de cualquier cambio: da ficha a los objetos que no la tienen
 * (objetos antiguos o importados) y apunta quién tiene ahora cada objeto conocido.
 */
export function sincronizarBiblioteca(e: Estado, ahora = Date.now()): Estado {
  let r = e;
  for (const o of e.objetos) {
    if (!o.fichaId || !(r.biblioteca ?? []).some((f) => f.id === o.fichaId)) r = registrarEnBiblioteca(r, o.id, ahora);
  }
  const lista = r.biblioteca ?? [];
  let cambia = false;
  const biblioteca = lista.map((f) => {
    const alguno = r.objetos.find((o) => o.fichaId === f.id);
    const dueno = alguno ? nombreDe(r, alguno.propietario) : f.ultimoDueno;
    if (dueno === f.ultimoDueno) return f;
    cambia = true;
    return { ...f, ultimoDueno: dueno };
  });
  return cambia ? { ...r, biblioteca } : r;
}

export type ResultadoFicha = { ok: true; estado: Estado } | { ok: false; motivo: string };

/** Vuelve a dar un objeto de la biblioteca a alguien (con las cargas llenas). */
export function recuperarFicha(e: Estado, fichaId: string, propietario: Propietario, cantidad: number, actor: string): ResultadoFicha {
  const f = (e.biblioteca ?? []).find((x) => x.id === fichaId);
  if (!f) return { ok: false, motivo: 'Esa ficha ya no está en la biblioteca' };
  if (!Number.isInteger(cantidad) || cantidad < 1) return { ok: false, motivo: 'La cantidad tiene que ser un número entero mayor que 0' };
  const datos: Objeto = {
    ...(datosFicha(f) as Objeto), id: '', cantidad, propietario, equipadoEn: null, cargas: f.cargasMax, fichaId,
  };
  const motivo = validarObjeto(e, datos);
  if (motivo) return { ok: false, motivo };
  const r = crearObjeto(e, datos, actor);
  return { ok: true, estado: registrarEnBiblioteca(r, r.objetos[r.objetos.length - 1].id) };
}

/** Quita una ficha. No se puede mientras alguien tenga ese objeto. */
export function olvidarFicha(e: Estado, fichaId: string): ResultadoFicha {
  if (objetosDeFicha(e, fichaId).length) return { ok: false, motivo: 'Alguien de la party todavía lo tiene' };
  return { ok: true, estado: { ...e, biblioteca: (e.biblioteca ?? []).filter((f) => f.id !== fichaId) } };
}

/** Cambia la imagen de una ficha y de todos los objetos que salen de ella. */
export function cambiarImagenFicha(e: Estado, fichaId: string, imagenUrl: string | undefined, ahora = Date.now()): Estado {
  return {
    ...e,
    biblioteca: (e.biblioteca ?? []).map((f) => (f.id === fichaId ? { ...f, imagenUrl, actualizada: ahora } : f)),
    objetos: e.objetos.map((o) => (o.fichaId === fichaId ? { ...o, imagenUrl } : o)),
  };
}
