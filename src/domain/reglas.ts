// Reglas de negocio (HANDOFF §6). Funciones puras: reciben el estado y devuelven uno nuevo.

import type {
  Caracteristica, Equipado, Estado, Monedas, Movimiento, Objeto, Personaje, Propietario, Rareza, TipoRanura,
} from './tipos';

// ── Características ────────────────────────────────────────────────

/** [5e] floor((valor − 10) / 2) */
export const modificador = (valor: number) => Math.floor((valor - 10) / 2);

export const conSigno = (n: number) => (n >= 0 ? '+' : '−') + Math.abs(n);

export const nivelTotal = (p: Personaje) => p.clases.reduce((s, c) => s + c.nivel, 0);

/** [5e] +2 en niveles 1–4, +3 en 5–8, etc. */
export const bonoCompetencia = (nivel: number) => 2 + Math.floor((Math.max(1, nivel) - 1) / 4);

// ── Carga ──────────────────────────────────────────────────────────

/** [casera] FUE × 15 lb ≈ FUE × 6,8 kg, redondeado al kilo. */
export const cargaMaxKg = (fue: number) => Math.round(fue * 6.8);

/** [5e] 50 monedas por libra (≈ 0,45 kg). [casera] Las monedas cuentan para la carga. */
export const pesoMonedasKg = (m: Monedas) => ((m.ppt + m.po + m.pe + m.pp + m.pc) / 50) * 0.45;

export const pesoObjeto = (o: Objeto, cantidad = o.cantidad) => o.pesoKg * cantidad;

const esDe = (o: Objeto, p: Propietario) =>
  p.tipo === 'alijo' ? o.propietario.tipo === 'alijo' : o.propietario.tipo === 'personaje' && o.propietario.id === p.id;

export const objetosDe = (e: Estado, p: Propietario) => e.objetos.filter((o) => esDe(o, p));

export const pesoPersonajeKg = (e: Estado, p: Personaje) =>
  objetosDe(e, { tipo: 'personaje', id: p.id }).reduce((s, o) => s + pesoObjeto(o), 0) + pesoMonedasKg(p.monedas);

export const pesoAlijoKg = (e: Estado) => objetosDe(e, { tipo: 'alijo' }).reduce((s, o) => s + pesoObjeto(o), 0);

export type TramoCarga = { id: 'normal' | 'cargado' | 'sobrecargado'; texto: string; color: string };

/** [5e, regla variante] más de ⅓ del máximo es Cargado; más de ⅔, Sobrecargado. */
export function tramoCarga(peso: number, max: number): TramoCarga {
  const p = max > 0 ? peso / max : 1;
  if (p > 2 / 3) return { id: 'sobrecargado', texto: 'Sobrecargado · −6 m vel.', color: '#e0534d' };
  if (p > 1 / 3) return { id: 'cargado', texto: 'Cargado · −3 m vel.', color: '#e0883a' };
  return { id: 'normal', texto: 'Carga normal', color: '#c9a65a' };
}

// ── Saciedad [casera] ──────────────────────────────────────────────

export type EstadoSaciedad = { texto: string; color: string; efecto: string };

export function estadoSaciedad(v: number): EstadoSaciedad {
  if (v >= 75) return { texto: 'Saciado', color: '#9cc95e', efecto: 'Ventaja en salvaciones contra agotamiento' };
  if (v >= 40) return { texto: 'Normal', color: '#c9a65a', efecto: 'Sin efectos' };
  if (v >= 15) return { texto: 'Hambriento', color: '#e0883a', efecto: 'No recupera dados de golpe en descanso corto' };
  return { texto: 'Famélico', color: '#e0534d', efecto: '+1 nivel de agotamiento al día' };
}

// ── Monedas [5e] ───────────────────────────────────────────────────

export const totalEnPo = (m: Monedas) => m.ppt * 10 + m.po + m.pe / 2 + m.pp / 10 + m.pc / 100;

// ── Combate ────────────────────────────────────────────────────────

export type Ataque = { bono: number; dano: string; tipo?: string };

/**
 * Bono de ataque y daño de un arma equipada. Supone competencia con el arma.
 * Cuerpo a cuerpo usa FUE; a distancia, DES; las arrojadizas usan FUE y las sutiles la mejor de FUE y DES.
 */
