// Textos de desglose para los title de la interfaz: «Coraza (media) 14 · DES +0 · Escudo +2…».

import type { AtaqueArma, Valor } from '../domain/hoja';
import { conSigno } from '../domain/reglas';

export function desglose(v: Valor): string {
  const partes = v.fuentes.map((f, i) => (f.fijado ? `${f.origen}: fija ${f.valor}` : `${f.origen} ${i === 0 ? f.valor : conSigno(f.valor)}`));
  if (v.vent?.length) partes.push(`Ventaja: ${v.vent.join(', ')}`);
  if (v.desv?.length) partes.push(`Desventaja: ${v.desv.join(', ')}`);
  return `${partes.join(' · ')} = ${v.total}`;
}

export function tituloAtaque(a: AtaqueArma): string {
  return [
    `${a.objeto.nombre}`,
    `Ataque: ${desglose(a.bono)}`,
    `Daño: ${a.dado} ${a.danoMod.fuentes.length ? `+ (${desglose(a.danoMod)})` : ''}`,
    ...a.extras.map((x) => `+${x.dado}${x.tipo ? ` ${x.tipo}` : ''}${x.condicion ? ` ${x.condicion}` : ''}`),
    a.critico < 20 ? `Crítico con ${a.critico}–20` : '',
    ...a.notas,
  ].filter(Boolean).join('\n');
}

/** Clase CSS para un valor que los objetos han cambiado: sube, baja o se fija. */
export function claseCambio(v: Valor): string {
  const extra = v.fuentes.slice(1);
  if (!extra.length || v.total === v.base) return v.desv?.length ? 'desv' : '';
  return v.total > v.base ? 'sube' : 'baja';
}
