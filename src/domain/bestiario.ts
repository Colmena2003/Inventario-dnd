// Bestiario: las criaturas con las que se ha cruzado la party. Solo el nombre es obligatorio; lo que no
// se sabe queda vacío y la interfaz lo enseña como «sin descubrir».

import { nuevoId } from './reglas';
import type { BotinCriatura, Caracteristica, Criatura, Estado, FichaObjeto, HabilidadCriatura, TipoHabilidad } from './tipos';

export const ACTITUDES: { id: Criatura['actitud']; texto: string }[] = [
  { id: 'agresiva', texto: 'Agresiva' }, { id: 'no agresiva', texto: 'No agresiva' }, { id: 'desconocida', texto: 'Desconocida' },
];

export const TIPOS_HABILIDAD: { id: TipoHabilidad; texto: string; uno: string }[] = [
  { id: 'rasgo', texto: 'Rasgos', uno: 'Rasgo' }, { id: 'accion', texto: 'Acciones', uno: 'Acción' },
  { id: 'reaccion', texto: 'Reacciones', uno: 'Reacción' }, { id: 'legendaria', texto: 'Acciones legendarias', uno: 'Legendaria' },
];

const CARS: Caracteristica[] = ['fue', 'des', 'con', 'int', 'sab', 'car'];

/** [5e] PX por valor de desafío. */
const PX_POR_VD: Record<string, number> = {
  0: 10, '1/8': 25, '1/4': 50, '1/2': 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900, 9: 5000,
  10: 5900, 11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000, 16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000,
  21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000, 26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000,
};
export const pxPorDesafio = (vd?: string) => (vd ? PX_POR_VD[vd.trim()] : undefined);

/** Para ordenar por desafío: «1/2» → 0,5. */
export const valorDesafio = (vd?: string) => {
  if (!vd?.trim()) return -1;
  const [a, b] = vd.trim().split('/').map(Number);
  return b ? a / b : a || 0;
};

export const criaturaVacia = (): Omit<Criatura, 'id' | 'creada' | 'actualizada'> => ({ nombre: '', actitud: 'desconocida', habilidades: [], botin: [] });
export const habilidadVacia = (tipo: TipoHabilidad = 'accion'): HabilidadCriatura => ({ id: nuevoId('h'), tipo });
export const habilidadOculta = (h: HabilidadCriatura) => !h.nombre?.trim() && !h.descripcion?.trim();

/** Cuánto se sabe de una criatura, de 0 a 1: datos de combate, características y habilidades descubiertas. */
export function conocido(c: Criatura): number {
  const datos = [c.tipo, c.tamano, c.desafio, c.ca, c.pv, c.velocidad, c.sentidos, c.idiomas];
  const cars = CARS.map((k) => c.caracteristicas?.[k]);
  const habs = c.habilidades.length ? c.habilidades.filter((h) => !habilidadOculta(h)).length / c.habilidades.length : 0;
  return ([...datos, ...cars].filter((x) => x !== undefined && x !== '').length + habs * 4) / (datos.length + cars.length + 4);
}

export function validarCriatura(c: Omit<Criatura, 'id' | 'creada' | 'actualizada'>): string | null {
  if (!c.nombre.trim()) return 'Ponle un nombre a la criatura (aunque sea «Bicho del pantano»)';
  const enteros: [number | undefined, string][] = [[c.ca, 'La CA tiene'], [c.pv, 'Los PV tienen'], [c.px, 'Los PX tienen'], [c.encuentros, 'Los encuentros tienen'], [c.derrotadas, 'Las veces abatida tienen']];
  for (const [v, t] of enteros) if (v !== undefined && (!Number.isInteger(v) || v < 0)) return `${t} que ser un número entero sin signo`;
  for (const k of CARS) {
    const v = c.caracteristicas?.[k];
    if (v !== undefined && (!Number.isInteger(v) || v < 1 || v > 30)) return `${k.toUpperCase()} va de 1 a 30`;
  }
  return null;
}

