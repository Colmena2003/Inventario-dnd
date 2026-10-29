// Tablas de 5e que usan las reglas y los formularios: habilidades, propiedades de arma, armaduras y armas
// de referencia, tipos de daño, condiciones, clases y el catálogo de modificadores.

import type {
  Caracteristica, Habilidad, Movimiento5e, ObjetivoMod, PropiedadArma, TipoArmadura, TipoObjeto,
} from './tipos';

export const CARACTERISTICAS: [Caracteristica, string, string][] = [
  ['fue', 'FUE', 'Fuerza'], ['des', 'DES', 'Destreza'], ['con', 'CON', 'Constitución'],
  ['int', 'INT', 'Inteligencia'], ['sab', 'SAB', 'Sabiduría'], ['car', 'CAR', 'Carisma'],
];
export const NOMBRE_CAR = Object.fromEntries(CARACTERISTICAS.map(([k, , n]) => [k, n])) as Record<Caracteristica, string>;
export const ABREV_CAR = Object.fromEntries(CARACTERISTICAS.map(([k, a]) => [k, a])) as Record<Caracteristica, string>;

export const HABILIDADES: [Habilidad, string, Caracteristica][] = [
  ['acrobacias', 'Acrobacias', 'des'], ['arcanos', 'Arcanos', 'int'], ['atletismo', 'Atletismo', 'fue'],
  ['engano', 'Engaño', 'car'], ['historia', 'Historia', 'int'], ['interpretacion', 'Interpretación', 'car'],
  ['intimidacion', 'Intimidación', 'car'], ['investigacion', 'Investigación', 'int'], ['juegoDeManos', 'Juego de manos', 'des'],
  ['medicina', 'Medicina', 'sab'], ['naturaleza', 'Naturaleza', 'int'], ['percepcion', 'Percepción', 'sab'],
  ['perspicacia', 'Perspicacia', 'sab'], ['persuasion', 'Persuasión', 'car'], ['religion', 'Religión', 'int'],
  ['sigilo', 'Sigilo', 'des'], ['supervivencia', 'Supervivencia', 'sab'], ['tratoConAnimales', 'Trato con animales', 'sab'],
];
export const NOMBRE_HAB = Object.fromEntries(HABILIDADES.map(([k, n]) => [k, n])) as Record<Habilidad, string>;

export const MOVIMIENTOS: [Movimiento5e, string][] = [
  ['caminar', 'A pie'], ['volar', 'Volar'], ['nadar', 'Nadar'], ['trepar', 'Trepar'], ['excavar', 'Excavar'],
];

export const TIPOS_DANO = [
  'contundente', 'cortante', 'perforante', 'ácido', 'frío', 'fuego', 'fuerza', 'necrótico', 'psíquico', 'radiante',
  'relámpago', 'trueno', 'veneno',
];

export const CONDICIONES = [
  'agarrado', 'apresado', 'asustado', 'aturdido', 'cegado', 'derribado', 'ensordecido', 'envenenado', 'hechizado',
  'incapacitado', 'inconsciente', 'invisible', 'paralizado', 'petrificado', 'agotamiento',
];

export const DADOS = ['1', '1d4', '1d6', '1d8', '1d10', '1d12', '2d4', '2d6', '2d8', '3d6'];

// ── Propiedades de arma [5e] ──────────────────────────────────────

export const PROPIEDADES: Record<PropiedadArma, { nombre: string; regla: string }> = {
  ligera: { nombre: 'Ligera', regla: 'Con dos armas ligeras, la de la mano secundaria ataca como acción adicional (sin sumar el modificador al daño).' },
  sutil: { nombre: 'Sutil', regla: 'Ataque y daño con la mejor de FUE y DES.' },
  pesada: { nombre: 'Pesada', regla: 'Las criaturas Pequeñas tienen desventaja al atacar con ella.' },
  dosManos: { nombre: 'A dos manos', regla: 'Ocupa las dos manos: al equiparla se libera la mano secundaria.' },
  versatil: { nombre: 'Versátil', regla: 'Con la mano secundaria libre se usa el dado versátil.' },
  alcance: { nombre: 'Alcance', regla: 'Alcance de 3 m en lugar de 1,5 m.' },
  arrojadiza: { nombre: 'Arrojadiza', regla: 'Se puede lanzar; usa el mismo modificador que en cuerpo a cuerpo.' },
  municion: { nombre: 'Munición', regla: 'Ataque a distancia con DES; necesita munición.' },
  recarga: { nombre: 'Recarga', regla: 'Solo un ataque por acción, aunque tengas más.' },
  especial: { nombre: 'Especial', regla: 'Tiene reglas propias (míralas en sus efectos).' },
  plateada: { nombre: 'Plateada', regla: 'Supera la resistencia al daño no mágico de algunas criaturas.' },
  adamantina: { nombre: 'Adamantina', regla: 'Los impactos contra objetos son críticos.' },
};

