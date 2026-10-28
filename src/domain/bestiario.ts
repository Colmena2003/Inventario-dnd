// Bestiario: criaturas con las que se ha enfrentado la party. Funciones puras.

import { modificador, nuevoId } from './reglas';
import type { Actitud, BotinCriatura, Caracteristica, Criatura, Estado, Ficha, HabilidadCriatura, TipoHabilidad } from './tipos';

export type DatosCriatura = Omit<Criatura, 'id' | 'creada' | 'actualizada' | 'creadaPor'>;

export type ResultadoCriatura = { ok: true; estado: Estado; id: string } | { ok: false; motivo: string };

export const ACTITUDES: { id: Actitud; texto: string }[] = [
  { id: 'agresiva', texto: 'Agresiva' },
  { id: 'no agresiva', texto: 'No agresiva' },
  { id: 'desconocida', texto: 'Desconocida' },
];

export const TIPOS_HABILIDAD: { id: TipoHabilidad; texto: string; uno: string }[] = [
  { id: 'rasgo', texto: 'Rasgos', uno: 'Rasgo' },
  { id: 'accion', texto: 'Acciones', uno: 'Acción' },
  { id: 'reaccion', texto: 'Reacciones', uno: 'Reacción' },
  { id: 'legendaria', texto: 'Acciones legendarias', uno: 'Legendaria' },
];

export const CARACTERISTICAS: [Caracteristica, string][] = [['fue', 'FUE'], ['des', 'DES'], ['con', 'CON'], ['int', 'INT'], ['sab', 'SAB'], ['car', 'CAR']];

/** PX por valor de desafío (tabla del Manual de Monstruos). */
const PX_DESAFIO: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800, '6': 2300, '7': 2900, '8': 3900,
  '9': 5000, '10': 5900, '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000, '16': 15000, '17': 18000, '18': 20000,
  '19': 22000, '20': 25000, '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000, '26': 90000, '27': 105000, '28': 120000,
  '29': 135000, '30': 155000,
};
export const pxDeDesafio = (d: string | undefined) => (d ? PX_DESAFIO[d.trim()] : undefined);

export const criaturaEnBlanco = (): DatosCriatura => ({ nombre: '', actitud: 'desconocida', habilidades: [], botin: [] });

export const habilidadEnBlanco = (tipo: TipoHabilidad = 'accion'): HabilidadCriatura => ({ id: nuevoId('h'), tipo });

/** Una habilidad sin nombre ni descripción es un hueco: se sabe que existe, pero no qué hace. */
export const sinDescubrir = (h: HabilidadCriatura) => !h.nombre?.trim() && !h.descripcion?.trim();

/** Modificador de una característica, o undefined si no se conoce. */
export const modDe = (c: Criatura | DatosCriatura, k: Caracteristica) => {
  const v = c.caracteristicas?.[k];
  return v === undefined ? undefined : modificador(v);
};

/** Cuánto se sabe de la criatura (0–1), para la barra de «conocimiento» de la tarjeta. */
export function conocimiento(c: DatosCriatura): number {
  const campos = [c.tipo, c.tamano, c.desafio, c.ca, c.pv, c.velocidad, c.sentidos, c.idiomas];
  const cars = CARACTERISTICAS.map(([k]) => c.caracteristicas?.[k]);
  const habs = c.habilidades.length ? c.habilidades.filter((h) => !sinDescubrir(h)).length / c.habilidades.length : 0;
  const sabidos = [...campos, ...cars].filter((x) => x !== undefined && x !== '').length;
  return (sabidos + habs * 4) / (campos.length + cars.length + 4);
}

