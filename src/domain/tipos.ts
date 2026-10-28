// Modelo de datos (HANDOFF §5), con los campos de arma desglosados para poder calcular ataque y daño.

import type { ClaveIcono } from '../ui/iconos';

export type Monedas = { ppt: number; po: number; pe: number; pp: number; pc: number };

export type Rareza = 'común' | 'poco común' | 'raro' | 'muy raro' | 'legendario' | 'artefacto';

export type Categoria =
  | 'Armas' | 'Armaduras' | 'Pociones' | 'Pergaminos' | 'Materiales' | 'Comida' | 'Llaves/misión' | 'Varios';

export type TipoRanura =
  | 'cabeza' | 'capa' | 'armadura' | 'guantes' | 'botas' | 'amuleto' | 'anillo' | 'cuerpoACuerpo' | 'distancia';

export type Propietario = { tipo: 'personaje'; id: string } | { tipo: 'alijo' };

export type Equipado = { ranura: TipoRanura; indice: number };

export type Caracteristica = 'fue' | 'des' | 'con' | 'int' | 'sab' | 'car';

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

export interface Personaje {
  id: string;
  nombre: string;
  raza: string;
  trasfondo?: string;
  clases: { clase: string; nivel: number }[];
  px?: number;
  pvActual: number;
  pvMax: number;
  ca: number;
  fue: number; des: number; con: number; int: number; sab: number; car: number;
  condiciones: string[];
  resistencias: string[];
  rasgos?: Rasgo[];
  imagenUrl?: string;
  monedas: Monedas;
  saciedad: number;
  color: string;
}

export interface Objeto {
  id: string;
  nombre: string;
  imagenUrl?: string;
  icono: ClaveIcono;
  categoria: Categoria;
  subtipo?: string;
  rareza: Rareza;
  cantidad: number;
  pesoKg: number;
  valorPo: number;
  requiereSintonizacion?: boolean;
  sintonizado?: boolean;
  ranuraEquipo?: TipoRanura | null;
  // Armas
  dado?: string;          // «1d8»
  tipoDano?: string;      // «cortante»
  bonoMagico?: number;    // +1 al ataque y al daño
  propiedades?: string[]; // «Versátil (1d10)», «Sutil», «Arrojadiza»…
  extraDano?: string;     // «+1d6 radiante contra muertos vivientes»
  bonoCa?: number;
  cargas?: number;
  cargasMax?: number;
  recarga?: string;
  efectos?: string;
  descripcion?: string;
  notas?: string;
  saciedad?: number;
  propietario: Propietario;
  equipadoEn: Equipado | null;
  /** Celda del inventario (orden manual). Sin ella, ocupa el primer hueco libre. */
  posicion?: number;
  creadoPor?: string;
  /** Ficha de la biblioteca de la que sale (o que lo recuerda). */
  fichaId?: string;
}

/** Campos que describen un objeto y se guardan en la biblioteca; no incluye dónde está ni cuántos hay. */
export const CAMPOS_FICHA = [
  'nombre', 'imagenUrl', 'icono', 'categoria', 'subtipo', 'rareza', 'pesoKg', 'valorPo', 'requiereSintonizacion', 'ranuraEquipo',
  'dado', 'tipoDano', 'bonoMagico', 'propiedades', 'extraDano', 'bonoCa', 'cargasMax', 'recarga', 'efectos', 'descripcion', 'notas', 'saciedad',
] as const;

export type DatosFicha = Pick<Objeto, (typeof CAMPOS_FICHA)[number]>;

/** Entrada de la biblioteca: lo que se sabe de un objeto aunque ya no lo tenga nadie. */
export interface Ficha extends DatosFicha {
  id: string;
  creada: number;
  actualizada: number;
  creadaPor?: string;
  /** Último que lo tuvo (nombre), para recordar de dónde salió. */
  ultimoDueno?: string;
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

// ── Bestiario ──────────────────────────────────────────────────────
// Casi todo es opcional: lo que la party no ha llegado a ver se queda vacío («sin descubrir»).

export type Actitud = 'agresiva' | 'no agresiva' | 'desconocida';

export type TipoHabilidad = 'rasgo' | 'accion' | 'reaccion' | 'legendaria';

export interface HabilidadCriatura {
  id: string;
  tipo: TipoHabilidad;
  /** Vacío: la party sabe que existe pero no la ha visto (p. ej. aún no ha usado su tercera habilidad). */
  nombre?: string;
  descripcion?: string;
  /** «+5 al ataque», «2d6+3 cortante», «CD 13 CON»… */
  detalle?: string;
}

export interface BotinCriatura {
  id: string;
  /** Enlazado a una ficha de la biblioteca: se pinta con su icono, imagen y rareza. */
  fichaId?: string;
  /** Texto libre si no está en la biblioteca, o para aclarar. */
  nombre?: string;
  cantidad?: string; // «1», «2d4», «a veces»
  nota?: string;
}

export interface Criatura {
  id: string;
  nombre: string;
  imagenUrl?: string;
  actitud: Actitud;
  tipo?: string;         // «Bestia», «No muerto»…
  tamano?: string;       // «Mediana»
  alineamiento?: string;
  desafio?: string;      // «1/2», «5»
  px?: number;
  ca?: number;
  caNota?: string;       // «armadura natural»
  pv?: number;
  pvDados?: string;      // «6d8+12»
  velocidad?: string;    // «9 m, nadar 6 m»
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
  /** Dónde se la encontró, tácticas, debilidades… */
  notas?: string;
  lugar?: string;
  encuentros?: number;
  derrotadas?: number;
  creada: number;
  actualizada: number;
  creadaPor?: string;
}

export interface Estado {
  party: Party;
  personajes: Personaje[];
  objetos: Objeto[];
  movimientos: Movimiento[];
  biblioteca?: Ficha[];
  bestiario?: Criatura[];
  registroMonedas?: { id: string; fecha: number; actor: string; texto: string }[];
}
