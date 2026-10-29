// Reglas de negocio (HANDOFF §6). Funciones puras: reciben el estado y devuelven uno nuevo.

import { caracteristica, modsPersonaje } from './efectos';
import type {
  Equipado, Estado, Monedas, Movimiento, Objeto, Personaje, Propietario, Rareza, TipoRanura,
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

/** Carga máxima con la FUE que dan los objetos (un Cinturón de fuerza de gigante) y sus bonos de carga. */
export function cargaMaxDe(e: Estado, p: Personaje) {
  const mods = modsPersonaje(e, p);
  const extra = mods.filter((m) => m.objetivo === 'carga' && !m.fijar).reduce((s, m) => s + (m.valor ?? 0), 0);
  return Math.max(0, cargaMaxKg(caracteristica(p, mods, 'fue').total) + extra);
}

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
  if (p > 2 / 3) return { id: 'sobrecargado', texto: 'Sobrecargado · −20 pies vel.', color: '#e0534d' };
  if (p > 1 / 3) return { id: 'cargado', texto: 'Cargado · −10 pies vel.', color: '#e0883a' };
  return { id: 'normal', texto: 'Carga normal', color: '#c9a65a' };
}

// ── Saciedad [casera] ──────────────────────────────────────────────
// Hambre de mazmorra, de 0 a 7. Baja 1 cada 30–90 min (lo decide el DM), 1 con un descanso corto y 4 con
// uno largo, que necesita empezar con al menos 4. Los efectos se acumulan al bajar.

export const SACIEDAD_MAX = 7;
export const SACIEDAD_DESCANSO_LARGO = 4;

export type EstadoSaciedad = {
  nivel: number;
  texto: string;
  color: string;
  /** El efecto más grave, para una sola línea. */
  efecto: string;
  efectos: string[];
  desvPruebas: boolean;
  velMitad: boolean;
  desvAtaquesSalv: boolean;
  pvMitad: boolean;
};

const NIVELES: { texto: string; color: string }[] = [
  { texto: 'Desfallecido', color: '#b8322d' },
  { texto: 'Famélico', color: '#e0534d' },
  { texto: 'Muy hambriento', color: '#e06a3a' },
  { texto: 'Hambriento', color: '#e0883a' },
  { texto: 'Satisfecho', color: '#c9a65a' },
  { texto: 'Saciado', color: '#a9c45a' },
  { texto: 'Saciado', color: '#9cc95e' },
  { texto: 'Lleno', color: '#9cc95e' },
];

export const EFECTOS_HAMBRE: [number, string][] = [
  [3, 'Desventaja en pruebas de característica'],
  [2, 'Velocidad a la mitad'],
  [1, 'Desventaja en tiradas de ataque y salvaciones'],
  [0, 'PV máximos a la mitad'],
];

export function estadoSaciedad(v: number): EstadoSaciedad {
  const nivel = Math.max(0, Math.min(SACIEDAD_MAX, Math.round(v)));
  const efectos = EFECTOS_HAMBRE.filter(([n]) => nivel <= n).map(([, t]) => t);
  return {
    nivel, ...NIVELES[nivel],
    efecto: efectos[efectos.length - 1] ?? 'Sin efectos',
    efectos,
    desvPruebas: nivel <= 3, velMitad: nivel <= 2, desvAtaquesSalv: nivel <= 1, pvMitad: nivel <= 0,
  };
}

export type ResultadoComer = { ok: true; estado: Estado; antes: number; despues: number } | { ok: false; motivo: string };

