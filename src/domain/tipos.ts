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
  /** Encuadre de la imagen en su hueco, en % (object-position). Por defecto, centrada y un poco por arriba. */
  imagenEncuadre?: { x: number; y: number };
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
  party: Party;
  personajes: Personaje[];
  objetos: Objeto[];
  movimientos: Movimiento[];
  registroMonedas?: { id: string; fecha: number; actor: string; texto: string }[];
}
