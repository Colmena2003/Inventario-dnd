// Hoja derivada: las estadísticas del personaje con todo lo que le cambian sus objetos activos, su hambre
// y su carga. Cada número lleva el desglose de dónde sale para enseñarlo en la interfaz.

import { ABREV_CAR, datosClase, DES_MAX_POR_TIPO, HABILIDADES, NOMBRE_TIPO_ARMADURA, PROPIEDADES, RAZA_LENTA, RAZA_PEQUENA } from './catalogo';
import {
  activosDe, aplicar, caracteristica, marcar, modsDe, modsEfectos, sumar, valor, type Fuente, type ModActivo, type Valor,
} from './efectos';
import {
  bonoCompetencia, cargaMaxDe, conSigno, equipadoEn, estadoSaciedad, modificador, nivelTotal, pesoPersonajeKg, tramoCarga,
  type EstadoSaciedad, type TramoCarga,
} from './reglas';
import type {
  Caracteristica, DanoExtra, Estado, Habilidad, Movimiento5e, Objeto, ObjetivoMod, Personaje, Tamano,
} from './tipos';

export type { Fuente, Valor };
export type Efecto = { texto: string; origen: string };

const CARS: Caracteristica[] = ['fue', 'des', 'con', 'int', 'sab', 'car'];
const FISICAS: Caracteristica[] = ['fue', 'des', 'con'];
const MOVS: Movimiento5e[] = ['caminar', 'volar', 'nadar', 'trepar', 'excavar'];
const RAZA_OSCURIDAD = /elf|enan|gnom|semiorc|tiefling|drow|duergar/i;

export interface AtaqueArma {
  objeto: Objeto;
  ranura: 'cuerpoACuerpo' | 'distancia';
  indice: number;
  car: Caracteristica;
  bono: Valor;
  dado: string;
  danoMod: Valor;
  /** «1d8+5» */
  dano: string;
  tipo?: string;
  extras: (DanoExtra & { origen: string })[];
  critico: number;
  notas: string[];
  /** false si es la mano secundaria sin dos armas ligeras. */
  valido: boolean;
}

export interface Hoja {
  p: Personaje;
  nivel: number;
  tamano: Tamano;
  activos: Objeto[];
  mods: ModActivo[];
  car: Record<Caracteristica, Valor>;
  mod: Record<Caracteristica, number>;
  competencia: Valor;
  ca: Valor;
  /** Armadura que da la CA base, si la hay. */
  armadura?: Objeto;
  iniciativa: Valor;
  velocidad: Record<Movimiento5e, Valor>;
  pvMax: Valor;
  pvActual: number;
  salvaciones: Record<Caracteristica, Valor & { competente: boolean }>;
  habilidades: Record<Habilidad, Valor & { competente: boolean; pericia: boolean; car: Caracteristica }>;
  pasivas: Record<'percepcion' | 'investigacion' | 'perspicacia', Valor>;
  conjuros: { car: Caracteristica; cd: Valor; ataque: Valor } | null;
  cargaMax: number;
  carga: number;
  tramo: TramoCarga;
  sentidos: { nombre: string; metros: number; origen: string }[];
  resistencias: Efecto[];
  inmunidades: Efecto[];
  vulnerabilidades: Efecto[];
  inmuneCondiciones: Efecto[];
  ventajas: Efecto[];
  desventajas: Efecto[];
  notas: Efecto[];
  ataques: AtaqueArma[];
  saciedad: EstadoSaciedad;
  avisos: string[];
}

const textos = (mods: ModActivo[], objetivo: ObjetivoMod): Efecto[] =>
  mods.filter((m) => m.objetivo === objetivo && m.texto?.trim()).map((m) => ({ texto: m.texto!.trim(), origen: m.origen }));

/** Sin duplicados por texto (sin mayúsculas ni tildes). */
function unicos(xs: Efecto[]): Efecto[] {
  const norm = (s: string) => s.toLocaleLowerCase('es').normalize('NFD').replace(/\p{M}/gu, '');
  const vistos = new Set<string>();
  return xs.filter((x) => (vistos.has(norm(x.texto)) ? false : (vistos.add(norm(x.texto)), true)));
}

/** Los bonos mágicos de un objeto que requiere sintonización solo funcionan sintonizado. */
const magiaActiva = (o: Objeto) => !o.requiereSintonizacion || !!o.sintonizado;