export const ORDEN_PROPIEDADES: PropiedadArma[] = [
  'ligera', 'sutil', 'pesada', 'dosManos', 'versatil', 'alcance', 'arrojadiza', 'municion', 'recarga', 'especial', 'plateada', 'adamantina',
];

type PlantillaArma = { nombre: string; tipoArma: 'sencilla' | 'marcial'; distancia?: boolean; dado: string; tipoDano: string; pesoKg: number; valorPo: number; propiedades: PropiedadArma[]; dadoVersatil?: string; rango?: string };

/** [5e] Armas del Manual del Jugador, para rellenar el formulario de un golpe. */
export const ARMAS: PlantillaArma[] = [
  { nombre: 'Bastón', tipoArma: 'sencilla', dado: '1d6', tipoDano: 'contundente', pesoKg: 2, valorPo: 0.2, propiedades: ['versatil'], dadoVersatil: '1d8' },
  { nombre: 'Daga', tipoArma: 'sencilla', dado: '1d4', tipoDano: 'perforante', pesoKg: 0.5, valorPo: 2, propiedades: ['sutil', 'ligera', 'arrojadiza'], rango: '6/18 m' },
  { nombre: 'Clava', tipoArma: 'sencilla', dado: '1d4', tipoDano: 'contundente', pesoKg: 1, valorPo: 0.1, propiedades: ['ligera'] },
  { nombre: 'Gran clava', tipoArma: 'sencilla', dado: '1d8', tipoDano: 'contundente', pesoKg: 5, valorPo: 0.2, propiedades: ['dosManos'] },
  { nombre: 'Hacha de mano', tipoArma: 'sencilla', dado: '1d6', tipoDano: 'cortante', pesoKg: 1, valorPo: 5, propiedades: ['ligera', 'arrojadiza'], rango: '6/18 m' },
  { nombre: 'Jabalina', tipoArma: 'sencilla', dado: '1d6', tipoDano: 'perforante', pesoKg: 1, valorPo: 0.5, propiedades: ['arrojadiza'], rango: '9/36 m' },
  { nombre: 'Lanza', tipoArma: 'sencilla', dado: '1d6', tipoDano: 'perforante', pesoKg: 1.5, valorPo: 1, propiedades: ['arrojadiza', 'versatil'], dadoVersatil: '1d8', rango: '6/18 m' },
  { nombre: 'Martillo ligero', tipoArma: 'sencilla', dado: '1d4', tipoDano: 'contundente', pesoKg: 1, valorPo: 2, propiedades: ['ligera', 'arrojadiza'], rango: '6/18 m' },
  { nombre: 'Maza', tipoArma: 'sencilla', dado: '1d6', tipoDano: 'contundente', pesoKg: 2, valorPo: 5, propiedades: [] },
  { nombre: 'Hoz', tipoArma: 'sencilla', dado: '1d4', tipoDano: 'cortante', pesoKg: 1, valorPo: 1, propiedades: ['ligera'] },
  { nombre: 'Ballesta ligera', tipoArma: 'sencilla', distancia: true, dado: '1d8', tipoDano: 'perforante', pesoKg: 2.5, valorPo: 25, propiedades: ['municion', 'recarga', 'dosManos'], rango: '24/96 m' },
  { nombre: 'Arco corto', tipoArma: 'sencilla', distancia: true, dado: '1d6', tipoDano: 'perforante', pesoKg: 1, valorPo: 25, propiedades: ['municion', 'dosManos'], rango: '24/96 m' },
  { nombre: 'Honda', tipoArma: 'sencilla', distancia: true, dado: '1d4', tipoDano: 'contundente', pesoKg: 0, valorPo: 0.1, propiedades: ['municion'], rango: '9/36 m' },
  { nombre: 'Dardo', tipoArma: 'sencilla', distancia: true, dado: '1d4', tipoDano: 'perforante', pesoKg: 0.1, valorPo: 0.05, propiedades: ['sutil', 'arrojadiza'], rango: '6/18 m' },
  { nombre: 'Espada corta', tipoArma: 'marcial', dado: '1d6', tipoDano: 'perforante', pesoKg: 1, valorPo: 10, propiedades: ['sutil', 'ligera'] },
  { nombre: 'Espada larga', tipoArma: 'marcial', dado: '1d8', tipoDano: 'cortante', pesoKg: 1.5, valorPo: 15, propiedades: ['versatil'], dadoVersatil: '1d10' },
  { nombre: 'Estoque', tipoArma: 'marcial', dado: '1d8', tipoDano: 'perforante', pesoKg: 1, valorPo: 25, propiedades: ['sutil'] },
  { nombre: 'Cimitarra', tipoArma: 'marcial', dado: '1d6', tipoDano: 'cortante', pesoKg: 1.5, valorPo: 25, propiedades: ['sutil', 'ligera'] },
  { nombre: 'Espadón', tipoArma: 'marcial', dado: '2d6', tipoDano: 'cortante', pesoKg: 3, valorPo: 50, propiedades: ['pesada', 'dosManos'] },
  { nombre: 'Gran hacha', tipoArma: 'marcial', dado: '1d12', tipoDano: 'cortante', pesoKg: 3.5, valorPo: 30, propiedades: ['pesada', 'dosManos'] },
  { nombre: 'Hacha de batalla', tipoArma: 'marcial', dado: '1d8', tipoDano: 'cortante', pesoKg: 2, valorPo: 10, propiedades: ['versatil'], dadoVersatil: '1d10' },
  { nombre: 'Martillo de guerra', tipoArma: 'marcial', dado: '1d8', tipoDano: 'contundente', pesoKg: 1, valorPo: 15, propiedades: ['versatil'], dadoVersatil: '1d10' },
  { nombre: 'Mazo', tipoArma: 'marcial', dado: '2d6', tipoDano: 'contundente', pesoKg: 5, valorPo: 10, propiedades: ['pesada', 'dosManos'] },
  { nombre: 'Lucero del alba', tipoArma: 'marcial', dado: '1d8', tipoDano: 'perforante', pesoKg: 2, valorPo: 15, propiedades: [] },
  { nombre: 'Alabarda', tipoArma: 'marcial', dado: '1d10', tipoDano: 'cortante', pesoKg: 3, valorPo: 20, propiedades: ['pesada', 'alcance', 'dosManos'] },
  { nombre: 'Guja', tipoArma: 'marcial', dado: '1d10', tipoDano: 'cortante', pesoKg: 3, valorPo: 20, propiedades: ['pesada', 'alcance', 'dosManos'] },
  { nombre: 'Pica', tipoArma: 'marcial', dado: '1d10', tipoDano: 'perforante', pesoKg: 9, valorPo: 5, propiedades: ['pesada', 'alcance', 'dosManos'] },
  { nombre: 'Lanza de caballería', tipoArma: 'marcial', dado: '1d12', tipoDano: 'perforante', pesoKg: 3, valorPo: 10, propiedades: ['alcance', 'especial'] },
  { nombre: 'Látigo', tipoArma: 'marcial', dado: '1d4', tipoDano: 'cortante', pesoKg: 1.5, valorPo: 2, propiedades: ['sutil', 'alcance'] },
  { nombre: 'Tridente', tipoArma: 'marcial', dado: '1d6', tipoDano: 'perforante', pesoKg: 2, valorPo: 5, propiedades: ['arrojadiza', 'versatil'], dadoVersatil: '1d8', rango: '6/18 m' },
  { nombre: 'Arco largo', tipoArma: 'marcial', distancia: true, dado: '1d8', tipoDano: 'perforante', pesoKg: 1, valorPo: 50, propiedades: ['municion', 'pesada', 'dosManos'], rango: '45/180 m' },
  { nombre: 'Ballesta pesada', tipoArma: 'marcial', distancia: true, dado: '1d10', tipoDano: 'perforante', pesoKg: 9, valorPo: 50, propiedades: ['municion', 'pesada', 'recarga', 'dosManos'], rango: '30/120 m' },
  { nombre: 'Ballesta de mano', tipoArma: 'marcial', distancia: true, dado: '1d6', tipoDano: 'perforante', pesoKg: 1.5, valorPo: 75, propiedades: ['municion', 'ligera', 'recarga'], rango: '9/36 m' },
];

