// Despensa y hambre [casera] (HANDOFF §6). Funciones puras sobre el estado.

import { estadoSaciedad, objetosDe } from './reglas';
import type { Estado, Objeto, Personaje, Rareza } from './tipos';
import type { ClaveIcono } from '../ui/iconos';

/** La saciedad baja 25 puntos por cada día de viaje. */
export const SACIEDAD_POR_DIA = 25;

export type TipoComida = 'ración' | 'plato' | 'ingrediente';

export const tipoComida = (o: Objeto): TipoComida =>
  o.subtipo === 'plato' || o.subtipo === 'ingrediente' ? o.subtipo : 'ración';

/** La comida igual (mismo nombre, rareza, icono y saciedad) se muestra como una sola entrada. */
export const claveComida = (o: Objeto) => [o.nombre, o.rareza, o.icono, o.saciedad ?? 0].join('|');

export interface Comida {
  clave: string;
  nombre: string;
  icono: ClaveIcono;
  rareza: Rareza;
  tipo: TipoComida;
  saciedad: number;
  pesoKg: number;
  cantidad: number;
  nota?: string;
  /** Pilas que la forman, de cualquier dueño (personajes y alijo). */
  pilas: Objeto[];
}

/** Toda la comida de la party, la lleve quien la lleve, agrupada por tipo. */
export function despensa(e: Estado): Comida[] {
  const grupos = new Map<string, Comida>();
  for (const o of e.objetos) {
    if (o.categoria !== 'Comida') continue;
    const k = claveComida(o);
    const g = grupos.get(k);
    if (g) {
      g.cantidad += o.cantidad;
      g.pilas.push(o);
    } else {
      grupos.set(k, {
        clave: k, nombre: o.nombre, icono: o.icono, rareza: o.rareza, tipo: tipoComida(o), saciedad: o.saciedad ?? 0,
        pesoKg: o.pesoKg, cantidad: o.cantidad, nota: o.efectos ?? o.descripcion, pilas: [o],
      });
    }
  }
  return [...grupos.values()];
}

/** Días que la party puede comer con lo que lleva: puntos de saciedad entre lo que pierde al día. */
export function diasDeComida(e: Estado): number {
  if (e.personajes.length === 0) return 0;
  const puntos = despensa(e).reduce((s, c) => s + c.saciedad * c.cantidad, 0);
  return Math.floor(puntos / (SACIEDAD_POR_DIA * e.personajes.length));
}

export type ResultadoComer =
  | { ok: true; estado: Estado; texto: string }
  | { ok: false; motivo: string };

/**
 * Un personaje come 1 unidad de una comida: suma su saciedad, con tope de 100.
 * La unidad sale de lo que lleva él, después del alijo y por último de otro personaje.
 */
export function comer(e: Estado, personajeId: string, clave: string): ResultadoComer {
  const p = e.personajes.find((x) => x.id === personajeId);
  if (!p) return { ok: false, motivo: 'El personaje ya no existe' };
  const c = despensa(e).find((x) => x.clave === clave);
  if (!c) return { ok: false, motivo: 'Esa comida ya no está en la despensa' };
  if (c.saciedad <= 0) return { ok: false, motivo: `${c.nombre} no se come solo` };
  if (p.saciedad >= 100) return { ok: false, motivo: `${p.nombre} ya está saciado del todo` };

  const propias = new Set(objetosDe(e, { tipo: 'personaje', id: p.id }).map((o) => o.id));
  const prioridad = (o: Objeto) => (propias.has(o.id) ? 0 : o.propietario.tipo === 'alijo' ? 1 : 2);
  const pila = [...c.pilas].sort((a, b) => prioridad(a) - prioridad(b))[0];

  const objetos = pila.cantidad > 1
    ? e.objetos.map((o) => (o.id === pila.id ? { ...o, cantidad: o.cantidad - 1 } : o))
    : e.objetos.filter((o) => o.id !== pila.id);
  const saciedad = Math.min(100, p.saciedad + c.saciedad);
  const personajes = e.personajes.map((x) => (x.id === p.id ? { ...x, saciedad } : x));
  return {
    ok: true,
    estado: { ...e, objetos, personajes },
    texto: `${p.nombre} come ${c.nombre}: ${estadoSaciedad(saciedad).texto.toLowerCase()} (${saciedad})`,
  };
}

/** Un día de viaje: todos pierden 25 de saciedad, sin bajar de 0. */
export function pasarDia(e: Estado): Estado {
  return {
    ...e,
    personajes: e.personajes.map((p: Personaje) => ({ ...p, saciedad: Math.max(0, p.saciedad - SACIEDAD_POR_DIA) })),
  };
}