export function hoja(e: Estado, p: Personaje): Hoja {
  const nivel = nivelTotal(p);
  const activos = activosDe(e, p.id);
  const mods = [...modsDe(activos), ...modsEfectos(p)];
  const clase = datosClase(p.clases[0]?.clase ?? '');
  const tamano: Tamano = p.tamano ?? (RAZA_PEQUENA.test(p.raza) ? 'pequeño' : 'mediano');
  const sac = estadoSaciedad(p.saciedad);
  const avisos: string[] = [];

  // Características y competencia
  const car = Object.fromEntries(CARS.map((k) => [k, caracteristica(p, mods, k)])) as Record<Caracteristica, Valor>;
  const mod = Object.fromEntries(CARS.map((k) => [k, modificador(car[k].total)])) as Record<Caracteristica, number>;
  const competencia = aplicar(valor(bonoCompetencia(nivel), `Nivel ${nivel}`), mods, ['competencia']);
  const prof = competencia.total;

  // Carga (regla variante): Cargado −10 pies; Sobrecargado −20 pies y desventaja en lo físico
  const cargaMax = cargaMaxDe(e, p);
  const carga = pesoPersonajeKg(e, p);
  const tramo = tramoCarga(carga, cargaMax);
  const sobrecargado = tramo.id === 'sobrecargado';

  // CA
  const armadura = equipadoEn(e, p.id, 'armadura', 0);
  const datosArm = armadura?.armadura && armadura.armadura.tipo !== 'ropa' ? armadura.armadura : undefined;
  const escudos = activos.filter((o) => o.tipo === 'escudo' || (o.bonoCa && o.equipadoEn?.ranura === 'cuerpoACuerpo'));
  let ca: Valor;
  if (armadura && datosArm) {
    const tope = datosArm.desMax !== undefined ? datosArm.desMax : DES_MAX_POR_TIPO[datosArm.tipo];
    // [5e] La pesada no suma ni resta DES; la media suma hasta el tope (y resta si es negativa)
    const des = tope == null ? mod.des : tope === 0 ? 0 : Math.min(mod.des, tope);
    ca = valor(datosArm.caBase, `${armadura.nombre} (${NOMBRE_TIPO_ARMADURA[datosArm.tipo].toLowerCase()})`);
    ca = sumar(ca, tope == null ? 'DES' : `DES (máx. ${conSigno(tope)})`, des);
  } else {
    const extra = p.caSinArmadura !== undefined ? p.caSinArmadura : clase?.sinArmadura ?? null;
    ca = sumar(valor(10, 'Sin armadura'), 'DES', mod.des);
    // [5e] La defensa sin armadura del monje no admite escudo
    if (extra && !(extra === 'sab' && escudos.length)) ca = sumar(ca, `Defensa sin armadura (${ABREV_CAR[extra]})`, mod[extra]);
  }
  if (armadura && magiaActiva(armadura)) ca = sumar(ca, `${armadura.nombre} (mágica)`, armadura.bonoMagico ?? 0);
  for (const o of activos) {
    if (o.bonoCa) ca = sumar(ca, o.nombre, o.bonoCa);
    if (o.tipo === 'escudo' && o !== armadura && magiaActiva(o)) ca = sumar(ca, `${o.nombre} (mágico)`, o.bonoMagico ?? 0);
  }
  ca = sumar(ca, 'Rasgos', p.caExtra ?? 0);
  ca = aplicar(ca, mods, ['ca']);
  if (datosArm?.fueMin && car.fue.total < datosArm.fueMin) avisos.push(`${armadura!.nombre} pide FUE ${datosArm.fueMin}: −10 pies de velocidad`);

  // Pruebas: desventajas comunes
  const desvPrueba = (k: Caracteristica, v: Valor) => {
    let r = v;
    if (sac.desvPruebas) r = marcar(r, 'desv', 'Hambre');
    if (sobrecargado && FISICAS.includes(k)) r = marcar(r, 'desv', 'Sobrecargado');
    return r;
  };

  const iniciativa = desvPrueba('des', aplicar(valor(mod.des, 'DES'), mods, ['iniciativa', 'pruebas:todas', 'prueba:des']));

  // Velocidad
  const base = p.velocidad ?? (RAZA_LENTA.test(p.raza) ? 25 : 30);
  const velocidad = Object.fromEntries(MOVS.map((m) => {
    let v = aplicar(m === 'caminar' ? valor(base, p.raza) : valor(0, ''), mods, [`vel:${m}`]);
    if (v.total > 0) {
      if (m === 'caminar' && datosArm?.fueMin && car.fue.total < datosArm.fueMin) v = sumar(v, `FUE baja para ${armadura!.nombre}`, -10);
      if (tramo.id === 'cargado') v = sumar(v, 'Cargado', -10);
      if (sobrecargado) v = sumar(v, 'Sobrecargado', -20);
      if (sac.velMitad) v = sumar(v, 'Hambre (mitad)', -Math.max(0, v.total) / 2);
      v = { ...v, total: Math.max(0, v.total) };
    }
    return [m, v];
  })) as Record<Movimiento5e, Valor>;

  // PV máximos: la CON de los objetos cuenta por nivel
  let pvMax = valor(p.pvMax, 'Base');
  const dCon = mod.con - modificador(p.con);
  pvMax = sumar(pvMax, `CON ${conSigno(dCon)} × nivel ${nivel}`, dCon * nivel);
  pvMax = aplicar(pvMax, mods, ['pvMax']);
  for (const m of mods.filter((x) => x.objetivo === 'pvNivel' && !x.fijar)) pvMax = sumar(pvMax, `${m.origen} (× nivel)`, (m.valor ?? 0) * nivel);
  if (sac.pvMitad) pvMax = sumar(pvMax, 'Hambre (mitad)', -Math.ceil(pvMax.total / 2));
  pvMax = { ...pvMax, total: Math.max(1, pvMax.total) };

  // Salvaciones
  const compSalv = new Set<string>([...(clase?.salvaciones ?? []), ...(p.competencias?.salvaciones ?? []), ...mods.filter((m) => m.objetivo === 'compSalv').map((m) => m.texto ?? '')]);
  const salvaciones = Object.fromEntries(CARS.map((k) => {
    let v = valor(mod[k], ABREV_CAR[k]);
    const competente = compSalv.has(k);
    if (competente) v = sumar(v, 'Competencia', prof);
    v = aplicar(v, mods, ['salv:todas', `salv:${k}`]);
    if (sac.desvAtaquesSalv) v = marcar(v, 'desv', 'Hambre');
    if (sobrecargado && FISICAS.includes(k)) v = marcar(v, 'desv', 'Sobrecargado');
    return [k, { ...v, competente }];
  })) as Hoja['salvaciones'];

  // Habilidades
  const compHab = new Set<string>([...(p.competencias?.habilidades ?? []), ...mods.filter((m) => m.objetivo === 'compHab').map((m) => m.texto ?? '')]);
  const pericia = new Set<string>([...(p.competencias?.pericia ?? []), ...mods.filter((m) => m.objetivo === 'pericia').map((m) => m.texto ?? '')]);
  const habilidades = Object.fromEntries(HABILIDADES.map(([k, , c]) => {
    let v = valor(mod[c], ABREV_CAR[c]);
    const esPericia = pericia.has(k);
    const competente = esPericia || compHab.has(k);
    if (competente) v = sumar(v, esPericia ? 'Pericia' : 'Competencia', esPericia ? prof * 2 : prof);
    v = desvPrueba(c, aplicar(v, mods, ['pruebas:todas', `prueba:${c}`, `hab:${k}`]));
    if (k === 'sigilo' && datosArm?.sigiloDesventaja) v = marcar(v, 'desv', armadura!.nombre);
    return [k, { ...v, competente, pericia: esPericia, car: c }];
  })) as Hoja['habilidades'];

  // [5e] Pasiva = 10 + la habilidad; ventaja +5 y desventaja −5
  const pasiva = (k: 'percepcion' | 'investigacion' | 'perspicacia') => {
    const h = habilidades[k];
    let v: Valor = { base: 10, total: 10 + h.total, fuentes: [{ origen: 'Base', valor: 10 }, ...h.fuentes] };
    if (h.vent?.length && !h.desv?.length) v = sumar(v, `Ventaja (${h.vent.join(', ')})`, 5);
    if (h.desv?.length && !h.vent?.length) v = sumar(v, `Desventaja (${h.desv.join(', ')})`, -5);
    return aplicar(v, mods, [`pasiva:${k}`]);
  };
  const pasivas = { percepcion: pasiva('percepcion'), investigacion: pasiva('investigacion'), perspicacia: pasiva('perspicacia') };

  // Conjuros
  const carConj = p.caracteristicaConjuros !== undefined ? p.caracteristicaConjuros : clase?.conjuros ?? null;
  let conjuros: Hoja['conjuros'] = null;
  if (carConj) {
    const cd = aplicar(sumar(sumar(valor(8, 'Base'), 'Competencia', prof), ABREV_CAR[carConj], mod[carConj]), mods, ['cdConjuros']);
    let ataque = aplicar(sumar(valor(prof, 'Competencia'), ABREV_CAR[carConj], mod[carConj]), mods, ['ataque', 'ataque:conjuro']);
    if (sac.desvAtaquesSalv) ataque = marcar(ataque, 'desv', 'Hambre');
    if (sobrecargado) ataque = marcar(ataque, 'desv', 'Sobrecargado');
    conjuros = { car: carConj, cd, ataque };
  }

  // Sentidos
  const sentido = (k: 'oscuridad' | 'ciega' | 'temblor' | 'verdadera', nombre: string, base = 0) => {
    const v = aplicar(valor(base, p.raza), mods, [`sentido:${k}`]);
    const origen = v.fuentes.filter((f) => f.valor).map((f) => f.origen).join(', ');
    return v.total > 0 ? [{ nombre, metros: v.total, origen }] : [];
  };
  const sentidos = [
    ...sentido('oscuridad', 'Visión en la oscuridad', RAZA_OSCURIDAD.test(p.raza) ? 18 : 0),
    ...sentido('ciega', 'Vista ciega'), ...sentido('temblor', 'Sentido de la vibración'), ...sentido('verdadera', 'Visión verdadera'),
  ];

  // Efectos de texto
  const resistencias = unicos([...p.resistencias.map((r) => ({ texto: r.split('·')[0].trim(), origen: 'Personaje' })), ...textos(mods, 'resistencia')]);
  const desventajas: Efecto[] = [
    ...sac.efectos.map((t) => ({ texto: t, origen: `Hambre (${sac.nivel}/7)` })),
    ...(sobrecargado ? [{ texto: 'Pruebas, ataques y salvaciones de FUE, DES y CON', origen: 'Sobrecargado' }] : []),
    ...(datosArm?.sigiloDesventaja ? [{ texto: 'Sigilo', origen: armadura!.nombre }] : []),
    ...textos(mods, 'desventaja'),
  ];

  const h: Hoja = {
    p, nivel, tamano, activos, mods, car, mod, competencia, ca, armadura: datosArm ? armadura : undefined, iniciativa, velocidad,
    pvMax, pvActual: Math.min(p.pvActual, pvMax.total), salvaciones, habilidades, pasivas, conjuros, cargaMax, carga, tramo, sentidos,
    resistencias,
    inmunidades: unicos(textos(mods, 'inmunidad')),
    vulnerabilidades: unicos(textos(mods, 'vulnerabilidad')),
    inmuneCondiciones: unicos(textos(mods, 'inmuneCondicion')),
    ventajas: textos(mods, 'ventaja'),
    desventajas,
    notas: textos(mods, 'nota'),
    ataques: [],
    saciedad: sac,
    avisos,
  };
  h.ataques = ataquesDe(e, h);
  return h;
}

