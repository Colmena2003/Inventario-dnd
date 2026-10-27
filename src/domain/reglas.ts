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

// ── Condiciones ────────────────────────────────────────────────────

/** [5e] Condiciones que perjudican; el resto se muestran como efectos favorables. */
export const CONDICION_MALA = /agotamiento|envenenad|asustad|cegad|aturdid|paralizad|derribad|apresad|incapacitad|petrificad|ensordecid|hechizad|inconsciente|restringid|maldit/i;

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

/** `posicion`: celda concreta del inventario donde se suelta (orden manual). */
export type Destino = { propietario: Propietario; equipar?: Equipado; posicion?: number };

export type Validacion =
  | { ok: true; pesoNuevo?: number; max?: number }
  | { ok: false; motivo: string; pesoNuevo?: number; max?: number };

export const mismoPropietario = (a: Propietario, b: Propietario) =>
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

export const apilables = (a: Objeto, b: Objeto) =>
  a.id !== b.id && a.nombre === b.nombre && a.rareza === b.rareza && a.icono === b.icono &&
  !a.equipadoEn && !b.equipadoEn && !a.sintonizado && !b.sintonizado;

let contador = 0;
export const nuevoId = (prefijo: string) => `${prefijo}-${Date.now().toString(36)}-${(contador++).toString(36)}`;

// ── Posiciones en el inventario ────────────────────────────────────

/**
 * Reparte los objetos en celdas: primero los que tienen posición, después el resto en los
 * primeros huecos. Devuelve al menos `minimo` celdas, en filas completas y con un hueco libre.
 */
export function colocar(objetos: Objeto[], minimo: number, porFila: number): (Objeto | undefined)[] {
  const fijos = new Map<number, Objeto>();
  const sueltos: Objeto[] = [];
  for (const o of objetos) {
    const p = o.posicion;
    if (p !== undefined && Number.isInteger(p) && p >= 0 && !fijos.has(p)) fijos.set(p, o);
    else sueltos.push(o);
  }
  const ultimo = Math.max(-1, ...fijos.keys());
  const necesarias = Math.max(ultimo + 1, objetos.length) + 1;
  const total = Math.max(minimo, Math.ceil(necesarias / porFila) * porFila);
  const celdas: (Objeto | undefined)[] = Array.from({ length: total }, (_, i) => fijos.get(i));
  let i = 0;
  for (const o of sueltos) {
    while (celdas[i]) i++;
    celdas[i] = o;
  }
  return celdas;
}

/** Da posición explícita a todo lo que lleva un dueño (sin equipar), conservando dónde se ve ahora. */
function fijarPosiciones(objetos: Objeto[], dueno: Propietario): Objeto[] {
  const celdas = colocar(objetos.filter((o) => esDe(o, dueno) && !o.equipadoEn), 0, 1);
  const pos = new Map<string, number>();
  celdas.forEach((o, i) => o && pos.set(o.id, i));
  return objetos.map((o) => (pos.has(o.id) ? { ...o, posicion: pos.get(o.id) } : o));
}

/**
 * Mueve `cantidad` unidades de un objeto. Si la pila se divide, la parte movida es un objeto nuevo.
 * Sin celda de destino, se junta con una pila igual del dueño nuevo. Con celda: si está libre va
 * ahí; si hay una pila igual se juntan; si hay otro objeto del mismo dueño se intercambian, y si no,
 * va al primer hueco. Si se equipa en una ranura ocupada, lo que había vuelve al inventario del
 * mismo personaje. Cambiar de dueño quita la sintonización.
 */
