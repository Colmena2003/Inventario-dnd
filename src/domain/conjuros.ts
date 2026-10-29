// Espacios de conjuro [5e]: cuántos tiene cada personaje por nivel según sus clases (con las reglas de
// multiclase), cuántos ha gastado y la magia del pacto del brujo, que va aparte y vuelve con un descanso corto.

import type { Estado, Personaje } from './tipos';

/** Espacios por nivel de conjuro de un lanzador completo, por nivel de lanzador (1–20). */
const TABLA: number[][] = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

type Lanzador = 'completo' | 'medio' | 'artifice' | 'pacto';

const CLASES: [RegExp, Lanzador][] = [
  [/^(bard|cl[eé]rig|druid|hechicer|mag[oa])/i, 'completo'],
  [/^(palad|explorador|guardabosque)/i, 'medio'],
  [/^artific/i, 'artifice'],
  [/^(brujo|bruja)/i, 'pacto'],
];

const lanzador = (clase: string) => CLASES.find(([re]) => re.test(clase.trim()))?.[1];

/** Nivel de lanzador para la tabla común: completos enteros, medios la mitad (artífice redondeando hacia arriba). */
function nivelLanzador(p: Personaje): number {
  const lanzan = p.clases.map((c) => ({ ...c, t: lanzador(c.clase) })).filter((c) => c.t && c.t !== 'pacto');
  if (lanzan.length === 1) {
    // Con una sola clase lanzadora, un paladín o explorador empieza a nivel 2
    const c = lanzan[0];
    if (c.t === 'completo') return c.nivel;
    if (c.t === 'artifice') return Math.ceil(c.nivel / 2);
    return c.nivel < 2 ? 0 : Math.ceil(c.nivel / 2);
  }
  return lanzan.reduce((s, c) => s + (c.t === 'completo' ? c.nivel : c.t === 'artifice' ? Math.ceil(c.nivel / 2) : Math.floor(c.nivel / 2)), 0);
}

/** Espacios máximos por nivel de conjuro (índice 0 = nivel 1), sin contar el pacto. */
export function espaciosMax(p: Personaje): number[] {
  if (p.espaciosMax?.some((n) => n > 0)) return p.espaciosMax.map((n) => Math.max(0, Math.floor(n || 0)));
  const nivel = Math.min(20, nivelLanzador(p));
  return nivel > 0 ? TABLA[nivel - 1] : [];
}

/** [5e] Magia del pacto: cuántos espacios y de qué nivel, según el nivel de brujo. */
export function pacto(p: Personaje): { espacios: number; nivel: number } | null {
  const brujo = p.clases.filter((c) => lanzador(c.clase) === 'pacto').reduce((s, c) => s + c.nivel, 0);
  if (!brujo) return null;
  return {
    espacios: brujo >= 17 ? 4 : brujo >= 11 ? 3 : brujo >= 2 ? 2 : 1,
    nivel: Math.min(5, Math.ceil(brujo / 2)),
  };
}

export type EspaciosNivel = { nivel: number; max: number; usados: number };

/** Lo que enseña la ficha: los niveles con espacios, con los gastados. */
export function espaciosDe(p: Personaje): { niveles: EspaciosNivel[]; pacto: (EspaciosNivel & { espacios: number }) | null } {
  const max = espaciosMax(p);
  const niveles = max.map((m, i) => ({ nivel: i + 1, max: m, usados: Math.min(m, p.espaciosUsados?.[i] ?? 0) })).filter((x) => x.max > 0);
  const pc = pacto(p);
  return { niveles, pacto: pc ? { nivel: pc.nivel, max: pc.espacios, espacios: pc.espacios, usados: Math.min(pc.espacios, p.pactoUsados ?? 0) } : null };
}

const fijar = (e: Estado, id: string, f: (p: Personaje) => Personaje): Estado => ({ ...e, personajes: e.personajes.map((p) => (p.id === id ? f(p) : p)) });

/** Gasta (+1) o recupera (−1) un espacio de ese nivel. Lanza un error si no quedan. */
export function gastarEspacio(e: Estado, personajeId: string, nivel: number, delta: 1 | -1): Estado {
  return fijar(e, personajeId, (p) => {
    const max = espaciosMax(p)[nivel - 1] ?? 0;
    const usados = [...(p.espaciosUsados ?? [])];
    while (usados.length < nivel) usados.push(0);
    const nuevo = usados[nivel - 1] + delta;
    if (nuevo > max) throw new Error(`No quedan espacios de nivel ${nivel}`);
    usados[nivel - 1] = Math.max(0, nuevo);
    return { ...p, espaciosUsados: usados };
  });
}

export function gastarPacto(e: Estado, personajeId: string, delta: 1 | -1): Estado {
  return fijar(e, personajeId, (p) => {
    const pc = pacto(p);
    const nuevo = (p.pactoUsados ?? 0) + delta;
    if (!pc || nuevo > pc.espacios) throw new Error('No quedan espacios de pacto');
    return { ...p, pactoUsados: Math.max(0, nuevo) };
  });
}

/** Un descanso largo devuelve todos los espacios; uno corto, solo los del pacto. */
export function descansarEspacios(e: Estado, ids: string[], descanso: 'corto' | 'largo'): Estado {
  return {
    ...e,
    personajes: e.personajes.map((p) => {
      if (!ids.includes(p.id)) return p;
      const r = { ...p, pactoUsados: 0 };
      if (descanso === 'largo') r.espaciosUsados = [];
      return r;
    }),
  };
}

/** Si recupera algo con ese descanso, para el aviso. */
export function recuperaEspacios(p: Personaje, descanso: 'corto' | 'largo'): boolean {
  return (p.pactoUsados ?? 0) > 0 || (descanso === 'largo' && (p.espaciosUsados ?? []).some((n) => n > 0));
}