// ── Armaduras [5e] ────────────────────────────────────────────────

export const DES_MAX_POR_TIPO: Record<TipoArmadura, number | null> = { ligera: null, media: 2, pesada: 0, ropa: null };

export const NOMBRE_TIPO_ARMADURA: Record<TipoArmadura, string> = { ligera: 'Ligera', media: 'Media', pesada: 'Pesada', ropa: 'Ropa (sin armadura)' };

export const ARMADURAS: { nombre: string; tipo: TipoArmadura; caBase: number; fueMin?: number; sigilo?: boolean; pesoKg: number; valorPo: number }[] = [
  { nombre: 'Acolchada', tipo: 'ligera', caBase: 11, sigilo: true, pesoKg: 4, valorPo: 5 },
  { nombre: 'Cuero', tipo: 'ligera', caBase: 11, pesoKg: 5, valorPo: 10 },
  { nombre: 'Cuero tachonado', tipo: 'ligera', caBase: 12, pesoKg: 6, valorPo: 45 },
  { nombre: 'Pieles', tipo: 'media', caBase: 12, pesoKg: 6, valorPo: 10 },
  { nombre: 'Camisote de mallas', tipo: 'media', caBase: 13, pesoKg: 10, valorPo: 50 },
  { nombre: 'Cota de escamas', tipo: 'media', caBase: 14, sigilo: true, pesoKg: 20, valorPo: 50 },
  { nombre: 'Coraza', tipo: 'media', caBase: 14, pesoKg: 10, valorPo: 400 },
  { nombre: 'Semiplacas', tipo: 'media', caBase: 15, sigilo: true, pesoKg: 20, valorPo: 750 },
  { nombre: 'Cota de anillas', tipo: 'pesada', caBase: 14, sigilo: true, pesoKg: 20, valorPo: 30 },
  { nombre: 'Cota de mallas', tipo: 'pesada', caBase: 16, fueMin: 13, sigilo: true, pesoKg: 27, valorPo: 75 },
  { nombre: 'Bandas', tipo: 'pesada', caBase: 17, fueMin: 15, sigilo: true, pesoKg: 30, valorPo: 200 },
  { nombre: 'Placas', tipo: 'pesada', caBase: 18, fueMin: 15, sigilo: true, pesoKg: 32, valorPo: 1500 },
];

