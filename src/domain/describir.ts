// Textos cortos de modificadores y propiedades, para tooltips, fichas y la vista previa del formulario.

import { ABREV_CAR, DEF_OBJETIVO, NOMBRE_CAR, NOMBRE_HAB, PROPIEDADES } from './catalogo';
import { conSigno } from './reglas';
import type { Caracteristica, Habilidad, Modificador, Objeto } from './tipos';

/** «+2 Fuerza», «Fuerza 19», «Resistencia: fuego», «+1d4 fuego en cada impacto». */
export function describirMod(m: Modificador): string {
  const def = DEF_OBJETIVO[m.objetivo];
  if (!def) return m.objetivo;
  const t = m.texto?.trim() ?? '';
  switch (def.clase) {
    case 'dano': return `${def.nombre.replace(' a daño', '')}: ${t || '—'}`;
    case 'condicion': return `Inmune a: ${t || '—'}`;
    case 'habilidad': return `${def.nombre.replace(' en habilidad', '')}: ${NOMBRE_HAB[t as Habilidad] ?? '—'}`;
    case 'caracteristica': return `Competencia en salvación de ${NOMBRE_CAR[t as Caracteristica] ?? '—'}`;
    case 'dado': return `+${t || '—'} en cada impacto`;
    case 'texto': return m.objetivo === 'nota' ? t : `${def.nombre.replace('…', '')} ${t}`.trim();
  }
  const v = m.valor ?? 0;
  const u = def.unidad ? ` ${def.unidad}` : '';
  const nombre = m.objetivo.startsWith('car:') ? ABREV_CAR[m.objetivo.slice(4) as Caracteristica] : def.nombre;
  if (m.objetivo === 'critico') return `Crítico con ${20 - v}–20`;
  if (m.fijar) return `${nombre} ${v}${u}`;
  return `${conSigno(v)}${u} ${nombre}`;
}

/** Nombre de una propiedad con su parámetro: «Versátil (1d10)», «Arrojadiza (6/18 m)». */
export function nombrePropiedad(o: Objeto, p: keyof typeof PROPIEDADES): string {
  const n = PROPIEDADES[p].nombre;
  if (p === 'versatil' && o.dadoVersatil) return `${n} (${o.dadoVersatil})`;
  if ((p === 'arrojadiza' || p === 'municion') && o.rango) return `${n} (${o.rango})`;
  return n;
}
