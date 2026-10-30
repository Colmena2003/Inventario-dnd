// Icono de cada clase de 5e, para la ficha y las columnas. Acepta femenino e inglés: «Maga», «Wizard».

import type { Personaje } from '../domain/tipos';
import { ICONO_CLASE } from './iconosJuego';
import { Icono } from './piezas';

const CLASES = ['Bárbaro', 'Bardo', 'Brujo', 'Clérigo', 'Druida', 'Explorador', 'Guerrero', 'Hechicero', 'Mago', 'Monje', 'Paladín', 'Pícaro', 'Artífice'] as const;
type Clase = (typeof CLASES)[number];

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const ALIAS: Record<string, Clase> = Object.fromEntries([
  ...CLASES.map((c) => [normal(c), c]),
  ['barbara', 'Bárbaro'], ['barda', 'Bardo'], ['bruja', 'Brujo'], ['cleriga', 'Clérigo'], ['exploradora', 'Explorador'], ['guardabosques', 'Explorador'],
  ['guerrera', 'Guerrero'], ['hechicera', 'Hechicero'], ['maga', 'Mago'], ['monja', 'Monje'], ['paladina', 'Paladín'], ['picara', 'Pícaro'], ['artifice', 'Artífice'],
  ['barbarian', 'Bárbaro'], ['bard', 'Bardo'], ['warlock', 'Brujo'], ['cleric', 'Clérigo'], ['druid', 'Druida'], ['ranger', 'Explorador'], ['fighter', 'Guerrero'],
  ['sorcerer', 'Hechicero'], ['wizard', 'Mago'], ['monk', 'Monje'], ['paladin', 'Paladín'], ['rogue', 'Pícaro'], ['artificer', 'Artífice'],
]);


const claseDe = (nombre: string): Clase | null => ALIAS[normal(nombre)] ?? null;

export function IconoClase({ clase, tam = 16 }: { clase: string; tam?: number }) {
  const c = claseDe(clase);
  if (!c) return null;
  return <Icono d={ICONO_CLASE[c]} size={tam} className="icono-clase" />;
}

/** «🪄 Mago 3 / 🗡 Pícaro 2» */
export function ClasesConIcono({ clases, tam = 15 }: { clases: Personaje['clases']; tam?: number }) {
  return (
    <span className="clases-icono">
      {clases.map((c, i) => (
        <span key={i}>
          {i > 0 && <span className="clases-sep"> / </span>}
          <IconoClase clase={c.clase} tam={tam} />{c.clase} {c.nivel}
        </span>
      ))}
    </span>
  );
}
