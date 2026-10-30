// Tiradas de dados. El resultado sale del generador aleatorio del navegador, no de la física: la animación 3D
// (src/dados/mesa.ts) solo pinta cada dado con el número que ya ha salido. Así una tirada se puede enviar al
// resto de la party y cada pantalla la anima a su manera con los mismos números.

import type { Personaje } from './tipos';

export const TIPOS_DADO = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'] as const;
export type TipoDado = (typeof TIPOS_DADO)[number];

export const CARAS: Record<TipoDado, number> = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 };

/** Cuántos dados de cada tipo se van a tirar. */
export type Seleccion = Partial<Record<TipoDado, number>>;

/** Más dados no caben bien en la pantalla (el d100 son dos). */
export const MAX_DADOS = 20;
export const MAX_MODIFICADOR = 99;

export const ACABADOS = ['mate', 'pulido', 'metal', 'nacar'] as const;
export type Acabado = (typeof ACABADOS)[number];
export const NOMBRE_ACABADO: Record<Acabado, string> = { mate: 'Mate', pulido: 'Pulido', metal: 'Metal', nacar: 'Nácar' };

/** Cómo son los dados de un personaje: los ve igual toda la party. */
export interface EstiloDados {
  color: string;
  /** Color de los números. */
  tinta: string;
  acabado: Acabado;
}

/** Con ventaja cuenta el d20 más alto; con desventaja, el más bajo. */
export type Modo = 'ventaja' | 'desventaja';

export interface Tirada {
  id: string;
  fecha: number;
  /** Id del personaje que tira, o «dm». */
  quien: string;
  nombre: string;
  estilo: EstiloDados;
  dados: { tipo: TipoDado; valor: number }[];
  modificador: number;
  /** Solo la ve quien la tira (el DM tras la pantalla). */
  privada?: boolean;
  /** Para qué es: «Espada larga · ataque», «Poción de curación». */
  motivo?: string;
  modo?: Modo;
  /** Desde qué valor del d20 es crítico (19 con algunas armas). */
  critMin?: number;
  /** Daño de un crítico: los dados ya van doblados. */
  danoCritico?: boolean;
}

export const QUIEN_DM = 'dm';

const HEX = /^#[0-9a-f]{6}$/i;

/** Números claros sobre dados oscuros y oscuros sobre claros. */
export function tintaPara(color: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
  const luz = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luz > 0.55 ? '#1a1410' : '#f3e6c4';
}

export const ESTILO_DM: EstiloDados = { color: '#3a2f45', tinta: '#e2c27a', acabado: 'pulido' };

/** El estilo guardado del personaje o, si no tiene, su color con números que se lean. */
export function estiloDe(p: Pick<Personaje, 'color' | 'dados'> | undefined): EstiloDados {
  if (!p) return ESTILO_DM;
  return p.dados ?? { color: p.color, tinta: tintaPara(p.color), acabado: 'pulido' };
}

export const totalDados = (s: Seleccion) => TIPOS_DADO.reduce((n, t) => n + (s[t] ?? 0), 0);

/** Cuántos dados físicos salen a la mesa: el d100 son dos d10. */
export const dadosEnMesa = (s: Seleccion) => totalDados(s) + (s.d100 ?? 0);

/** Suma o resta un dado de un tipo sin pasar de los límites. */
export function cambiarSeleccion(s: Seleccion, tipo: TipoDado, delta: number): Seleccion {
  const n = Math.max(0, (s[tipo] ?? 0) + delta);
  const siguiente = { ...s, [tipo]: n };
  if (!n) delete siguiente[tipo];
  return delta > 0 && dadosEnMesa(siguiente) > MAX_DADOS ? s : siguiente;
}

const conSigno = (n: number) => (n >= 0 ? `+ ${n}` : `− ${-n}`);

/** «2d6 + 1d20 + 3» */
export function formula(s: Seleccion, modificador = 0) {
  const partes = TIPOS_DADO.filter((t) => s[t]).map((t) => `${s[t]}${t}`);
  if (!partes.length) return modificador ? String(modificador) : '';
  return partes.join(' + ') + (modificador ? ` ${conSigno(modificador)}` : '');
}

/** Entero uniforme de 1 a `caras` sin sesgo (se descartan los valores que sobran del rango). */
export function azar(caras: number) {
  const limite = Math.floor(0x1_0000_0000 / caras) * caras;
  const r = new Uint32Array(1);
  do crypto.getRandomValues(r); while (r[0] >= limite);
  return (r[0] % caras) + 1;
}

export function tirar(s: Seleccion, generar: (caras: number) => number = azar) {
  return TIPOS_DADO.flatMap((tipo) => Array.from({ length: s[tipo] ?? 0 }, () => ({ tipo, valor: generar(CARAS[tipo]) })));
}

/** Índices de los d20 que no cuentan por ventaja o desventaja. */
export function descartados(t: Pick<Tirada, 'dados' | 'modo'>): Set<number> {
  const d20 = t.dados.map((d, i) => ({ ...d, i })).filter((d) => d.tipo === 'd20');
  if (!t.modo || d20.length < 2) return new Set();
  const queda = d20.reduce((a, b) => (t.modo === 'ventaja' ? (b.valor > a.valor ? b : a) : (b.valor < a.valor ? b : a)));
  return new Set(d20.filter((d) => d.i !== queda.i).map((d) => d.i));
}

export function total(t: Pick<Tirada, 'dados' | 'modificador' | 'modo'>) {
  const fuera = descartados(t);
  return t.dados.reduce((s, d, i) => s + (fuera.has(i) ? 0 : d.valor), 0) + t.modificador;
}

