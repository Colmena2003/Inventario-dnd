// Modelo de datos (HANDOFF §5), con los campos de arma, armadura y modificadores desglosados para que
// los objetos cambien de verdad las estadísticas del personaje (src/domain/hoja.ts).

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
  // Datos de la ficha que las reglas necesitan; si faltan, se deducen de la clase y la raza (hoja.ts)
  competencias?: { salvaciones?: Caracteristica[]; habilidades?: Habilidad[]; pericia?: Habilidad[] };
  /** Velocidad a pie en metros. */
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
  /** Lo ha cambiado un jugador en el editor: la migración de la semilla ya no lo pisa. */
  editado?: boolean;
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
  /** [5e] Con menos FUE, −3 m de velocidad. */
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
}