function limpiar(d: DatosCriatura): DatosCriatura {
  const texto = (s: string | undefined) => (s?.trim() ? s.trim() : undefined);
  const cars = Object.fromEntries(Object.entries(d.caracteristicas ?? {}).filter(([, v]) => v !== undefined && Number.isFinite(v)));
  return {
    ...d,
    nombre: d.nombre.trim(),
    tipo: texto(d.tipo), tamano: texto(d.tamano), alineamiento: texto(d.alineamiento), desafio: texto(d.desafio),
    caNota: texto(d.caNota), pvDados: texto(d.pvDados), velocidad: texto(d.velocidad), salvaciones: texto(d.salvaciones),
    pericias: texto(d.pericias), resistencias: texto(d.resistencias), inmunidades: texto(d.inmunidades),
    vulnerabilidades: texto(d.vulnerabilidades), sentidos: texto(d.sentidos), idiomas: texto(d.idiomas),
    notas: texto(d.notas), lugar: texto(d.lugar),
    caracteristicas: Object.keys(cars).length ? cars : undefined,
    habilidades: d.habilidades.map((h) => ({ ...h, nombre: texto(h.nombre), descripcion: texto(h.descripcion), detalle: texto(h.detalle) })),
    // Un botín sin objeto ni nombre no dice nada
    botin: d.botin.filter((b) => b.fichaId || b.nombre?.trim()).map((b) => ({ ...b, nombre: texto(b.nombre), cantidad: texto(b.cantidad), nota: texto(b.nota) })),
  };
}

function comprobar(d: DatosCriatura): string | null {
  if (!d.nombre.trim()) return 'Ponle un nombre a la criatura (aunque sea «Bicho del pantano»)';
  const enteros: [number | undefined, string][] = [
    [d.ca, 'La CA tiene'], [d.pv, 'Los PV tienen'], [d.px, 'Los PX tienen'], [d.encuentros, 'Los encuentros tienen'], [d.derrotadas, 'Las veces derrotada tienen'],
  ];
  for (const [v, t] of enteros) if (v !== undefined && (!Number.isInteger(v) || v < 0)) return `${t} que ser un número entero sin signo`;
  for (const [k, t] of CARACTERISTICAS) {
    const v = d.caracteristicas?.[k];
    if (v !== undefined && (!Number.isInteger(v) || v < 1 || v > 30)) return `${t} va de 1 a 30`;
  }
  return null;
}

export function crearCriatura(e: Estado, datos: DatosCriatura, actor: string, ahora = Date.now()): ResultadoCriatura {
  const error = comprobar(datos);
  if (error) return { ok: false, motivo: error };
  const c: Criatura = { ...limpiar(datos), id: nuevoId('c'), creada: ahora, actualizada: ahora, creadaPor: actor || undefined };
  return { ok: true, estado: { ...e, bestiario: [...(e.bestiario ?? []), c] }, id: c.id };
}

export function editarCriatura(e: Estado, id: string, datos: DatosCriatura, ahora = Date.now()): ResultadoCriatura {
  const c = e.bestiario?.find((x) => x.id === id);
  if (!c) return { ok: false, motivo: 'Esa criatura ya no está en el bestiario' };
  const error = comprobar(datos);
  if (error) return { ok: false, motivo: error };
  const nueva: Criatura = { ...limpiar(datos), id, creada: c.creada, creadaPor: c.creadaPor, actualizada: ahora };
  return { ok: true, estado: { ...e, bestiario: e.bestiario!.map((x) => (x.id === id ? nueva : x)) }, id };
}

export const eliminarCriatura = (e: Estado, id: string): Estado => ({ ...e, bestiario: (e.bestiario ?? []).filter((c) => c.id !== id) });

/** Ficha de la biblioteca de un botín: la enlazada o, si no, la que se llama igual. */
export function fichaDeBotin(e: Estado, b: BotinCriatura): Ficha | undefined {
  const lista = e.biblioteca ?? [];
  if (b.fichaId) return lista.find((f) => f.id === b.fichaId);
  const n = b.nombre?.trim().toLocaleLowerCase('es');
  return n ? lista.find((f) => f.nombre.toLocaleLowerCase('es') === n) : undefined;
}

/** Suma un encuentro (y una derrota si la party la venció). */
export function anotarEncuentro(e: Estado, id: string, derrotada: boolean, ahora = Date.now()): Estado {
  return {
    ...e,
    bestiario: (e.bestiario ?? []).map((c) => (c.id === id
      ? { ...c, encuentros: (c.encuentros ?? 0) + 1, derrotadas: (c.derrotadas ?? 0) + (derrotada ? 1 : 0), actualizada: ahora }
      : c)),
  };
}