// ── Ataques con armas ─────────────────────────────────────────────

/** Bono y daño de cada arma equipada, aplicando sus propiedades [5e] y los modificadores activos. */
function ataquesDe(e: Estado, h: Hoja): AtaqueArma[] {
  const r: AtaqueArma[] = [];
  for (const ranura of ['cuerpoACuerpo', 'distancia'] as const) {
    const principal = equipadoEn(e, h.p.id, ranura, 0);
    const secundaria = equipadoEn(e, h.p.id, ranura, 1);
    for (const [indice, o] of [[0, principal], [1, secundaria]] as const) {
      if (!o?.dado) continue;
      r.push(ataqueCon(h, o, ranura, indice, indice === 0 ? secundaria : principal));
    }
  }
  return r;
}

export function ataqueCon(h: Hoja, o: Objeto, ranura: 'cuerpoACuerpo' | 'distancia', indice: number, otra?: Objeto): AtaqueArma {
  const props = new Set(o.propiedades ?? []);
  const armaDist = props.has('municion');
  const lanzada = ranura === 'distancia' && !armaDist && props.has('arrojadiza');
  const distancia = armaDist || ranura === 'distancia';
  let car: Caracteristica = armaDist ? 'des' : 'fue';
  if (props.has('sutil')) car = h.mod.fue >= h.mod.des ? 'fue' : 'des';
  const m = h.mod[car];
  const magia = magiaActiva(o);
  const notas: string[] = [];

  // Mano secundaria [5e]: dos armas ligeras; el daño no suma el modificador si es positivo
  const secundaria = indice === 1;
  const valido = !secundaria || (props.has('ligera') && !!otra?.propiedades?.includes('ligera'));
  if (secundaria) notas.push(valido ? 'Mano secundaria: acción adicional' : 'Para atacar con la mano secundaria las dos armas deben ser ligeras');

  let bono = sumar(valor(m, ABREV_CAR[car]), 'Competencia', h.competencia.total);
  if (magia) {
    bono = sumar(bono, `${o.nombre} (mágica)`, o.bonoMagico ?? 0);
    bono = sumar(bono, o.nombre, o.bonoAtaque ?? 0);
  }
  bono = aplicar(bono, h.mods, ['ataque', distancia ? 'ataque:dist' : 'ataque:cac']);
  if (props.has('pesada') && (h.tamano === 'pequeño' || h.tamano === 'diminuto')) bono = marcar(bono, 'desv', 'Pesada en criatura Pequeña');
  if (h.saciedad.desvAtaquesSalv) bono = marcar(bono, 'desv', 'Hambre');
  if (h.tramo.id === 'sobrecargado') bono = marcar(bono, 'desv', 'Sobrecargado');

  // Versátil a dos manos si la otra mano está libre
  let dado = o.dado!;
  if (props.has('versatil') && o.dadoVersatil && ranura === 'cuerpoACuerpo' && !secundaria && !otra) {
    dado = o.dadoVersatil;
    notas.push(`A dos manos (versátil ${o.dadoVersatil})`);
  } else if (props.has('versatil') && o.dadoVersatil) {
    notas.push(`Versátil ${o.dadoVersatil} con la otra mano libre`);
  }

  let danoMod = secundaria && m > 0 ? valor(0, '') : valor(m, ABREV_CAR[car]);
  if (magia) {
    danoMod = sumar(danoMod, `${o.nombre} (mágica)`, o.bonoMagico ?? 0);
    danoMod = sumar(danoMod, o.nombre, o.bonoDano ?? 0);
  }
  danoMod = aplicar(danoMod, h.mods, ['dano', distancia ? 'dano:dist' : 'dano:cac']);

  const extras = [
    ...(magia ? (o.danosExtra ?? []).map((x) => ({ ...x, origen: o.nombre })) : []),
    ...h.mods.filter((x) => x.objetivo === 'danoExtra' && x.texto && x.objetoId !== o.id).map((x) => {
      const [dadoX, ...tipo] = x.texto!.trim().split(/\s+/);
      return { dado: dadoX, tipo: tipo.join(' ') || undefined, origen: x.origen };
    }),
  ];

  const critico = Math.max(15, (magia ? o.critico ?? 20 : 20) - h.mods.filter((x) => x.objetivo === 'critico' && !x.fijar).reduce((s, x) => s + (x.valor ?? 0), 0));
  if (!magia && o.requiereSintonizacion) notas.push('Sin sintonizar: no suma sus bonos mágicos');
  if (lanzada) notas.push('Lanzada');
  if (props.has('alcance')) notas.push('Alcance 3 m');
  if (o.rango && (props.has('municion') || props.has('arrojadiza'))) notas.push(`Distancia ${o.rango}`);
  if (props.has('recarga')) notas.push(PROPIEDADES.recarga.regla);
  if (props.has('dosManos')) notas.push('A dos manos');
  if (props.has('plateada')) notas.push('Plateada');
  if (props.has('adamantina')) notas.push('Adamantina');

  const n = danoMod.total;
  return {
    objeto: o, ranura, indice, car, bono, dado, danoMod,
    dano: dado + (n === 0 ? '' : (n > 0 ? '+' : '−') + Math.abs(n)),
    tipo: o.tipoDano, extras, critico, notas, valido,
  };
}

/** El ataque de un arma suelta como si la llevara equipada (para tooltips y vista previa). */
export function ataqueDeObjeto(e: Estado, p: Personaje, o: Objeto): AtaqueArma | null {
  if (!o.dado) return null;
  const h = hoja(e, p);
  const ya = h.ataques.find((a) => a.objeto.id === o.id);
  if (ya) return ya;
  return ataqueCon(h, o, o.ranuraEquipo === 'distancia' ? 'distancia' : 'cuerpoACuerpo', 0);
}

/** Texto corto de un modificador: «+2 FUE», «FUE 19», «Resistencia: fuego». */
export { describirMod } from './describir';