/** Comer gasta 1 unidad y suma su saciedad hasta el máximo. */
export function comer(e: Estado, personajeId: string, objetoId: string): ResultadoComer {
  const p = e.personajes.find((x) => x.id === personajeId);
  const o = e.objetos.find((x) => x.id === objetoId);
  if (!p) return { ok: false, motivo: 'El personaje ya no existe' };
  if (!o || o.cantidad < 1) return { ok: false, motivo: 'Esa comida ya no está' };
  if (o.categoria !== 'Comida') return { ok: false, motivo: `${o.nombre} no se come` };
  if (!o.saciedad) return { ok: false, motivo: `${o.nombre} no se come sola: es un ingrediente` };
  if (p.saciedad >= SACIEDAD_MAX) return { ok: false, motivo: `${p.nombre.split(' ')[0]} ya está lleno` };
  const despues = Math.min(SACIEDAD_MAX, p.saciedad + o.saciedad);
  const objetos = o.cantidad > 1
    ? e.objetos.map((x) => (x.id === o.id ? { ...x, cantidad: x.cantidad - 1 } : x))
    : e.objetos.filter((x) => x.id !== o.id);
  return {
    ok: true, antes: p.saciedad, despues,
    estado: { ...e, objetos, personajes: e.personajes.map((x) => (x.id === p.id ? { ...x, saciedad: despues } : x)) },
  };
}

export function cambiarSaciedad(e: Estado, ids: string[], delta: number): Estado {
  const fijar = (v: number) => Math.max(0, Math.min(SACIEDAD_MAX, v + delta));
  return { ...e, personajes: e.personajes.map((p) => (ids.includes(p.id) ? { ...p, saciedad: fijar(p.saciedad) } : p)) };
}

/** Descanso corto: −1. Largo: −4, solo para quien empieza con 4 o más; el resto queda en `bloqueados`. */
export function descansar(e: Estado, ids: string[], tipo: 'corto' | 'largo'): { estado: Estado; hechos: string[]; bloqueados: string[] } {
  const bloqueados = tipo === 'largo'
    ? ids.filter((id) => (e.personajes.find((p) => p.id === id)?.saciedad ?? 0) < SACIEDAD_DESCANSO_LARGO)
    : [];
  const hechos = ids.filter((id) => !bloqueados.includes(id));
  return { estado: cambiarSaciedad(e, hechos, tipo === 'largo' ? -SACIEDAD_DESCANSO_LARGO : -1), hechos, bloqueados };
}

/** De la escala antigua de 0 a 100 a la de 0 a 7. */
export const saciedadDesde100 = (v: number) => Math.max(0, Math.min(SACIEDAD_MAX, Math.round((v / 100) * SACIEDAD_MAX)));

// ── Monedas [5e] ───────────────────────────────────────────────────

export const totalEnPo = (m: Monedas) => m.ppt * 10 + m.po + m.pe / 2 + m.pp / 10 + m.pc / 100;

// ── Equipo ─────────────────────────────────────────────────────────

/** Cuántas ranuras de cada tipo tiene un personaje. */
export const RANURAS: Record<TipoRanura, number> = {
  cabeza: 1, capa: 1, armadura: 1, guantes: 1, botas: 1, amuleto: 1, anillo: 2, cuerpoACuerpo: 2, distancia: 2,
};

export const NOMBRE_RANURA: Record<TipoRanura, string> = {
  cabeza: 'Cabeza', capa: 'Capa', armadura: 'Armadura', guantes: 'Guantes', botas: 'Botas',
  amuleto: 'Amuleto', anillo: 'Anillo', cuerpoACuerpo: 'Cuerpo a cuerpo', distancia: 'A distancia',
};

/** [5e] Las armas a dos manos solo van en la mano principal y dejan libre la secundaria. */
export const aDosManos = (o: Objeto | undefined) => !!o?.propiedades?.includes('dosManos');
const esPar = (r: TipoRanura) => r === 'cuerpoACuerpo' || r === 'distancia';

export const equipadoEn = (e: Estado, personajeId: string, ranura: TipoRanura, indice: number) =>
  e.objetos.find(
    (o) => o.propietario.tipo === 'personaje' && o.propietario.id === personajeId &&
      o.equipadoEn?.ranura === ranura && o.equipadoEn.indice === indice,
  );

export const MAX_SINTONIZADOS = 3;

