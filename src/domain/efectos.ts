// Qué objetos están haciendo efecto y cómo se acumulan sus modificadores. Lo usan las reglas de carga
// (reglas.ts) y la hoja derivada (hoja.ts).

import type { Caracteristica, Estado, Modificador, Objeto, ObjetivoMod, Personaje } from './tipos';

/**
 * [5e] Un objeto mágico hace efecto si está sintonizado (cuando lo requiere) y equipado (cuando tiene
 * ranura). Los que no tienen ranura solo funcionan si se marcan «funciona sin equipar» o se sintonizan.
 */
export function objetoActivo(o: Objeto): boolean {
  if (o.propietario.tipo !== 'personaje') return false;
  if (o.requiereSintonizacion && !o.sintonizado) return false;
  if (o.funcionaSinEquipar) return true;
  if (o.ranuraEquipo) return !!o.equipadoEn;
  return !!o.requiereSintonizacion;
}

export const activosDe = (e: Estado, pjId: string) =>
  e.objetos.filter((o) => o.propietario.tipo === 'personaje' && o.propietario.id === pjId && objetoActivo(o));

export type ModActivo = Modificador & { origen: string; objetoId: string };

export const modsDe = (activos: Objeto[]): ModActivo[] =>
  activos.flatMap((o) => (o.modificadores ?? []).map((m) => ({ ...m, origen: o.nombre, objetoId: o.id })));

export type Fuente = { origen: string; valor: number; fijado?: boolean };

/** Un número de la hoja con su desglose: base, cada aporte, y si va con ventaja o desventaja. */
export interface Valor {
  base: number;
  total: number;
  fuentes: Fuente[];
  vent?: string[];
  desv?: string[];
}

export const valor = (base: number, origen: string): Valor => ({ base, total: base, fuentes: base ? [{ origen, valor: base }] : [] });

export function sumar(v: Valor, origen: string, n: number): Valor {
  if (!n) return v;
  return { ...v, total: v.total + n, fuentes: [...v.fuentes, { origen, valor: n }] };
}

/** Suma los modificadores «+X» de esos objetivos y después aplica el mayor «fija a X». */
export function aplicar(v: Valor, mods: ModActivo[], objetivos: ObjetivoMod[]): Valor {
  let r = v;
  const de = mods.filter((m) => objetivos.includes(m.objetivo) && typeof m.valor === 'number');
  for (const m of de.filter((x) => !x.fijar)) r = sumar(r, m.origen, m.valor!);
  const fijo = de.filter((x) => x.fijar).sort((a, b) => b.valor! - a.valor!)[0];
  if (fijo && fijo.valor! > r.total) {
    r = { ...r, total: fijo.valor!, fuentes: [...r.fuentes, { origen: fijo.origen, valor: fijo.valor!, fijado: true }] };
  }
  return r;
}

export function marcar(v: Valor, tipo: 'vent' | 'desv', motivo: string): Valor {
  return { ...v, [tipo]: [...(v[tipo] ?? []), motivo] };
}

/** [5e] Puntuación de característica con objetos, con un tope de 30. */
export function caracteristica(p: Personaje, mods: ModActivo[], k: Caracteristica): Valor {
  const v = aplicar(valor(p[k], 'Base'), mods, [`car:${k}`]);
  return v.total > 30 ? { ...v, total: 30 } : v;
}
