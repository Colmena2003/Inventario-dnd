// Alta, edición y baja de personajes desde el editor de la interfaz.

import { nuevoId } from './reglas';
import type { Estado, Personaje } from './tipos';

const COLORES = ['#c8a24a', '#5aa0d8', '#9cc95e', '#b874ff', '#e0883a', '#e0534d', '#4fc1b5', '#d88ac4'];

/** Un personaje nuevo de nivel 1 con todo a 10, listo para rellenar. */
export function personajeVacio(e: Estado): Personaje {
  const usados = new Set(e.personajes.map((p) => p.color));
  return {
    id: '', nombre: '', raza: 'Humano', clases: [{ clase: 'Guerrero', nivel: 1 }], px: 0,
    pvActual: 10, pvMax: 10, fue: 10, des: 10, con: 10, int: 10, sab: 10, car: 10,
    condiciones: [], resistencias: [], rasgos: [], monedas: { ppt: 0, po: 0, pe: 0, pp: 0, pc: 0 },
    saciedad: 7, color: COLORES.find((c) => !usados.has(c)) ?? COLORES[e.personajes.length % COLORES.length],
  };
}

export function validarPersonaje(e: Estado, p: Personaje): string | null {
  if (!p.nombre.trim()) return 'Ponle un nombre';
  if (e.personajes.some((x) => x.id !== p.id && x.nombre.trim().toLowerCase() === p.nombre.trim().toLowerCase())) return 'Ya hay un personaje con ese nombre';
  if (!p.clases.length || p.clases.some((c) => !c.clase.trim() || !(c.nivel >= 1))) return 'Cada clase necesita nombre y nivel (1 o más)';
  if (p.clases.reduce((s, c) => s + c.nivel, 0) > 20) return 'El nivel total no puede pasar de 20';
  for (const k of ['fue', 'des', 'con', 'int', 'sab', 'car'] as const) if (!(p[k] >= 1 && p[k] <= 30)) return 'Las características van de 1 a 30';
  if (!(p.pvMax >= 1)) return 'Los PV máximos tienen que ser 1 o más';
  return null;
}

/** Quita espacios y listas vacías para no guardar restos del formulario. */
function limpiar(p: Personaje): Personaje {
  const r: Personaje = {
    ...p,
    nombre: p.nombre.trim(), raza: p.raza.trim(), trasfondo: p.trasfondo?.trim() || undefined,
    clases: p.clases.map((c) => ({ clase: c.clase.trim(), nivel: c.nivel })),
    condiciones: p.condiciones.map((x) => x.trim()).filter(Boolean),
    resistencias: p.resistencias.map((x) => x.trim()).filter(Boolean),
    rasgos: (p.rasgos ?? []).filter((x) => x.nombre.trim()).map((x) => ({ ...x, nombre: x.nombre.trim() })),
    pvActual: Math.max(0, Math.min(p.pvActual, p.pvMax * 2)),
    editado: true,
  };
  if (r.competencias && !r.competencias.salvaciones?.length && !r.competencias.habilidades?.length && !r.competencias.pericia?.length) delete r.competencias;
  return r;
}

export function guardarPersonaje(e: Estado, p: Personaje, nuevo: boolean): Estado {
  const limpio = limpiar(p);
  if (nuevo) return { ...e, personajes: [...e.personajes, { ...limpio, id: nuevoId('pj') }] };
  return { ...e, personajes: e.personajes.map((x) => (x.id === p.id ? limpio : x)) };
}

/** Da de baja a un personaje: lo que llevaba pasa al alijo y sus monedas al tesoro común. */
export function eliminarPersonaje(e: Estado, id: string): Estado {
  const p = e.personajes.find((x) => x.id === id);
  if (!p) return e;
  const t = e.party.tesoro, m = p.monedas;
  return {
    ...e,
    party: { ...e.party, tesoro: { ppt: t.ppt + m.ppt, po: t.po + m.po, pe: t.pe + m.pe, pp: t.pp + m.pp, pc: t.pc + m.pc } },
    personajes: e.personajes.filter((x) => x.id !== id),
    objetos: e.objetos.map((o) => (o.propietario.tipo === 'personaje' && o.propietario.id === id
      ? { ...o, propietario: { tipo: 'alijo' as const }, equipadoEn: null, sintonizado: false }
      : o)),
  };
}