export function moverObjeto(e: Estado, objetoId: string, destino: Destino, actor: string, cantidad?: number): Estado {
  const v = validarMovimiento(e, objetoId, destino, cantidad);
  if (!v.ok) throw new Error(v.motivo);
  const o0 = e.objetos.find((x) => x.id === objetoId)!;
  const n = cantidad ?? o0.cantidad;
  const cambiaDueno = !mismoPropietario(o0.propietario, destino.propietario);
  const celda = destino.equipar ? undefined : destino.posicion;
  let objetos = e.objetos.slice();

  // Quita lo que ocupaba la ranura de destino
  if (destino.equipar && destino.propietario.tipo === 'personaje') {
    const ocupante = equipadoEn(e, destino.propietario.id, destino.equipar.ranura, destino.equipar.indice);
    if (ocupante && ocupante.id !== o0.id) {
      objetos = objetos.map((x) => (x.id === ocupante.id ? { ...x, equipadoEn: null, posicion: undefined } : x));
    }
  }

  if (celda !== undefined) objetos = fijarPosiciones(objetos, destino.propietario);
  const o = objetos.find((x) => x.id === objetoId)!;
  const ocupante = celda === undefined ? undefined
    : objetos.find((x) => x.id !== o.id && esDe(x, destino.propietario) && !x.equipadoEn && x.posicion === celda);
  const entera = n === o.cantidad;
  if (!cambiaDueno && !destino.equipar && !o.equipadoEn && (celda === undefined || (o.posicion === celda && entera))) return e;

  const movido: Objeto = {
    ...o,
    id: entera ? o.id : nuevoId('o'),
    cantidad: n,
    propietario: destino.propietario,
    equipadoEn: destino.equipar ?? null,
    sintonizado: cambiaDueno ? false : o.sintonizado && !!destino.equipar,
    posicion: celda,
  };

  objetos = entera
    ? objetos.filter((x) => x.id !== o.id)
    : objetos.map((x) => (x.id === o.id ? { ...x, cantidad: x.cantidad - n } : x));

  let pila: Objeto | undefined;
  if (!movido.equipadoEn) {
    if (celda !== undefined) pila = ocupante && apilables(ocupante, movido) ? ocupante : undefined;
    else if (cambiaDueno) pila = objetos.find((x) => esDe(x, destino.propietario) && apilables(x, movido));
  }
  if (pila) {
    objetos = objetos.map((x) => (x.id === pila!.id ? { ...x, cantidad: x.cantidad + n } : x));
  } else {
    if (ocupante) {
      // Dentro del mismo inventario, una pila entera intercambia el sitio con lo que había
      if (!cambiaDueno && !o.equipadoEn && entera) objetos = objetos.map((x) => (x.id === ocupante.id ? { ...x, posicion: o.posicion } : x));
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

// ── Orden automático ───────────────────────────────────────────────

export type CriterioOrden = 'rareza' | 'categoria' | 'valor' | 'peso' | 'nombre';

export const CRITERIOS_ORDEN: { id: CriterioOrden; texto: string }[] = [
  { id: 'rareza', texto: 'Rareza' },
  { id: 'categoria', texto: 'Tipo' },
  { id: 'valor', texto: 'Valor' },
  { id: 'peso', texto: 'Peso' },
  { id: 'nombre', texto: 'Nombre' },
];

const RAREZA_DESC: Rareza[] = ['artefacto', 'legendario', 'muy raro', 'raro', 'poco común', 'común'];
const ORDEN_CATEGORIA: Objeto['categoria'][] = ['Armas', 'Armaduras', 'Pociones', 'Pergaminos', 'Materiales', 'Comida', 'Llaves/misión', 'Varios'];

/** Ordena el inventario de un dueño (sin tocar el equipo) y junta de paso las pilas iguales. */
export function ordenarInventario(e: Estado, dueno: Propietario, criterio: CriterioOrden): Estado {
  const propios = e.objetos.filter((o) => esDe(o, dueno) && !o.equipadoEn);
  const juntos: Objeto[] = [];
  for (const o of propios) {
    const igual = juntos.find((x) => apilables(x, o));
    if (igual) igual.cantidad += o.cantidad;
    else juntos.push({ ...o });
  }
  const nombre = (a: Objeto, b: Objeto) => a.nombre.localeCompare(b.nombre, 'es');
  const rareza = (a: Objeto, b: Objeto) => RAREZA_DESC.indexOf(a.rareza) - RAREZA_DESC.indexOf(b.rareza);
  const por: Record<CriterioOrden, (a: Objeto, b: Objeto) => number> = {
    rareza: (a, b) => rareza(a, b) || nombre(a, b),
    categoria: (a, b) => ORDEN_CATEGORIA.indexOf(a.categoria) - ORDEN_CATEGORIA.indexOf(b.categoria) || rareza(a, b) || nombre(a, b),
    valor: (a, b) => b.valorPo * b.cantidad - a.valorPo * a.cantidad || nombre(a, b),
    peso: (a, b) => b.pesoKg * b.cantidad - a.pesoKg * a.cantidad || nombre(a, b),
    nombre,
  };
  juntos.sort(por[criterio]).forEach((o, i) => { o.posicion = i; });
  const quedan = new Set(juntos.map((o) => o.id));
  const nuevos = new Map(juntos.map((o) => [o.id, o]));
  return {
    ...e,
    objetos: e.objetos
      .filter((o) => !(esDe(o, dueno) && !o.equipadoEn) || quedan.has(o.id))
      .map((o) => nuevos.get(o.id) ?? o),
  };
}

// ── Estadísticas ───────────────────────────────────────────────────

export const RAREZAS: Rareza[] = ['común', 'poco común', 'raro', 'muy raro', 'legendario', 'artefacto'];

export type ResumenInventario = { valorPo: number; pesoKg: number; objetos: number; porRareza: Record<Rareza, number> };

/**
 * Agregados del inventario de un personaje, equipo incluido. `objetos` y `porRareza` cuentan pilas,
 * no unidades: 40 flechas son un objeto. El peso incluye las monedas, como la carga.
 */
export function resumenInventario(e: Estado, p: Personaje): ResumenInventario {
  const propios = objetosDe(e, { tipo: 'personaje', id: p.id });
  const porRareza = Object.fromEntries(RAREZAS.map((r) => [r, 0])) as Record<Rareza, number>;
  for (const o of propios) porRareza[o.rareza]++;
  return {
    valorPo: propios.reduce((s, o) => s + o.valorPo * o.cantidad, 0),
    pesoKg: pesoPersonajeKg(e, p),
    objetos: propios.length,
    porRareza,
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
