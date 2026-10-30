// Modelo de datos (HANDOFF §5), con los campos de arma, armadura y modificadores desglosados para que
// los objetos cambien de verdad las estadísticas del personaje (src/domain/hoja.ts).

import type { EstiloDados } from './dados';
import type { ClaveIcono } from '../ui/iconos';

export type Monedas = { ppt: number; po: number; pe: number; pp: number; pc: number };

export type Rareza = 'común' | 'poco común' | 'raro' | 'muy raro' | 'legendario' | 'artefacto';

export type Categoria =
  | 'Armas' | 'Armaduras' | 'Pociones' | 'Pergaminos' | 'Materiales' | 'Comida' | 'Llaves/misión' | 'Varios';

/** Lo que se elige en el primer paso de «Añadir objeto»; decide qué formulario se enseña. */
export type TipoObjeto =
  | 'arma' | 'municion' | 'armadura' | 'escudo' | 'equipable' | 'pocion' | 'pergamino' | 'comida' | 'material'
  | 'mision' | 'varios';

export type TipoRanura =
  | 'cabeza' | 'capa' | 'armadura' | 'guantes' | 'botas' | 'amuleto' | 'anillo' | 'cuerpoACuerpo' | 'distancia';

export type Propietario = { tipo: 'personaje'; id: string } | { tipo: 'alijo' };

export type Equipado = { ranura: TipoRanura; indice: number };

export type Caracteristica = 'fue' | 'des' | 'con' | 'int' | 'sab' | 'car';

export type Habilidad =
  | 'acrobacias' | 'atletismo' | 'arcanos' | 'engano' | 'historia' | 'interpretacion' | 'intimidacion'
  | 'investigacion' | 'juegoDeManos' | 'medicina' | 'naturaleza' | 'percepcion' | 'perspicacia' | 'persuasion'
  | 'religion' | 'sigilo' | 'supervivencia' | 'tratoConAnimales';

export type Movimiento5e = 'caminar' | 'volar' | 'nadar' | 'trepar' | 'excavar';

export type Tamano = 'diminuto' | 'pequeño' | 'mediano' | 'grande' | 'enorme';

export interface Party {
  id: string;
  nombre: string;
  tesoro: Monedas;
}

export type IconoRasgo = 'corazon' | 'rayo' | 'ojo' | 'espada' | 'escudo' | 'estrella' | 'libro' | 'mano';

export interface Rasgo {
  nombre: string;
  usos?: number;
  usosMax?: number;
  recarga?: string;
  detalle?: string; // texto corto cuando no hay usos: «Pasivo», «+1 CA», «3d6»
  icono?: IconoRasgo;
}

/**
 * Cuánto dura un efecto temporal. Las de tiempo cuentan en segundos de juego (una ronda son 6 s) y bajan
 * con «Pasa el tiempo»; las de descanso acaban con el siguiente descanso de ese tipo (o uno largo).
 */
export type Duracion =
  | { tipo: 'tiempo'; segundos: number }
  | { tipo: 'descanso'; descanso: 'corto' | 'largo' }
  | { tipo: 'indefinida' };

/** Un conjuro o una poción que cambia la hoja durante un rato: Bendecir, Fuerza de gigante… */
export interface EfectoTemporal {
  id: string;
  nombre: string;
  modificadores: Modificador[];
  duracion: Duracion;
  concentracion?: boolean;
  /** De dónde sale: el objeto usado o quién lo lanzó. */
  origen?: string;
}

/** Lo que un objeto aplica a quien lo usa (sin id: se crea al usarlo). */
export type PlantillaEfecto = Omit<EfectoTemporal, 'id'>;

export interface Personaje {
  id: string;
  nombre: string;
  raza: string;
  trasfondo?: string;
  clases: { clase: string; nivel: number }[];
  px?: number;
  pvActual: number;
  /** PV máximos sin objetos ni hambre. */
  pvMax: number;
  fue: number; des: number; con: number; int: number; sab: number; car: number;
  condiciones: string[];
  resistencias: string[];
  rasgos?: Rasgo[];
  imagenUrl?: string;
  monedas: Monedas;
  /** [casera] Saciedad de 0 a 7 (SACIEDAD_MAX). */
  saciedad: number;
  color: string;
  /** Cómo son sus dados en las tiradas; si falta, salen de su color (dados.ts). */
  dados?: EstiloDados;
  // Datos de la ficha que las reglas necesitan; si faltan, se deducen de la clase y la raza (hoja.ts)
  competencias?: { salvaciones?: Caracteristica[]; habilidades?: Habilidad[]; pericia?: Habilidad[] };
  /** Velocidad a pie en pies. */
  velocidad?: number;
  tamano?: Tamano;
  /** Característica de lanzamiento de conjuros; null si no lanza. */
  caracteristicaConjuros?: Caracteristica | null;
  /** Defensa sin armadura del bárbaro (con) o del monje (sab): 10 + DES + esa característica. */
  caSinArmadura?: Caracteristica | null;
  /** Bonos de CA que no vienen de objetos (estilo de combate Defensa, conjuros…). */
  caExtra?: number;
  /** Efectos temporales activos. */
  efectos?: EfectoTemporal[];
  /** Espacios de conjuro gastados por nivel (índice 0 = nivel 1). Se recuperan con un descanso largo. */
  espaciosUsados?: number[];
  /** Espacios máximos puestos a mano (subclases como el Caballero arcano); si faltan, salen de la clase. */
  espaciosMax?: number[];
  /** Espacios de magia del pacto (brujo) gastados. Se recuperan con un descanso corto. */
  pactoUsados?: number;
}