export function ataque(p: Personaje, arma: Objeto | undefined, ranura: 'cuerpoACuerpo' | 'distancia'): Ataque | null {
  if (!arma || !arma.dado) return null;
  const props = (arma.propiedades ?? []).map((x) => x.toLowerCase());
  let car: Caracteristica = ranura === 'distancia' ? 'des' : 'fue';
  if (ranura === 'distancia' && props.some((x) => x.startsWith('arrojadiza'))) car = 'fue';
  if (props.some((x) => x.startsWith('sutil'))) car = p.fue >= p.des ? 'fue' : 'des';
  const mod = modificador(p[car]);
  const magia = arma.bonoMagico ?? 0;
  const extra = mod + magia;
  return {
    bono: mod + bonoCompetencia(nivelTotal(p)) + magia,
    dano: arma.dado + (extra === 0 ? '' : (extra > 0 ? '+' : '−') + Math.abs(extra)),
    tipo: arma.tipoDano,
  };
}

// ── Equipo ─────────────────────────────────────────────────────────

/** Cuántas ranuras de cada tipo tiene un personaje. */
export const RANURAS: Record<TipoRanura, number> = {
  cabeza: 1, capa: 1, armadura: 1, guantes: 1, botas: 1, amuleto: 1, anillo: 2, cuerpoACuerpo: 2, distancia: 2,
};

export const NOMBRE_RANURA: Record<TipoRanura, string> = {
  cabeza: 'Cabeza', capa: 'Capa', armadura: 'Armadura', guantes: 'Guantes', botas: 'Botas',
  amuleto: 'Amuleto', anillo: 'Anillo', cuerpoACuerpo: 'Cuerpo a cuerpo', distancia: 'A distancia',
};

export const equipadoEn = (e: Estado, personajeId: string, ranura: TipoRanura, indice: number) =>
  e.objetos.find(
    (o) => o.propietario.tipo === 'personaje' && o.propietario.id === personajeId &&
      o.equipadoEn?.ranura === ranura && o.equipadoEn.indice === indice,
  );

export const MAX_SINTONIZADOS = 3;

export const sintonizadosDe = (e: Estado, personajeId: string) =>
  e.objetos.filter((o) => o.sintonizado && o.propietario.tipo === 'personaje' && o.propietario.id === personajeId);

// ── Mover objetos ──────────────────────────────────────────────────

export type Destino = { propietario: Propietario; equipar?: Equipado };

export type Validacion =
  | { ok: true; pesoNuevo?: number; max?: number }
  | { ok: false; motivo: string; pesoNuevo?: number; max?: number };

const mismoPropietario = (a: Propietario, b: Propietario) =>
  a.tipo === b.tipo && (a.tipo === 'alijo' || (b.tipo === 'personaje' && a.id === b.id));

// En es-ES Intl no agrupa los números de 4 cifras por defecto; el diseño escribe «2.400» y «1.248».
const formato = (decimales: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: decimales, maximumFractionDigits: decimales, useGrouping: 'always' } as unknown as Intl.NumberFormatOptions);
const fmtKg = (n: number) => formato(1).format(n);
const fmtNum = (n: number) => formato(Number.isInteger(n) ? 0 : 2).format(n);

export function validarMovimiento(e: Estado, objetoId: string, destino: Destino, cantidad?: number): Validacion {
  const o = e.objetos.find((x) => x.id === objetoId);
  if (!o) return { ok: false, motivo: 'El objeto ya no existe' };
  const n = cantidad ?? o.cantidad;
  if (n < 1 || n > o.cantidad) return { ok: false, motivo: 'Cantidad no válida' };

  if (destino.equipar) {
    if (destino.propietario.tipo !== 'personaje') return { ok: false, motivo: 'El alijo no tiene equipo' };
    if (o.ranuraEquipo !== destino.equipar.ranura) {
      return { ok: false, motivo: `No se puede equipar en ${NOMBRE_RANURA[destino.equipar.ranura].toLowerCase()}` };
    }
  }

  if (destino.propietario.tipo === 'personaje') {
    const pid = destino.propietario.id;
    const p = e.personajes.find((x) => x.id === pid);
    if (!p) return { ok: false, motivo: 'El personaje ya no existe' };
    const max = cargaMaxKg(p.fue);
    const actual = pesoPersonajeKg(e, p);
    const anade = mismoPropietario(o.propietario, destino.propietario) ? 0 : pesoObjeto(o, n);
    const pesoNuevo = actual + anade;
    if (pesoNuevo > max + 1e-9) {
      return { ok: false, motivo: `Sobrepeso: ${fmtKg(pesoNuevo)} kg supera su máximo de ${max} kg`, pesoNuevo, max };
    }
    return { ok: true, pesoNuevo, max };
  }
  return { ok: true };
}

