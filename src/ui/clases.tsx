// Iconos propios de cada clase (dibujados para la app, no los logos oficiales de D&D, que tienen
// derechos de autor), en la misma rejilla de 24×24 y trazo que el resto de iconos.

import { claseDe, type Clase } from '../domain/clases';

export const ICONO_CLASE: Record<Clase, string> = {
  // Hacha a dos manos
  Bárbaro: 'M4 20.5l9.5-9.5M11.5 9l3.5 3.5M11.5 9c.4-3 3.4-5.8 8.5-6-.2 5-3 8-5 9.5z',
  // Laúd
  Bardo: 'M8.5 21a5.5 5.5 0 1 1 5.5-5.5A5.5 5.5 0 0 1 8.5 21zM12.4 11.6L19 5M17.2 3.2l3.6 3.6M8.5 14.2a1.3 1.3 0 1 0 .1 0M5.8 18.2l1.8-1.8',
  // Ojo del pacto
  Brujo: 'M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6zM12 8.5l2.2 3.5-2.2 3.5-2.2-3.5zM12 3v1.5M12 19.5V21',
  // Símbolo sagrado (sol)
  Clérigo: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1',
  // Hoja
  Druida: 'M5 19C5 10.5 10.5 5 20 4c-.6 9.5-6 15-15 15zM5 19l10-10M9.5 14.5h3.5M12 12V8.8',
  // Flecha con plumas
  Explorador: 'M4 20L19 5M14 4.5h5.5V10M4 20l.5-3.5M4 20l3.5-.5M6.5 14.5l3 3M8.5 12.5l3 3',
  // Espadas cruzadas
  Guerrero: 'M4 4l11 11M13 17.5l4.5-4.5M16 16l3.5 3.5M20 4L9 15M6.5 13l4.5 4.5M8 16l-3.5 3.5',
  // Llama
  Hechicero: 'M12 3c.8 3.6 6 5.8 6 11a6 6 0 0 1-12 0c0-2.8 1.6-4.7 3-5.8-.2 2 .9 3.3 2.2 3.6C10.6 9.3 10.4 6 12 3z',
  // Sombrero de mago con estrella
  Mago: 'M3.5 19.5h17M6.5 19.5L12 3.5l5.5 16M12 11.2l.8 1.6 1.7.3-1.2 1.2.3 1.7-1.6-.8-1.6.8.3-1.7-1.2-1.2 1.7-.3z',
  // Puño
  Monje: 'M7 11V8.2a1.6 1.6 0 0 1 3.2 0V11M10.2 10.5V7.4a1.6 1.6 0 0 1 3.2 0v3.1M13.4 10.5V8a1.6 1.6 0 0 1 3.2 0v5.5c0 4-2.6 6.5-5.8 6.5S5.5 18 5.5 15v-1.8A1.6 1.6 0 0 1 7 11.6h2.5',
  // Escudo con cruz
  Paladín: 'M12 3l7 2.5V12c0 4.2-3 7.3-7 9-4-1.7-7-4.8-7-9V5.5zM12 7.5v10M8.5 11h7',
  // Daga
  Pícaro: 'M19.5 4.5L11 13l-2-2 8.5-8.5zM12 14l-2 2-2-2 2-2M8.5 15.5L4 20M7 10.5l6.5 6.5',
};

/**
 * Icono de una clase (por nombre guardado, también en femenino); nada si no es una de las 12.
 * Decorativo: va junto al nombre escrito, así que los lectores de pantalla no lo repiten.
 */
export function IconoClase({ clase, tam = 16, className = '' }: { clase: string; tam?: number; className?: string }) {
  const c = claseDe(clase);
  if (!c) return null;
  return (
    <svg className={`icono-clase ${className}`} viewBox="0 0 24 24" width={tam} height={tam} aria-hidden="true" data-clase={c}>
      <path d={ICONO_CLASE[c]} />
    </svg>
  );
}

/** «Paladín 5 / Mago 2» con el icono de cada clase delante. */
export function ClasesConIcono({ clases, tam = 15 }: { clases: { clase: string; nivel: number }[]; tam?: number }) {
  return (
    <span className="clases-icono">
      {clases.map((c, i) => (
        <span key={i}>
          {i > 0 && <span className="clases-sep"> / </span>}
          <IconoClase clase={c.clase} tam={tam} />
          {c.clase} {c.nivel}
        </span>
      ))}
    </span>
  );
}