// ── Objetos ────────────────────────────────────────────────────────

/** [5e] Propiedades de arma del Manual del Jugador, más los materiales que importan en reglas. */
export type PropiedadArma =
  | 'ligera' | 'sutil' | 'pesada' | 'dosManos' | 'versatil' | 'alcance' | 'arrojadiza' | 'municion' | 'recarga'
  | 'especial' | 'plateada' | 'adamantina';

export type TipoArmadura = 'ligera' | 'media' | 'pesada' | 'ropa';

export interface DatosArmadura {
  tipo: TipoArmadura;
  /** CA base: 11 el cuero, 18 las placas. */
  caBase: number;
  /** Tope del modificador de DES; null = sin tope. Por defecto: ligera sin tope, media 2, pesada 0. */
  desMax?: number | null;
  /** [5e] Con menos FUE, −10 pies de velocidad. */
  fueMin?: number;
  sigiloDesventaja?: boolean;
}

export type DanoExtra = { dado: string; tipo?: string; condicion?: string };

/**
 * Qué cambia un modificador. Los numéricos suman `valor` (o lo fijan como mínimo con `fijar`, como el
 * Guantelete de poder de ogro que deja la FUE en 19). Los de texto usan `texto`.
 */
export type ObjetivoMod =
  | `car:${Caracteristica}`
  | 'ca' | 'iniciativa' | 'competencia' | 'pvMax' | 'pvNivel' | 'carga'
  | 'ataque' | 'ataque:cac' | 'ataque:dist' | 'ataque:conjuro'
  | 'dano' | 'dano:cac' | 'dano:dist' | 'danoExtra' | 'critico'
  | 'cdConjuros'
  | 'salv:todas' | `salv:${Caracteristica}`
  | 'pruebas:todas' | `prueba:${Caracteristica}` | `hab:${Habilidad}`
  | 'pasiva:percepcion' | 'pasiva:investigacion' | 'pasiva:perspicacia'
  | `vel:${Movimiento5e}`
  | 'sentido:oscuridad' | 'sentido:ciega' | 'sentido:temblor' | 'sentido:verdadera'
  | 'resistencia' | 'inmunidad' | 'vulnerabilidad' | 'inmuneCondicion'
  | 'compSalv' | 'compHab' | 'pericia'
  | 'ventaja' | 'desventaja' | 'nota';

export interface Modificador {
  objetivo: ObjetivoMod;
  valor?: number;
  /** Solo numéricos: el valor pasa a ser al menos `valor` en lugar de sumarse. */
  fijar?: boolean;
  /** Tipo de daño, condición, habilidad, característica o texto libre, según el objetivo. */
  texto?: string;
}

export interface Objeto {
  id: string;
  nombre: string;
  imagenUrl?: string;
  icono: ClaveIcono;
  tipo?: TipoObjeto;
  categoria: Categoria;
  subtipo?: string;
  rareza: Rareza;
  cantidad: number;
  pesoKg: number;
  valorPo: number;
  requiereSintonizacion?: boolean;
  sintonizado?: boolean;
  ranuraEquipo?: TipoRanura | null;
  /** Objetos sin ranura (piedras, varitas…) que hacen efecto con solo llevarlos encima. */
  funcionaSinEquipar?: boolean;
  modificadores?: Modificador[];
  // Armas
  tipoArma?: 'sencilla' | 'marcial';
  dado?: string;          // «1d8»
  dadoVersatil?: string;  // «1d10»
  tipoDano?: string;      // «cortante»
  /** +X al ataque y al daño de esta arma, o a la CA de una armadura o escudo. */
  bonoMagico?: number;
  bonoAtaque?: number;
  bonoDano?: number;
  propiedades?: PropiedadArma[];
  /** Propiedades caseras sin regla automática. */
  otrasPropiedades?: string[];
  rango?: string;         // «6/18 m» de arrojadiza o munición
  /** Rango de crítico: 19 = crítico con 19 y 20. */
  critico?: number;
  danosExtra?: DanoExtra[];
  // Armaduras y escudos
  armadura?: DatosArmadura;
  /** CA que da un escudo (2 en uno normal). */
  bonoCa?: number;
  cargas?: number;
  cargasMax?: number;
  recarga?: string;
  efectos?: string;
  /** Efecto temporal que aplica a quien lo usa (Poción de fuerza de gigante: FUE 21 durante 1 hora). */
  alUsar?: PlantillaEfecto;
  descripcion?: string;
  notas?: string;
  /** [casera] Puntos de saciedad que da cada unidad de comida (0 = no se come sola). */
  saciedad?: number;
  propietario: Propietario;
  equipadoEn: Equipado | null;
  creadoPor?: string;
  /** Ficha de la biblioteca de la que sale (biblioteca.ts). */
  fichaId?: string;
  /** Celda que ocupa en la rejilla de su dueño; sin ella, va al primer hueco. */
  posicion?: number;
}