// ── Clases [5e] ───────────────────────────────────────────────────

type DatosClase = { salvaciones: Caracteristica[]; conjuros?: Caracteristica; sinArmadura?: Caracteristica };

/** Se busca por el principio del nombre, así vale «Maga» o «Mago». */
const CLASES: [RegExp, DatosClase][] = [
  [/^b[aá]rbar/i, { salvaciones: ['fue', 'con'], sinArmadura: 'con' }],
  [/^bard/i, { salvaciones: ['des', 'car'], conjuros: 'car' }],
  [/^cl[eé]rig/i, { salvaciones: ['sab', 'car'], conjuros: 'sab' }],
  [/^druid/i, { salvaciones: ['int', 'sab'], conjuros: 'sab' }],
  [/^explorador|^guardabosque/i, { salvaciones: ['fue', 'des'], conjuros: 'sab' }],
  [/^guerrer/i, { salvaciones: ['fue', 'con'] }],
  [/^brujo|^bruja/i, { salvaciones: ['sab', 'car'], conjuros: 'car' }],
  [/^hechicer/i, { salvaciones: ['con', 'car'], conjuros: 'car' }],
  [/^mag[oa]/i, { salvaciones: ['int', 'sab'], conjuros: 'int' }],
  [/^monj/i, { salvaciones: ['fue', 'des'], sinArmadura: 'sab' }],
  [/^palad/i, { salvaciones: ['sab', 'car'], conjuros: 'car' }],
  [/^p[ií]car/i, { salvaciones: ['des', 'int'] }],
  [/^artific/i, { salvaciones: ['con', 'int'], conjuros: 'int' }],
];