const apilables = (a: Objeto, b: Objeto) =>
  a.id !== b.id && a.nombre === b.nombre && a.rareza === b.rareza && a.icono === b.icono &&
  !a.equipadoEn && !b.equipadoEn && !a.sintonizado && !b.sintonizado;

let contador = 0;
export const nuevoId = (prefijo: string) => `${prefijo}-${Date.now().toString(36)}-${(contador++).toString(36)}`;

/**
 * Mueve `cantidad` unidades de un objeto. Si la pila se divide, la parte movida es un objeto nuevo.
 * Al llegar, se junta con una pila igual del destino. Si se equipa en una ranura ocupada,
 * lo que había vuelve al inventario del mismo personaje. Cambiar de dueño quita la sintonización.
 */
export function moverObjeto(e: Estado, objetoId: string, destino: Destino, actor: string, cantidad?: number): Estado {
  const v = validarMovimiento(e, objetoId, destino, cantidad);
  if (!v.ok) throw new Error(v.motivo);
  const o = e.objetos.find((x) => x.id === objetoId)!;
  const n = cantidad ?? o.cantidad;
  const cambiaDueno = !mismoPropietario(o.propietario, destino.propietario);
  let objetos = e.objetos.slice();

  // Quita lo que ocupaba la ranura de destino
  if (destino.equipar && destino.propietario.tipo === 'personaje') {
    const ocupante = equipadoEn(e, destino.propietario.id, destino.equipar.ranura, destino.equipar.indice);
    if (ocupante && ocupante.id !== o.id) {
      objetos = objetos.map((x) => (x.id === ocupante.id ? { ...x, equipadoEn: null } : x));
    }
  }

  const movido: Objeto = {
    ...o,
    id: n < o.cantidad ? nuevoId('o') : o.id,
    cantidad: n,
    propietario: destino.propietario,
    equipadoEn: destino.equipar ?? null,
    sintonizado: cambiaDueno ? false : o.sintonizado && !!destino.equipar,
  };

  objetos = n < o.cantidad
    ? objetos.map((x) => (x.id === o.id ? { ...x, cantidad: x.cantidad - n } : x))
    : objetos.filter((x) => x.id !== o.id);

  const pila = movido.equipadoEn ? undefined : objetos.find((x) => esDe(x, destino.propietario) && apilables(x, movido));
  objetos = pila
    ? objetos.map((x) => (x.id === pila.id ? { ...x, cantidad: x.cantidad + n } : x))
    : [...objetos, movido];

  const movimientos = cambiaDueno
    ? [{
        id: nuevoId('m'), objetoId: pila?.id ?? movido.id, objetoNombre: o.nombre, rareza: o.rareza, icono: o.icono,
        cantidad: n, origen: o.propietario, destino: destino.propietario, actor, fecha: Date.now(),
      } satisfies Movimiento, ...e.movimientos].slice(0, 200)
    : e.movimientos;

  return { ...e, objetos, movimientos };
}

// ── Presentación ───────────────────────────────────────────────────

export const CLASE_RAREZA: Record<Rareza, string> = {
  'común': 'r-c', 'poco común': 'r-u', 'raro': 'r-r', 'muy raro': 'r-m', 'legendario': 'r-l', 'artefacto': 'r-a',
};

export const COLOR_RAREZA: Record<Rareza, string> = {
  'común': '#cfc8ba', 'poco común': '#5fcf6d', 'raro': '#55a3ff', 'muy raro': '#b874ff', 'legendario': '#f5a93c', 'artefacto': '#ec4652',
};

export const nombreDe = (e: Estado, p: Propietario) =>
  p.tipo === 'alijo' ? 'Alijo de la party' : e.personajes.find((x) => x.id === p.id)?.nombre ?? '¿?';

export { fmtKg, fmtNum };