/** Natural 20 (o lo que diga el arma) o natural 1 en un d20. */
export const critico = (d: { tipo: TipoDado; valor: number }, critMin = 20) =>
  (d.tipo !== 'd20' ? null : d.valor >= critMin ? 'exito' : d.valor === 1 ? 'pifia' : null);

/** Crítico o pifia de la tirada, mirando solo el d20 que cuenta. */
export function criticoDe(t: Pick<Tirada, 'dados' | 'modo' | 'critMin'>) {
  const fuera = descartados(t);
  const r = t.dados.map((d, i) => (fuera.has(i) ? null : critico(d, t.critMin)));
  return r.includes('exito') ? 'exito' : r.includes('pifia') ? 'pifia' : null;
}

/** «2d6 + 1d20 + 3» a partir de los dados ya tirados. */
export function formulaDe(t: Pick<Tirada, 'dados' | 'modificador'>) {
  const s: Seleccion = {};
  for (const d of t.dados) s[d.tipo] = (s[d.tipo] ?? 0) + 1;
  return formula(s, t.modificador);
}

const CARAS_VALIDAS = new Map(TIPOS_DADO.map((t) => [CARAS[t], t]));

/**
 * «2d6+2», «1d8 + 1d6 + 3», «d20 − 1» a dados que se pueden tirar en la mesa. Null si no hay dados, si
 * alguno no existe en 3D (d3) o si son demasiados.
 */
export function parsearFormula(texto: string): { seleccion: Seleccion; modificador: number } | null {
  const limpio = texto.replace(/\s+/g, '').replace(/−/g, '-').toLowerCase();
  if (!limpio || !/^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/.test(limpio)) return null;
  const seleccion: Seleccion = {};
  let modificador = 0;
  for (const [, signo, n, caras, fijo] of limpio.matchAll(/([+-]?)(?:(\d*)d(\d+)|(\d+))/g)) {
    if (fijo !== undefined) { modificador += (signo === '-' ? -1 : 1) * Number(fijo); continue; }
    const tipo = CARAS_VALIDAS.get(Number(caras));
    const cuantos = Number(n || 1);
    if (!tipo || signo === '-' || !cuantos) return null;
    seleccion[tipo] = (seleccion[tipo] ?? 0) + cuantos;
  }
  if (!totalDados(seleccion) || dadosEnMesa(seleccion) > MAX_DADOS || Math.abs(modificador) > MAX_MODIFICADOR) return null;
  return { seleccion, modificador };
}

/** Los dados de cada tipo, el doble (daño de un crítico [5e]). */
export const doblar = (s: Seleccion): Seleccion =>
  Object.fromEntries(Object.entries(s).map(([t, n]) => [t, Math.min(n * 2, MAX_DADOS)])) as Seleccion;

/** Una tirada nueva, ya con los números sacados. */
export function crearTirada(
  datos: Omit<Tirada, 'id' | 'fecha' | 'dados'> & { seleccion: Seleccion },
  generar: (caras: number) => number = azar,
): Tirada {
  const { seleccion, ...resto } = datos;
  return { id: crypto.randomUUID(), fecha: Date.now(), ...resto, dados: tirar(seleccion, generar) };
}

export function esEstilo(x: unknown): x is EstiloDados {
  const e = x as EstiloDados;
  return !!e && HEX.test(e.color) && HEX.test(e.tinta) && (ACABADOS as readonly string[]).includes(e.acabado);
}

/** Lo que llega de otro jugador se comprueba antes de pintarlo. */
export function esTirada(x: unknown): x is Tirada {
  const t = x as Tirada;
  return !!t && typeof t.id === 'string' && typeof t.fecha === 'number' && typeof t.quien === 'string' && typeof t.nombre === 'string'
    && esEstilo(t.estilo) && Number.isInteger(t.modificador) && Math.abs(t.modificador) <= MAX_MODIFICADOR
    && (t.motivo === undefined || (typeof t.motivo === 'string' && t.motivo.length <= 120))
    && (t.modo === undefined || t.modo === 'ventaja' || t.modo === 'desventaja')
    && (t.critMin === undefined || (Number.isInteger(t.critMin) && t.critMin >= 2 && t.critMin <= 20))
    && Array.isArray(t.dados) && t.dados.length > 0 && t.dados.length <= MAX_DADOS
    && t.dados.every((d) => TIPOS_DADO.includes(d?.tipo) && Number.isInteger(d.valor) && d.valor >= 1 && d.valor <= CARAS[d.tipo]);
}

/** Cambia el estilo de los dados de un personaje. */
export function cambiarEstiloDados<E extends { personajes: Personaje[] }>(e: E, personajeId: string, estilo: EstiloDados): E {
  if (!esEstilo(estilo)) throw new Error('Estilo de dados no válido');
  if (!e.personajes.some((p) => p.id === personajeId)) throw new Error('Ese personaje ya no existe');
  return { ...e, personajes: e.personajes.map((p) => (p.id === personajeId ? { ...p, dados: estilo } : p)) };
}

/** Mínimo, máximo y media de unos dados con su modificador. */
export function rango(s: Seleccion, modificador = 0) {
  const n = totalDados(s);
  const max = TIPOS_DADO.reduce((m, t) => m + (s[t] ?? 0) * CARAS[t], 0);
  return { min: n + modificador, max: max + modificador, media: (n + max) / 2 + modificador };
}