export const sintonizadosDe = (e: Estado, personajeId: string) =>
  e.objetos.filter((o) => o.sintonizado && o.propietario.tipo === 'personaje' && o.propietario.id === personajeId);

export type ResultadoSintonia =
  | { ok: true; estado: Estado }
  | { ok: false; motivo: string; lleno?: Objeto[] };

/**
 * [5e] Un personaje puede estar sintonizado con 3 objetos como máximo. Si ya tiene 3, hay que
 * indicar cuál deja (`sustituir`); si no, se devuelve la lista para que la interfaz pregunte.
 * Con el objeto ya sintonizado, lo desintoniza.
 */
export function alternarSintonia(e: Estado, objetoId: string, sustituir?: string): ResultadoSintonia {
  const o = e.objetos.find((x) => x.id === objetoId);
  if (!o) return { ok: false, motivo: 'El objeto ya no existe' };
  if (!o.requiereSintonizacion) return { ok: false, motivo: `${o.nombre} no requiere sintonización` };
  if (o.propietario.tipo !== 'personaje') return { ok: false, motivo: 'Solo un personaje puede sintonizarse con un objeto' };
  const fijar = (id: string, v: boolean) => (x: Objeto) => (x.id === id ? { ...x, sintonizado: v } : x);
  if (o.sintonizado) return { ok: true, estado: { ...e, objetos: e.objetos.map(fijar(o.id, false)) } };

  const actuales = sintonizadosDe(e, o.propietario.id);
  if (actuales.length >= MAX_SINTONIZADOS) {
    const quitar = actuales.find((x) => x.id === sustituir);
    if (!quitar) return { ok: false, motivo: 'Límite de sintonización alcanzado', lleno: actuales };
    return { ok: true, estado: { ...e, objetos: e.objetos.map(fijar(quitar.id, false)).map(fijar(o.id, true)) } };
  }
  return { ok: true, estado: { ...e, objetos: e.objetos.map(fijar(o.id, true)) } };
}

// ── Experiencia [5e] ───────────────────────────────────────────────

const PX_NIVEL = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

/** PX necesarios para el siguiente nivel (null en el 20). */
export const pxSiguienteNivel = (nivel: number) => (nivel >= 20 ? null : PX_NIVEL[nivel]);
export const pxNivelActual = (nivel: number) => PX_NIVEL[Math.max(1, Math.min(20, nivel)) - 1];

// ── Mover objetos ──────────────────────────────────────────────────

