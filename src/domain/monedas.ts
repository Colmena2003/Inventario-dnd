// Monedas (HANDOFF §6): valores [5e], reparto de botín, cambio y movimientos de monedas.

import { cargaMaxDe, fmtKg, HISTORIAL_MAX, nuevoId, pesoPersonajeKg } from './reglas';
import type { Estado, Monedas } from './tipos';

export type ClaveMoneda = keyof Monedas;
export const CLAVES: ClaveMoneda[] = ['ppt', 'po', 'pe', 'pp', 'pc'];

/** [5e] Valor de cada moneda en piezas de cobre. */
export const VALOR_PC: Record<ClaveMoneda, number> = { ppt: 1000, po: 100, pe: 50, pp: 10, pc: 1 };

export const NOMBRE_MONEDA: Record<ClaveMoneda, string> = { ppt: 'Platino', po: 'Oro', pe: 'Electro', pp: 'Plata', pc: 'Cobre' };

export const CERO: Monedas = { ppt: 0, po: 0, pe: 0, pp: 0, pc: 0 };

export const sumar = (a: Monedas, b: Monedas): Monedas =>
  ({ ppt: a.ppt + b.ppt, po: a.po + b.po, pe: a.pe + b.pe, pp: a.pp + b.pp, pc: a.pc + b.pc });
export const escalar = (a: Monedas, k: number): Monedas =>
  ({ ppt: a.ppt * k, po: a.po * k, pe: a.pe * k, pp: a.pp * k, pc: a.pc * k });
export const valorPc = (m: Monedas) => CLAVES.reduce((s, k) => s + m[k] * VALOR_PC[k], 0);
export const cuantas = (m: Monedas) => CLAVES.reduce((s, k) => s + m[k], 0);
export const vacia = (m: Monedas) => cuantas(m) === 0;

/** Expresa un valor en cobre con las monedas más altas (sin electro, que casi no se usa). */
export function aMonedaAlta(pc: number): Monedas {
  const r = { ...CERO };
  let resto = Math.max(0, Math.floor(pc));
  for (const k of ['ppt', 'po', 'pp', 'pc'] as const) {
    r[k] = Math.floor(resto / VALOR_PC[k]);
    resto -= r[k] * VALOR_PC[k];
  }
  return r;
}

export function texto(m: Monedas) {
  const partes = CLAVES.filter((k) => m[k]).map((k) => `${m[k]} ${k.toUpperCase()}`);
  return partes.length ? partes.join(' · ') : 'nada';
}

/**
 * Reparte a partes iguales, moneda a moneda, entre `n` personas; lo que sobra de cada tipo va al tesoro.
 * Con `convertir`, junta todo el valor y lo da en las monedas más altas posibles.
 */
export function repartir(botin: Monedas, n: number, convertir = false): { cada: Monedas; resto: Monedas } {
  if (n < 1) return { cada: { ...CERO }, resto: { ...botin } };
  if (convertir) {
    const total = valorPc(botin);
    const cada = Math.floor(total / n);
    return { cada: aMonedaAlta(cada), resto: aMonedaAlta(total - cada * n) };
  }
  const cada = { ...CERO }, resto = { ...CERO };
  for (const k of CLAVES) {
    cada[k] = Math.floor(botin[k] / n);
    resto[k] = botin[k] - cada[k] * n;
  }
  return { cada, resto };
}

/** Cambio exacto entre monedas: devuelve cuántas se reciben, o null si no sale exacto. */
export function cambio(cantidad: number, de: ClaveMoneda, a: ClaveMoneda): number | null {
  const pc = cantidad * VALOR_PC[de];
  return cantidad > 0 && de !== a && pc % VALOR_PC[a] === 0 ? pc / VALOR_PC[a] : null;
}

// ── Movimientos de monedas ─────────────────────────────────────────

export type Bolsa = 'tesoro' | { personajeId: string };
export type Cambio = { bolsa: Bolsa; delta: Monedas };

interface RegistroMonedas {
  id: string;
  fecha: number;
  actor: string;
  texto: string;
}

const nombreBolsa = (e: Estado, b: Bolsa) =>
  b === 'tesoro' ? 'el tesoro común' : e.personajes.find((p) => p.id === b.personajeId)?.nombre ?? '¿?';

export type ResultadoMonedas = { ok: true; estado: Estado } | { ok: false; motivo: string };

/**
 * Aplica varios cambios a la vez. Falla si alguna bolsa se queda en negativo o si un personaje
 * superaría su carga máxima por el peso de las monedas.
 */
export function aplicarMonedas(e: Estado, cambios: Cambio[], actor: string, descripcion: string): ResultadoMonedas {
  let tesoro = e.party.tesoro;
  const personajes = e.personajes.map((p) => ({ ...p }));
  for (const c of cambios) {
    if (c.bolsa === 'tesoro') tesoro = sumar(tesoro, c.delta);
    else {
      const id = c.bolsa.personajeId;
      const p = personajes.find((x) => x.id === id);
      if (!p) return { ok: false, motivo: 'El personaje ya no existe' };
      p.monedas = sumar(p.monedas, c.delta);
    }
  }
  if (CLAVES.some((k) => tesoro[k] < 0)) return { ok: false, motivo: 'No hay tantas monedas en el tesoro común' };
  const siguiente: Estado = { ...e, party: { ...e.party, tesoro }, personajes };
  for (const p of personajes) {
    if (CLAVES.some((k) => p.monedas[k] < 0)) return { ok: false, motivo: `${p.nombre} no tiene tantas monedas` };
    const antes = e.personajes.find((x) => x.id === p.id)!;
    const peso = pesoPersonajeKg(siguiente, p);
    const max = cargaMaxDe(siguiente, p);
    if (peso > max && peso > pesoPersonajeKg(e, antes)) {
      return { ok: false, motivo: `Sobrepeso: ${p.nombre} llegaría a ${fmtKg(peso)} kg y su máximo es ${max} kg` };
    }
  }
  const registro: RegistroMonedas = { id: nuevoId('rm'), fecha: Date.now(), actor, texto: descripcion };
  return { ok: true, estado: { ...siguiente, registroMonedas: [registro, ...(e.registroMonedas ?? [])].slice(0, HISTORIAL_MAX) } };
}

export { nombreBolsa };
