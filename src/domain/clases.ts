// Las 12 clases del Manual del Jugador de D&D 5e (2014). El nombre que se guarda es el de esta lista;
// los personajes antiguos pueden tener la forma femenina («Maga», «Pícara») y se reconocen igual.

export const CLASES = [
  'Bárbaro', 'Bardo', 'Brujo', 'Clérigo', 'Druida', 'Explorador', 'Guerrero', 'Hechicero', 'Mago', 'Monje', 'Paladín', 'Pícaro',
] as const;

export type Clase = (typeof CLASES)[number];

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const FORMAS: Record<string, Clase> = Object.fromEntries([
  ...CLASES.map((c) => [sinTildes(c), c]),
  ...([
    ['barbara', 'Bárbaro'], ['barda', 'Bardo'], ['bruja', 'Brujo'], ['cleriga', 'Clérigo'], ['exploradora', 'Explorador'],
    ['guerrera', 'Guerrero'], ['hechicera', 'Hechicero'], ['maga', 'Mago'], ['monja', 'Monje'], ['paladina', 'Paladín'],
    ['picara', 'Pícaro'],
    // Nombres en inglés, por si alguien los escribe así
    ['barbarian', 'Bárbaro'], ['bard', 'Bardo'], ['warlock', 'Brujo'], ['cleric', 'Clérigo'], ['druid', 'Druida'],
    ['ranger', 'Explorador'], ['fighter', 'Guerrero'], ['sorcerer', 'Hechicero'], ['wizard', 'Mago'], ['monk', 'Monje'],
    ['paladin', 'Paladín'], ['rogue', 'Pícaro'],
  ] as [string, Clase][]),
]);

/** La clase de la lista que corresponde a un nombre guardado, o null si no es ninguna de las 12. */
export const claseDe = (nombre: string): Clase | null => FORMAS[sinTildes(nombre)] ?? null;

/** La clase con más niveles (la primera si empatan): la que representa al personaje. */
export function clasePrincipal(clases: { clase: string; nivel: number }[]): Clase | null {
  const conocidas = clases.map((c) => ({ c: claseDe(c.clase), n: c.nivel })).filter((x) => x.c);
  conocidas.sort((a, b) => b.n - a.n);
  return conocidas[0]?.c ?? null;
}