/** Adónde va un objeto. `posicion` es la celda de la rejilla del dueño en la que se suelta. */
export type Destino = { propietario: Propietario; equipar?: Equipado; posicion?: number };

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
    const { ranura, indice } = destino.equipar;
    if (esPar(ranura) && indice === 1) {
      if (aDosManos(o)) return { ok: false, motivo: `${o.nombre} es a dos manos: va en la mano principal` };
      const principal = equipadoEn(e, destino.propietario.id, ranura, 0);
      if (principal && principal.id !== o.id && aDosManos(principal)) {
        return { ok: false, motivo: `${principal.nombre} ocupa las dos manos` };
      }
    }
  }

  if (destino.propietario.tipo === 'personaje') {
    const pid = destino.propietario.id;
    const p = e.personajes.find((x) => x.id === pid);
    if (!p) return { ok: false, motivo: 'El personaje ya no existe' };
    const max = cargaMaxDe(e, p);
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

// ── Rejilla ────────────────────────────────────────────────────────

/**
 * Coloca los objetos en las celdas de una rejilla: cada uno en su `posicion` si la tiene y está libre, y
 * el resto en los primeros huecos. Siempre queda al menos una celda libre al final y filas completas.
 */
export function rejilla<T extends { posicion?: number }>(lista: T[], minimo: number, porFila: number): (T | undefined)[] {
  const fijos = new Map<number, T>();
  const sueltos: T[] = [];
  for (const o of lista) {
    const p = o.posicion;
    if (p !== undefined && Number.isInteger(p) && p >= 0 && !fijos.has(p)) fijos.set(p, o);
    else sueltos.push(o);
  }
  const necesarias = Math.max(Math.max(-1, ...fijos.keys()) + 1, lista.length) + 1;
  const celdas: (T | undefined)[] = Array.from({ length: Math.max(minimo, Math.ceil(necesarias / porFila) * porFila) }, (_, i) => fijos.get(i));
  let i = 0;
  for (const o of sueltos) {
    while (celdas[i]) i++;
    celdas[i] = o;
  }
  return celdas;
}

/** Fija la posición actual de todo lo que tiene un dueño en la mano, para poder mover uno sin descolocar al resto. */
function fijarPosiciones(objetos: Objeto[], p: Propietario): Objeto[] {
  const donde = new Map<string, number>();
  rejilla(objetos.filter((o) => esDe(o, p) && !o.equipadoEn), 0, 1).forEach((o, i) => o && donde.set(o.id, i));
  return objetos.map((o) => (donde.has(o.id) ? { ...o, posicion: donde.get(o.id) } : o));
}

/**
 * Mueve `cantidad` unidades de un objeto. Si la pila se divide, la parte movida es un objeto nuevo.
 * Sin `posicion`, al llegar se junta con una pila igual del destino o va al primer hueco. Con `posicion`
 * va a esa celda: se junta con lo que haya si es igual, se intercambia si lo mueve su dueño entero, y si
 * no, busca hueco. Si se equipa en una ranura ocupada, lo que había vuelve al inventario del mismo
 * personaje. Cambiar de dueño quita la sintonización.
 */
export function moverObjeto(e: Estado, objetoId: string, destino: Destino, actor: string, cantidad?: number): Estado {
  const v = validarMovimiento(e, objetoId, destino, cantidad);
  if (!v.ok) throw new Error(v.motivo);
  const o = e.objetos.find((x) => x.id === objetoId)!;
  const n = cantidad ?? o.cantidad;
  const cambiaDueno = !mismoPropietario(o.propietario, destino.propietario);
  const pos = destino.equipar ? undefined : destino.posicion;
  let objetos = e.objetos.slice();

  // Quita lo que ocupaba la ranura de destino
  if (destino.equipar && destino.propietario.tipo === 'personaje') {
    const ocupante = equipadoEn(e, destino.propietario.id, destino.equipar.ranura, destino.equipar.indice);
    if (ocupante && ocupante.id !== o.id) {
      objetos = objetos.map((x) => (x.id === ocupante.id ? { ...x, equipadoEn: null, posicion: undefined } : x));
    }
    // Un arma a dos manos libera la mano secundaria
    const { ranura, indice } = destino.equipar;
    const secundaria = esPar(ranura) && indice === 0 && aDosManos(o) ? equipadoEn(e, destino.propietario.id, ranura, 1) : undefined;
    if (secundaria && secundaria.id !== o.id) {
      objetos = objetos.map((x) => (x.id === secundaria.id ? { ...x, equipadoEn: null, posicion: undefined } : x));
    }
  }

  if (pos !== undefined) objetos = fijarPosiciones(objetos, destino.propietario);
  const d = objetos.find((x) => x.id === objetoId)!;
  const ocupante = pos === undefined ? undefined : objetos.find((x) => x.id !== d.id && esDe(x, destino.propietario) && !x.equipadoEn && x.posicion === pos);
  const entera = n === d.cantidad;
  // Soltarlo donde ya estaba no cambia nada
  if (!cambiaDueno && !destino.equipar && !d.equipadoEn && (pos === undefined || (d.posicion === pos && entera))) return e;

  const movido: Objeto = {
    ...d,
    id: entera ? d.id : nuevoId('o'),
    cantidad: n,
    propietario: destino.propietario,
    equipadoEn: destino.equipar ?? null,
    sintonizado: cambiaDueno ? false : d.sintonizado && !!destino.equipar,
    posicion: pos,
  };

  objetos = entera
    ? objetos.filter((x) => x.id !== d.id)
    : objetos.map((x) => (x.id === d.id ? { ...x, cantidad: x.cantidad - n } : x));

  let pila: Objeto | undefined;
  if (!movido.equipadoEn) {
    pila = pos !== undefined
      ? (ocupante && apilables(ocupante, movido) ? ocupante : undefined)
      : objetos.find((x) => esDe(x, destino.propietario) && apilables(x, movido));
  }
  if (pila) {
    objetos = objetos.map((x) => (x.id === pila!.id ? { ...x, cantidad: x.cantidad + n } : x));
  } else {
    if (ocupante) {
      // Se cambian de sitio si su dueño mueve la pila entera; si no, lo nuevo busca hueco
      if (!cambiaDueno && !d.equipadoEn && entera) objetos = objetos.map((x) => (x.id === ocupante.id ? { ...x, posicion: d.posicion } : x));
      else movido.posicion = undefined;
    }
    objetos = [...objetos, movido];
  }

  const movimientos = cambiaDueno
    ? [{
        id: nuevoId('m'), objetoId: pila?.id ?? movido.id, objetoNombre: o.nombre, rareza: o.rareza, icono: o.icono,
        cantidad: n, origen: o.propietario, destino: destino.propietario, actor, fecha: Date.now(),
      } satisfies Movimiento, ...e.movimientos].slice(0, 200)
    : e.movimientos;

  return { ...e, objetos, movimientos };
}

export type OrdenInventario = 'rareza' | 'categoria' | 'valor' | 'peso' | 'nombre';

export const ORDENES: { id: OrdenInventario; texto: string }[] = [
  { id: 'rareza', texto: 'Rareza' }, { id: 'categoria', texto: 'Tipo' }, { id: 'valor', texto: 'Valor' }, { id: 'peso', texto: 'Peso' }, { id: 'nombre', texto: 'Nombre' },
];

const ORDEN_RAREZA: Rareza[] = ['artefacto', 'legendario', 'muy raro', 'raro', 'poco común', 'común'];
const ORDEN_CATEGORIA = ['Armas', 'Armaduras', 'Pociones', 'Pergaminos', 'Materiales', 'Comida', 'Llaves/misión', 'Varios'];

/** Junta las pilas iguales del inventario (lo no equipado) de un dueño y las coloca en orden desde la primera celda. */
export function ordenarInventario(e: Estado, p: Propietario, orden: OrdenInventario): Estado {
  const pilas: Objeto[] = [];
  for (const o of e.objetos.filter((x) => esDe(x, p) && !x.equipadoEn)) {
    const igual = pilas.find((x) => apilables(x, o));
    if (igual) igual.cantidad += o.cantidad;
    else pilas.push({ ...o });
  }
  const nombre = (a: Objeto, b: Objeto) => a.nombre.localeCompare(b.nombre, 'es');
  const rareza = (a: Objeto, b: Objeto) => ORDEN_RAREZA.indexOf(a.rareza) - ORDEN_RAREZA.indexOf(b.rareza);
  const por: Record<OrdenInventario, (a: Objeto, b: Objeto) => number> = {
    rareza: (a, b) => rareza(a, b) || nombre(a, b),
    categoria: (a, b) => ORDEN_CATEGORIA.indexOf(a.categoria) - ORDEN_CATEGORIA.indexOf(b.categoria) || rareza(a, b) || nombre(a, b),
    valor: (a, b) => b.valorPo * b.cantidad - a.valorPo * a.cantidad || nombre(a, b),
    peso: (a, b) => b.pesoKg * b.cantidad - a.pesoKg * a.cantidad || nombre(a, b),
    nombre,
  };
  pilas.sort(por[orden]).forEach((o, i) => { o.posicion = i; });
  const quedan = new Map(pilas.map((o) => [o.id, o]));
  return {
    ...e,
    objetos: e.objetos.filter((o) => !(esDe(o, p) && !o.equipadoEn) || quedan.has(o.id)).map((o) => quedan.get(o.id) ?? o),
  };
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