export const datosClase = (nombre: string): DatosClase | undefined => CLASES.find(([re]) => re.test(nombre.trim()))?.[1];

/** [5e] Razas Pequeñas y de 25 pies de velocidad. */
export const RAZA_PEQUENA = /median|gnom|kobold|goblin|halfling/i;
export const RAZA_LENTA = /enan|median|gnom|halfling/i;

// ── Tipos de objeto (primer paso de «Añadir objeto») ──────────────

export const TIPOS_OBJETO: { id: TipoObjeto; nombre: string; detalle: string; icono: string }[] = [
  { id: 'arma', nombre: 'Arma', detalle: 'Daño, propiedades, bonos y daño adicional', icono: 'sword' },
  { id: 'armadura', nombre: 'Armadura', detalle: 'CA base, tope de DES, FUE mínima', icono: 'armor' },
  { id: 'escudo', nombre: 'Escudo', detalle: 'Bono a la CA en la mano secundaria', icono: 'shield' },
  { id: 'equipable', nombre: 'Prenda o accesorio', detalle: 'Casco, capa, guantes, botas, amuleto, anillo', icono: 'ring' },
  { id: 'pocion', nombre: 'Poción', detalle: 'Consumible con efecto', icono: 'potion' },
  { id: 'pergamino', nombre: 'Pergamino', detalle: 'Conjuro de un solo uso', icono: 'scroll' },
  { id: 'comida', nombre: 'Comida', detalle: 'Cuánta saciedad llena', icono: 'bread' },
  { id: 'material', nombre: 'Material', detalle: 'Hierbas, minerales, partes, reactivos', icono: 'herb' },
  { id: 'municion', nombre: 'Munición', detalle: 'Flechas, virotes, balas', icono: 'dagger' },
  { id: 'mision', nombre: 'Llave o misión', detalle: 'Objetos de la trama', icono: 'key' },
  { id: 'varios', nombre: 'Objeto maravilloso / varios', detalle: 'Varitas, gemas, herramientas, lo demás', icono: 'gem' },
];

// ── Modificadores ─────────────────────────────────────────────────

export type ClaseObjetivo = 'numero' | 'dano' | 'condicion' | 'habilidad' | 'caracteristica' | 'texto' | 'dado';

export type DefObjetivo = { id: ObjetivoMod; nombre: string; clase: ClaseObjetivo; fijable?: boolean; unidad?: string };

