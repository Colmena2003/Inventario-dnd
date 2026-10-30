// Usar objetos (gastar cargas o unidades), recuperar cargas y usos en los descansos, y efectos temporales
// con duración. Como en reglas.ts, funciones puras; las tiradas se hacen al preparar la acción para que
// repetirla sobre un estado más nuevo (sincronización) no cambie el resultado.

import { hoja } from './hoja';
import { nuevoId, primerNombre } from './reglas';
import type { Duracion, EfectoTemporal, Estado, Objeto, PlantillaEfecto } from './tipos';

// ── Dados ──────────────────────────────────────────────────────────

export type Tirada = { expr: string; total: number; detalle: string };

const RE_DADOS = /(\d*)\s*d\s*(\d+)(?:\s*([+\-−])\s*(\d+))?/i;

/** Tira «2d4+2», «1d6 + 1» o «d20». Devuelve null si el texto no tiene dados. */
export function tirar(texto: string, rng: () => number = Math.random): Tirada | null {
  const m = RE_DADOS.exec(texto);
  if (!m) return null;
  const n = Math.min(100, Number(m[1] || 1)), caras = Number(m[2]);
  if (!n || !caras) return null;
  const dados = Array.from({ length: n }, () => 1 + Math.floor(rng() * caras));
  const extra = m[4] ? (m[3] === '+' ? 1 : -1) * Number(m[4]) : 0;
  const total = Math.max(0, dados.reduce((s, d) => s + d, 0) + extra);
  const expr = `${n}d${caras}${extra ? (extra > 0 ? '+' : '−') + Math.abs(extra) : ''}`;
  return { expr, total, detalle: `[${dados.join(', ')}]${extra ? (extra > 0 ? ' + ' : ' − ') + Math.abs(extra) : ''}` };
}

/** «Recuperas 2d4+2 PV», «recupera 10 puntos de golpe»: lo que cura, como dados o número fijo. */
const RE_CURA = /recupera\w*\s+(?:\w+\s+){0,2}?(\d*d\d+(?:\s*[+\-−]\s*\d+)?|\d+)\s*(?:pv|puntos de golpe)/i;

// ── Usar objetos ───────────────────────────────────────────────────

/** Se puede usar si tiene cargas, se gasta al usarlo (poción, pergamino, comida) o aplica un efecto. */
export function usable(o: Objeto): boolean {
  if (o.cargasMax) return true;
  if (o.alUsar) return true;
  if (o.categoria === 'Comida') return !!o.saciedad;
  return o.tipo === 'pocion' || o.tipo === 'pergamino' || o.categoria === 'Pociones' || o.categoria === 'Pergaminos';
}

export interface PlanUso {
  objetoId: string;
  personajeId: string;
  gasta: 'carga' | 'unidad';
  tirada?: Tirada;
  /** PV que recupera, ya tirados. */
  cura?: number;
  efecto?: EfectoTemporal;
}

export type ResultadoPlan = { ok: true; plan: PlanUso; texto: string } | { ok: false; motivo: string };


/**
 * Prepara el uso: comprueba que quede algo que gastar, tira los dados del efecto y decide qué cambia.
 * Lo usa el dueño; un objeto del alijo lo usa `personajeId`.
 */
