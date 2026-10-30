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

export const total = (t: Pick<Tirada, 'dados' | 'modificador'>) => t.dados.reduce((s, d) => s + d.valor, 0) + t.modificador;

/** Natural 20 o natural 1 en un d20. */
export const critico = (d: { tipo: TipoDado; valor: number }) => (d.tipo !== 'd20' ? null : d.valor === 20 ? 'exito' : d.valor === 1 ? 'pifia' : null);

/** «2d6 + 1d20 + 3» a partir de los dados ya tirados. */
export function formulaDe(t: Pick<Tirada, 'dados' | 'modificador'>) {
  const s: Seleccion = {};
  for (const d of t.dados) s[d.tipo] = (s[d.tipo] ?? 0) + 1;
  return formula(s, t.modificador);
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
    && Array.isArray(t.dados) && t.dados.length > 0 && t.dados.length <= MAX_DADOS
    && t.dados.every((d) => TIPOS_DADO.includes(d?.tipo) && Number.isInteger(d.valor) && d.valor >= 1 && d.valor <= CARAS[d.tipo]);
}

/** Cambia el estilo de los dados de un personaje. */
export function cambiarEstiloDados<E extends { personajes: Personaje[] }>(e: E, personajeId: string, estilo: EstiloDados): E {
  if (!esEstilo(estilo)) throw new Error('Estilo de dados no válido');
  if (!e.personajes.some((p) => p.id === personajeId)) throw new Error('Ese personaje ya no existe');
  return { ...e, personajes: e.personajes.map((p) => (p.id === personajeId ? { ...p, dados: estilo } : p)) };
}