/** Campos que describen un objeto y no dependen de quién lo tiene ni cuántos hay: lo que guarda la biblioteca. */
export const CAMPOS_FICHA = [
  'nombre', 'imagenUrl', 'icono', 'tipo', 'categoria', 'subtipo', 'rareza', 'pesoKg', 'valorPo', 'requiereSintonizacion',
  'ranuraEquipo', 'funcionaSinEquipar', 'modificadores', 'tipoArma', 'dado', 'dadoVersatil', 'tipoDano', 'bonoMagico', 'bonoAtaque',
  'bonoDano', 'propiedades', 'otrasPropiedades', 'rango', 'critico', 'danosExtra', 'armadura', 'bonoCa', 'cargasMax', 'recarga',
  'efectos', 'alUsar', 'descripcion', 'notas', 'saciedad',
] as const;

export type DatosFicha = Pick<Objeto, (typeof CAMPOS_FICHA)[number]>;

/** Un objeto conocido por la party, lo tenga alguien o no. Se guarda solo al crear o editar objetos. */
export interface FichaObjeto extends DatosFicha {
  id: string;
  creada: number;
  actualizada: number;
  creadaPor?: string;
  /** Quién lo tenía la última vez que alguien lo llevaba: «Murdok», «Alijo de la party». */
  ultimoDueno?: string;
}

// ── Bestiario ──────────────────────────────────────────────────────

export type Actitud = 'agresiva' | 'no agresiva' | 'desconocida';
export type TipoHabilidad = 'rasgo' | 'accion' | 'reaccion' | 'legendaria';

export interface HabilidadCriatura {
  id: string;
  tipo: TipoHabilidad;
  /** Sin nombre ni descripción: la party sabe que tiene algo, pero no qué. */
  nombre?: string;
  /** «+5, 2d6+3 perforante» */
  detalle?: string;
  descripcion?: string;
}

/** Lo que suelta: una ficha de la biblioteca o un nombre libre. */
export interface BotinCriatura {
  fichaId?: string;
  nombre?: string;
  /** «1», «2d4» */
  cantidad?: string;
  nota?: string;
}

/** Una criatura con la que se ha cruzado la party. Lo que no se sabe se queda vacío («sin descubrir»). */
export interface Criatura {
  id: string;
  nombre: string;
  actitud: Actitud;
  imagenUrl?: string;
  tipo?: string;
  tamano?: string;
  alineamiento?: string;
  /** Valor de desafío: «1/2», «3». */
  desafio?: string;
  ca?: number;
  /** «armadura natural» */
  caNota?: string;
  pv?: number;
  pvDados?: string;
  velocidad?: string;
  px?: number;
  caracteristicas?: Partial<Record<Caracteristica, number>>;
  salvaciones?: string;
  pericias?: string;
  resistencias?: string;
  inmunidades?: string;
  vulnerabilidades?: string;
  sentidos?: string;
  idiomas?: string;
  habilidades: HabilidadCriatura[];
  botin: BotinCriatura[];
  lugar?: string;
  notas?: string;
  encuentros?: number;
  derrotadas?: number;
  creada: number;
  actualizada: number;
  creadaPor?: string;
}

export interface Movimiento {
  id: string;
  objetoId: string;
  objetoNombre: string;
  rareza: Rareza;
  icono: ClaveIcono;
  cantidad: number;
  origen: Propietario;
  destino: Propietario;
  actor: string;
  fecha: number;
}

export interface Estado {
  version?: number;
  party: Party;
  personajes: Personaje[];
  objetos: Objeto[];
  movimientos: Movimiento[];
  registroMonedas?: { id: string; fecha: number; actor: string; texto: string }[];
  biblioteca?: FichaObjeto[];
  bestiario?: Criatura[];
}