export function prepararUso(e: Estado, objetoId: string, personajeId?: string, rng: () => number = Math.random): ResultadoPlan {
  const o = e.objetos.find((x) => x.id === objetoId);
  if (!o) return { ok: false, motivo: 'El objeto ya no existe' };
  if (!usable(o)) return { ok: false, motivo: `${o.nombre} no se usa: no tiene cargas ni se gasta` };
  const pid = o.propietario.tipo === 'personaje' ? o.propietario.id : personajeId;
  const p = e.personajes.find((x) => x.id === pid);
  if (!p) return { ok: false, motivo: `Dale ${o.nombre} a un personaje para usarlo` };
  if (o.requiereSintonizacion && !o.sintonizado) return { ok: false, motivo: `${o.nombre} solo funciona sintonizado` };

  const gasta = o.cargasMax ? 'carga' : 'unidad';
  if (gasta === 'carga' && (o.cargas ?? 0) < 1) {
    return { ok: false, motivo: `${o.nombre} no tiene cargas${o.recarga ? ` (se recupera: ${o.recarga.toLowerCase()})` : ''}` };
  }
  if (gasta === 'unidad' && o.cantidad < 1) return { ok: false, motivo: `No queda ${o.nombre.toLowerCase()}` };

  const plan: PlanUso = { objetoId: o.id, personajeId: p.id, gasta };
  const partes: string[] = [];
  const texto = o.efectos?.trim() ?? '';
  const cura = RE_CURA.exec(texto);
  if (cura) {
    const t = tirar(cura[1], rng);
    plan.cura = t ? t.total : Number(cura[1]);
    if (t) plan.tirada = t;
    const max = hoja(e, p).pvMax.total;
    const despues = Math.min(max, p.pvActual + plan.cura);
    partes.push(`recupera ${plan.cura} PV${t ? ` (${t.expr}: ${t.detalle})` : ''} · PV ${p.pvActual} → ${despues}`);
  } else {
    const t = tirar(texto, rng);
    if (t) { plan.tirada = t; partes.push(`${t.expr} = ${t.total} ${t.detalle}`); }
    if (texto) partes.unshift(texto.split(/(?<=\.)\s/)[0].replace(/\.$/, ''));
  }
  if (o.alUsar) {
    plan.efecto = { ...o.alUsar, id: nuevoId('ef'), origen: o.nombre, modificadores: o.alUsar.modificadores.map((m) => ({ ...m })) };
    partes.push(`${o.alUsar.nombre} (${textoDuracion(o.alUsar.duracion)})`);
  }
  if (gasta === 'carga') partes.push(`quedan ${(o.cargas ?? 0) - 1}/${o.cargasMax} cargas`);
  else if (o.cantidad > 1) partes.push(`quedan ${o.cantidad - 1}`);

  return { ok: true, plan, texto: `${primerNombre(p.nombre)} usa ${o.nombre}${partes.length ? `: ${partes.join(' · ')}` : ''}` };
}

/** Aplica un uso preparado. Lanza un error si ya no se puede (otro jugador lo gastó antes). */
export function aplicarUso(e: Estado, plan: PlanUso): Estado {
  const o = e.objetos.find((x) => x.id === plan.objetoId);
  const p = e.personajes.find((x) => x.id === plan.personajeId);
  if (!o || !p) throw new Error('El objeto o el personaje ya no existen');
  let objetos: Objeto[];
  if (plan.gasta === 'carga') {
    if ((o.cargas ?? 0) < 1) throw new Error(`${o.nombre} no tiene cargas`);
    objetos = e.objetos.map((x) => (x.id === o.id ? { ...x, cargas: (x.cargas ?? 0) - 1 } : x));
  } else {
    if (o.cantidad < 1) throw new Error(`No queda ${o.nombre.toLowerCase()}`);
    objetos = o.cantidad > 1 ? e.objetos.map((x) => (x.id === o.id ? { ...x, cantidad: x.cantidad - 1 } : x)) : e.objetos.filter((x) => x.id !== o.id);
  }
  let r: Estado = { ...e, objetos };
  if (plan.efecto) r = aplicarEfecto(r, [p.id], plan.efecto);
  if (plan.cura) {
    const pj = r.personajes.find((x) => x.id === p.id)!;
    const max = hoja(r, pj).pvMax.total;
    r = { ...r, personajes: r.personajes.map((x) => (x.id === p.id ? { ...x, pvActual: Math.min(max, x.pvActual + plan.cura!) } : x)) };
  }
  return r;
}

// ── Recargas en los descansos ──────────────────────────────────────

export type Descanso = 'corto' | 'largo';

/** De qué descanso depende una recarga escrita a mano; null si no se recupera sola. */
export function descansoDeRecarga(texto?: string): Descanso | null {
  const t = texto?.trim().toLowerCase();
  if (!t) return null;
  if (/corto/.test(t)) return 'corto';
  return 'largo'; // «Al amanecer», «Descanso largo», «1d6+1 al alba», «Diaria»…
}

const tocaRecargar = (cuando: Descanso | null, descanso: Descanso) => cuando === 'corto' || (cuando === 'largo' && descanso === 'largo');

export interface PlanRecarga {
  objetos: { objetoId: string; n: number }[];
  rasgos: { personajeId: string; nombre: string }[];
  textos: string[];
}

/**
 * Qué recupera la party con un descanso. Los objetos de esos personajes (y, en un descanso largo, los del
 * alijo, que también ven amanecer) recuperan lo que diga su «Recarga»: los dados que ponga, «N cargas» o
 * todas. Los rasgos con usos vuelven al máximo.
 */