const texto = (s?: string) => (s?.trim() ? s.trim() : undefined);

/** Recorta espacios y quita lo vacío: habilidades sin nada (salvo las «sin descubrir») y botín sin nombre. */
function limpiar<T extends Omit<Criatura, 'id' | 'creada' | 'actualizada'>>(c: T): T {
  const cars = Object.fromEntries(Object.entries(c.caracteristicas ?? {}).filter(([, v]) => v !== undefined && Number.isFinite(v)));
  const r: T = {
    ...c, nombre: c.nombre.trim(),
    caracteristicas: Object.keys(cars).length ? cars : undefined,
    habilidades: c.habilidades.map((h) => ({ ...h, nombre: texto(h.nombre), detalle: texto(h.detalle), descripcion: texto(h.descripcion) })),
    botin: c.botin.filter((b) => b.fichaId || b.nombre?.trim()).map((b): BotinCriatura => ({ ...b, nombre: texto(b.nombre), cantidad: texto(b.cantidad), nota: texto(b.nota) })),
  };
  for (const k of ['tipo', 'tamano', 'alineamiento', 'desafio', 'caNota', 'pvDados', 'velocidad', 'salvaciones', 'pericias', 'resistencias', 'inmunidades', 'vulnerabilidades', 'sentidos', 'idiomas', 'lugar', 'notas'] as const) {
    (r as Record<string, unknown>)[k] = texto(c[k]);
  }
  return r;
}

export type ResultadoCriatura = { ok: true; estado: Estado; id: string } | { ok: false; motivo: string };

export function crearCriatura(e: Estado, datos: Omit<Criatura, 'id' | 'creada' | 'actualizada'>, actor: string, ahora = Date.now()): ResultadoCriatura {
  const motivo = validarCriatura(datos);
  if (motivo) return { ok: false, motivo };
  const c: Criatura = { ...limpiar(datos), id: nuevoId('c'), creada: ahora, actualizada: ahora, creadaPor: actor || undefined };
  return { ok: true, estado: { ...e, bestiario: [...(e.bestiario ?? []), c] }, id: c.id };
}

export function editarCriatura(e: Estado, id: string, datos: Omit<Criatura, 'id' | 'creada' | 'actualizada'>, ahora = Date.now()): ResultadoCriatura {
  const antes = (e.bestiario ?? []).find((c) => c.id === id);
  if (!antes) return { ok: false, motivo: 'Esa criatura ya no está en el bestiario' };
  const motivo = validarCriatura(datos);
  if (motivo) return { ok: false, motivo };
  const c: Criatura = { ...limpiar(datos), id, creada: antes.creada, creadaPor: antes.creadaPor, actualizada: ahora };
  return { ok: true, estado: { ...e, bestiario: e.bestiario!.map((x) => (x.id === id ? c : x)) }, id };
}

export const eliminarCriatura = (e: Estado, id: string): Estado => ({ ...e, bestiario: (e.bestiario ?? []).filter((c) => c.id !== id) });

/** Suma un encuentro (y una vez abatida si `abatida`). */
export function registrarEncuentro(e: Estado, id: string, abatida: boolean, ahora = Date.now()): Estado {
  return {
    ...e,
    bestiario: (e.bestiario ?? []).map((c) => (c.id === id
      ? { ...c, encuentros: (c.encuentros ?? 0) + 1, derrotadas: (c.derrotadas ?? 0) + (abatida ? 1 : 0), actualizada: ahora }
      : c)),
  };
}

/** Ficha de la biblioteca de una línea de botín: la enlazada o una con ese nombre. */
export function fichaDeBotin(e: Estado, b: BotinCriatura): FichaObjeto | undefined {
  const lista = e.biblioteca ?? [];
  if (b.fichaId) return lista.find((f) => f.id === b.fichaId);
  const n = b.nombre?.trim().toLocaleLowerCase('es');
  return n ? lista.find((f) => f.nombre.toLocaleLowerCase('es') === n) : undefined;
}
