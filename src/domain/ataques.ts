// Qué dados tira un arma equipada: el d20 de ataque con su bono y los dados de daño con sus modificadores
// y daños extra. Lo que sale de aquí se lanza en la mesa 3D (crearTirada en dados.ts).

import { doblar, MAX_DADOS, dadosEnMesa, parsearFormula, type Modo, type Seleccion } from './dados';
import type { AtaqueArma } from './hoja';

export interface PreparadaArma {
  seleccion: Seleccion;
  modificador: number;
  motivo: string;
  modo?: Modo;
  critMin?: number;
  danoCritico?: boolean;
}

/** Ventaja o desventaja que ya trae el ataque (hambre, sobrecarga…); si tiene las dos, se anulan [5e]. */
export function modoDe(a: AtaqueArma): Modo | undefined {
  const v = !!a.bono.vent?.length, d = !!a.bono.desv?.length;
  return v === d ? undefined : v ? 'ventaja' : 'desventaja';
}

/** 1d20 + bono; con ventaja o desventaja, 2d20 y cuenta uno. `modo` null fuerza una tirada normal. */
export function tiradaAtaque(a: AtaqueArma, modo?: Modo | null): PreparadaArma {
  const m = modo === undefined ? modoDe(a) : modo ?? undefined;
  return {
    seleccion: { d20: m ? 2 : 1 },
    modificador: a.bono.total,
    motivo: `${a.objeto.nombre} · ataque`,
    ...(m ? { modo: m } : {}),
    ...(a.critico < 20 ? { critMin: a.critico } : {}),
  };
}

/** Daños extra que se tiran siempre; los que tienen condición («contra no muertos») solo si se piden. */
export const extrasCondicionales = (a: AtaqueArma) => a.extras.filter((x) => x.condicion);

/**
 * Dados de daño del arma más los extra sin condición (y los condicionales que se pidan). En un crítico
 * se doblan los dados, no el modificador [5e]. Null si el arma no tiene dados (daño fijo).
 */
export function tiradaDano(a: AtaqueArma, opciones: { critico?: boolean; condicionales?: number[] } = {}): PreparadaArma | null {
  const base = parsearFormula(a.dado);
  if (!base) return null;
  let seleccion: Seleccion = { ...base.seleccion };
  const condicionales = extrasCondicionales(a);
  const extras = [...a.extras.filter((x) => !x.condicion), ...(opciones.condicionales ?? []).map((i) => condicionales[i]).filter(Boolean)];
  let modificador = base.modificador + a.danoMod.total;
  for (const x of extras) {
    const f = parsearFormula(x.dado);
    if (!f) continue;
    const junta: Seleccion = { ...seleccion };
    for (const [t, n] of Object.entries(f.seleccion) as [keyof Seleccion, number][]) junta[t] = (junta[t] ?? 0) + n;
    if (dadosEnMesa(junta) > MAX_DADOS) break;
    seleccion = junta;
    modificador += f.modificador;
  }
  if (opciones.critico) seleccion = doblar(seleccion);
  const tipo = a.tipo ? ` ${a.tipo}` : '';
  return {
    seleccion, modificador,
    motivo: `${a.objeto.nombre} · daño${tipo}${opciones.critico ? ' (crítico)' : ''}`,
    ...(opciones.critico ? { danoCritico: true } : {}),
  };
}