export function prepararRecarga(e: Estado, ids: string[], descanso: Descanso, rng: () => number = Math.random): PlanRecarga {
  const plan: PlanRecarga = { objetos: [], rasgos: [], textos: [] };
  for (const o of e.objetos) {
    const deQuien = o.propietario.tipo === 'personaje' ? ids.includes(o.propietario.id) : descanso === 'largo';
    if (!deQuien || !o.cargasMax || (o.cargas ?? 0) >= o.cargasMax) continue;
    if (!tocaRecargar(descansoDeRecarga(o.recarga), descanso)) continue;
    const t = tirar(o.recarga ?? '', rng);
    const fijo = /(\d+)\s*carga/i.exec(o.recarga ?? '');
    const falta = o.cargasMax - (o.cargas ?? 0);
    const n = Math.min(falta, t ? t.total : fijo ? Number(fijo[1]) : falta);
    if (n <= 0) continue;
    plan.objetos.push({ objetoId: o.id, n });
    plan.textos.push(`${o.nombre} +${n}${t ? ` (${t.expr})` : ''}`);
  }
  for (const p of e.personajes.filter((x) => ids.includes(x.id))) {
    for (const r of p.rasgos ?? []) {
      if (r.usosMax == null || (r.usos ?? r.usosMax) >= r.usosMax) continue;
      if (!tocaRecargar(descansoDeRecarga(r.recarga), descanso)) continue;
      plan.rasgos.push({ personajeId: p.id, nombre: r.nombre });
      plan.textos.push(`${primerNombre(p.nombre)}: ${r.nombre}`);
    }
  }
  return plan;
}

export function aplicarRecarga(e: Estado, plan: PlanRecarga): Estado {
  const porObjeto = new Map(plan.objetos.map((x) => [x.objetoId, x.n]));
  return {
    ...e,
    objetos: e.objetos.map((o) => (porObjeto.has(o.id) && o.cargasMax ? { ...o, cargas: Math.min(o.cargasMax, (o.cargas ?? 0) + porObjeto.get(o.id)!) } : o)),
    personajes: e.personajes.map((p) => {
      const suyos = plan.rasgos.filter((x) => x.personajeId === p.id).map((x) => x.nombre);
      if (!suyos.length) return p;
      return { ...p, rasgos: p.rasgos?.map((r) => (suyos.includes(r.nombre) ? { ...r, usos: r.usosMax } : r)) };
    }),
  };
}

/** Gasta (−1) o devuelve (+1) un uso de un rasgo. */
export function usarRasgo(e: Estado, personajeId: string, nombre: string, delta: number): Estado {
  return {
    ...e,
    personajes: e.personajes.map((p) => (p.id !== personajeId ? p : {
      ...p,
      rasgos: p.rasgos?.map((r) => (r.nombre !== nombre || r.usosMax == null ? r : { ...r, usos: Math.max(0, Math.min(r.usosMax, (r.usos ?? r.usosMax) + delta)) })),
    })),
  };
}

// ── Efectos temporales ─────────────────────────────────────────────

export const RONDA = 6;
export const MINUTO = 60;
export const HORA = 3600;

export function textoDuracion(d: Duracion): string {
  if (d.tipo === 'indefinida') return 'hasta quitarlo';
  if (d.tipo === 'descanso') return `hasta un descanso ${d.descanso}`;
  const s = Math.max(0, d.segundos);
  if (s < MINUTO) { const r = Math.ceil(s / RONDA); return `${r} ${r === 1 ? 'ronda' : 'rondas'}`; }
  if (s < HORA) { const m = Math.ceil(s / MINUTO); return `${m} min`; }
  const h = Math.floor(s / HORA), m = Math.ceil((s % HORA) / MINUTO);
  return m ? `${h} h ${m} min` : `${h} h`;
}

/**
 * Aplica un efecto a esos personajes. Si ya tienen uno con el mismo nombre, se renueva en lugar de
 * acumularse [5e: los efectos de un mismo conjuro no se suman]. La concentración nueva acaba con la anterior.
 */
export function aplicarEfecto(e: Estado, ids: string[], efecto: EfectoTemporal | PlantillaEfecto): Estado {
  return {
    ...e,
    personajes: e.personajes.map((p) => {
      if (!ids.includes(p.id)) return p;
      const nuevo: EfectoTemporal = { ...efecto, id: 'id' in efecto && ids.length === 1 ? efecto.id : nuevoId('ef') };
      const resto = (p.efectos ?? []).filter((x) => x.nombre !== nuevo.nombre);
      return { ...p, efectos: [...resto, nuevo] };
    }),
  };
}

