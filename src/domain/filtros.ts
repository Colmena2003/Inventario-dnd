// Filtros de búsqueda de la barra superior: atenúan en todas las pantallas los objetos que no cumplen,
// igual que el texto de búsqueda.

import { usable } from './uso';
import type { Categoria, Objeto, Rareza } from './tipos';

export type Rasgo = 'magico' | 'sintonizacion' | 'equipado' | 'usable' | 'conCargas';

export interface Filtros {
  rarezas: Rareza[];
  categorias: Categoria[];
  rasgos: Rasgo[];
}

export const SIN_FILTROS: Filtros = { rarezas: [], categorias: [], rasgos: [] };

export const RASGOS: { id: Rasgo; texto: string }[] = [
  { id: 'magico', texto: 'Mágicos' },
  { id: 'sintonizacion', texto: 'Requieren sintonización' },
  { id: 'equipado', texto: 'Equipados' },
  { id: 'usable', texto: 'Se pueden usar' },
  { id: 'conCargas', texto: 'Con cargas' },
];

export const cuantosFiltros = (f: Filtros) => f.rarezas.length + f.categorias.length + f.rasgos.length;

/** Mágico: no común, con bono mágico, con modificadores o que pide sintonía. */
const magico = (o: Objeto) => o.rareza !== 'común' || !!o.bonoMagico || !!o.modificadores?.length || !!o.requiereSintonizacion || !!o.alUsar;

const CUMPLE: Record<Rasgo, (o: Objeto) => boolean> = {
  magico,
  sintonizacion: (o) => !!o.requiereSintonizacion,
  equipado: (o) => !!o.equipadoEn,
  usable,
  conCargas: (o) => !!o.cargasMax,
};

/** Dentro de cada grupo basta con cumplir uno (rareza A o B); entre grupos, todos (rareza y categoría). */
export function cumpleFiltros(o: Objeto, f: Filtros, texto = ''): boolean {
  const q = texto.trim().toLocaleLowerCase('es');
  if (q && !o.nombre.toLocaleLowerCase('es').includes(q)) return false;
  if (f.rarezas.length && !f.rarezas.includes(o.rareza)) return false;
  if (f.categorias.length && !f.categorias.includes(o.categoria)) return false;
  return f.rasgos.every((r) => CUMPLE[r](o));
}