/** Catálogo de lo que un objeto puede modificar, agrupado como se enseña en el formulario. */
export const OBJETIVOS: { grupo: string; items: DefObjetivo[] }[] = [
  {
    grupo: 'Características',
    items: CARACTERISTICAS.map(([k, , n]) => ({ id: `car:${k}` as ObjetivoMod, nombre: n, clase: 'numero' as const, fijable: true })),
  },
  {
    grupo: 'Defensa y vida',
    items: [
      { id: 'ca', nombre: 'Clase de armadura', clase: 'numero', fijable: true },
      { id: 'pvMax', nombre: 'PV máximos', clase: 'numero' },
      { id: 'pvNivel', nombre: 'PV máximos por nivel', clase: 'numero' },
      { id: 'resistencia', nombre: 'Resistencia a daño', clase: 'dano' },
      { id: 'inmunidad', nombre: 'Inmunidad a daño', clase: 'dano' },
      { id: 'vulnerabilidad', nombre: 'Vulnerabilidad a daño', clase: 'dano' },
      { id: 'inmuneCondicion', nombre: 'Inmunidad a condición', clase: 'condicion' },
    ],
  },
  {
    grupo: 'Ataque y daño',
    items: [
      { id: 'ataque', nombre: 'Tiradas de ataque (todas)', clase: 'numero' },
      { id: 'ataque:cac', nombre: 'Ataque cuerpo a cuerpo', clase: 'numero' },
      { id: 'ataque:dist', nombre: 'Ataque a distancia', clase: 'numero' },
      { id: 'dano', nombre: 'Daño con armas (todas)', clase: 'numero' },
      { id: 'dano:cac', nombre: 'Daño cuerpo a cuerpo', clase: 'numero' },
      { id: 'dano:dist', nombre: 'Daño a distancia', clase: 'numero' },
      { id: 'danoExtra', nombre: 'Daño adicional en cada impacto', clase: 'dado' },
      { id: 'critico', nombre: 'Rango de crítico (+1 = 19–20)', clase: 'numero' },
    ],
  },
  {
    grupo: 'Conjuros',
    items: [
      { id: 'cdConjuros', nombre: 'CD de salvación de conjuros', clase: 'numero' },
      { id: 'ataque:conjuro', nombre: 'Ataque de conjuro', clase: 'numero' },
    ],
  },
  {
    grupo: 'Salvaciones',
    items: [
      { id: 'salv:todas', nombre: 'Todas las salvaciones', clase: 'numero' },
      ...CARACTERISTICAS.map(([k, , n]) => ({ id: `salv:${k}` as ObjetivoMod, nombre: `Salvación de ${n}`, clase: 'numero' as const })),
      { id: 'compSalv', nombre: 'Competencia en salvación', clase: 'caracteristica' },
    ],
  },
  {
    grupo: 'Pruebas y habilidades',
    items: [
      { id: 'pruebas:todas', nombre: 'Todas las pruebas de característica', clase: 'numero' },
      { id: 'iniciativa', nombre: 'Iniciativa', clase: 'numero' },
      ...CARACTERISTICAS.map(([k, , n]) => ({ id: `prueba:${k}` as ObjetivoMod, nombre: `Pruebas de ${n}`, clase: 'numero' as const })),
      ...HABILIDADES.map(([k, n]) => ({ id: `hab:${k}` as ObjetivoMod, nombre: n, clase: 'numero' as const })),
      { id: 'compHab', nombre: 'Competencia en habilidad', clase: 'habilidad' },
      { id: 'pericia', nombre: 'Pericia en habilidad', clase: 'habilidad' },
      { id: 'competencia', nombre: 'Bono de competencia', clase: 'numero' },
    ],
  },
  {
    grupo: 'Pasivas',
    items: [
      { id: 'pasiva:percepcion', nombre: 'Percepción pasiva', clase: 'numero' },
      { id: 'pasiva:investigacion', nombre: 'Investigación pasiva', clase: 'numero' },
      { id: 'pasiva:perspicacia', nombre: 'Perspicacia pasiva', clase: 'numero' },
    ],
  },
  {
    grupo: 'Movimiento, sentidos y carga',
    items: [
      ...MOVIMIENTOS.map(([k, n]) => ({ id: `vel:${k}` as ObjetivoMod, nombre: `Velocidad · ${n.toLowerCase()}`, clase: 'numero' as const, fijable: true, unidad: 'pies' })),
      { id: 'sentido:oscuridad', nombre: 'Visión en la oscuridad', clase: 'numero', fijable: true, unidad: 'm' },
      { id: 'sentido:ciega', nombre: 'Vista ciega', clase: 'numero', fijable: true, unidad: 'm' },
      { id: 'sentido:temblor', nombre: 'Sentido de la vibración', clase: 'numero', fijable: true, unidad: 'm' },
      { id: 'sentido:verdadera', nombre: 'Visión verdadera', clase: 'numero', fijable: true, unidad: 'm' },
      { id: 'carga', nombre: 'Carga máxima', clase: 'numero', unidad: 'kg' },
    ],
  },
  {
    grupo: 'Otros efectos',
    items: [
      { id: 'ventaja', nombre: 'Ventaja en…', clase: 'texto' },
      { id: 'desventaja', nombre: 'Desventaja en…', clase: 'texto' },
      { id: 'nota', nombre: 'Efecto pasivo (texto)', clase: 'texto' },
    ],
  },
];

export const DEF_OBJETIVO = Object.fromEntries(OBJETIVOS.flatMap((g) => g.items).map((d) => [d.id, d])) as Record<ObjetivoMod, DefObjetivo>;