export function quitarEfecto(e: Estado, personajeId: string, efectoId: string): Estado {
  return {
    ...e,
    personajes: e.personajes.map((p) => (p.id === personajeId ? { ...p, efectos: (p.efectos ?? []).filter((x) => x.id !== efectoId) } : p)),
  };
}

/** Pasa el tiempo para esos personajes: bajan las duraciones y se quitan las que acaban. Devuelve cuáles. */
export function pasarTiempo(e: Estado, ids: string[], segundos: number): { estado: Estado; terminados: string[] } {
  const terminados: string[] = [];
  const personajes = e.personajes.map((p) => {
    if (!ids.includes(p.id) || !p.efectos?.length) return p;
    const efectos = p.efectos.flatMap((ef) => {
      if (ef.duracion.tipo !== 'tiempo') return [ef];
      const quedan = ef.duracion.segundos - segundos;
      if (quedan <= 0) { terminados.push(`${ef.nombre} (${primerNombre(p.nombre)})`); return []; }
      return [{ ...ef, duracion: { tipo: 'tiempo' as const, segundos: quedan } }];
    });
    return { ...p, efectos };
  });
  return { estado: { ...e, personajes }, terminados };
}

/** Un descanso corto dura 1 hora; uno largo, 8. Además acaban los efectos «hasta un descanso». */
export function descansarEfectos(e: Estado, ids: string[], descanso: Descanso): { estado: Estado; terminados: string[] } {
  const r = pasarTiempo(e, ids, descanso === 'largo' ? 8 * HORA : HORA);
  const terminados = [...r.terminados];
  const personajes = r.estado.personajes.map((p) => {
    if (!ids.includes(p.id) || !p.efectos?.length) return p;
    const efectos = p.efectos.filter((ef) => {
      const acaba = ef.duracion.tipo === 'descanso' && (descanso === 'largo' || ef.duracion.descanso === 'corto');
      if (acaba) terminados.push(`${ef.nombre} (${primerNombre(p.nombre)})`);
      return !acaba;
    });
    return { ...p, efectos };
  });
  return { estado: { ...r.estado, personajes }, terminados };
}

// ── Efectos habituales para añadir con un clic ────────────────────

const min = (n: number): Duracion => ({ tipo: 'tiempo', segundos: n * MINUTO });
const horas = (n: number): Duracion => ({ tipo: 'tiempo', segundos: n * HORA });

/** [5e] Conjuros y pociones frecuentes. Los bonos con dados (Bendecir) van como nota. */
export const EFECTOS_COMUNES: PlantillaEfecto[] = [
  { nombre: 'Bendecir', duracion: min(1), concentracion: true, modificadores: [{ objetivo: 'nota', texto: '+1d4 a tiradas de ataque y salvaciones' }] },
  { nombre: 'Escudo de la fe', duracion: min(10), concentracion: true, modificadores: [{ objetivo: 'ca', valor: 2 }] },
  { nombre: 'Acelerar', duracion: min(1), concentracion: true, modificadores: [{ objetivo: 'ca', valor: 2 }, { objetivo: 'vel:caminar', valor: 30 }, { objetivo: 'ventaja', texto: 'salvaciones de Destreza' }, { objetivo: 'nota', texto: 'Una acción más por turno' }] },
  { nombre: 'Agrandar', duracion: min(1), concentracion: true, modificadores: [{ objetivo: 'ventaja', texto: 'pruebas y salvaciones de Fuerza' }, { objetivo: 'danoExtra', texto: '1d4' }] },
  { nombre: 'Ayuda', duracion: horas(8), modificadores: [{ objetivo: 'pvMax', valor: 5 }] },
  { nombre: 'Paso largo', duracion: horas(1), modificadores: [{ objetivo: 'vel:caminar', valor: 10 }] },
  { nombre: 'Visión en la oscuridad', duracion: horas(8), modificadores: [{ objetivo: 'sentido:oscuridad', valor: 18, fijar: true }] },
  { nombre: 'Fuerza de gigante de colina', duracion: horas(1), modificadores: [{ objetivo: 'car:fue', valor: 21, fijar: true }] },
  { nombre: 'Resistencia al fuego', duracion: horas(1), modificadores: [{ objetivo: 'resistencia', texto: 'fuego' }] },
  { nombre: 'Heroísmo', duracion: min(1), concentracion: true, modificadores: [{ objetivo: 'inmuneCondicion', texto: 'asustado' }, { objetivo: 'nota', texto: 'PV temporales igual al modificador de lanzamiento cada turno' }] },
];
