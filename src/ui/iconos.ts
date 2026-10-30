// Iconos de la interfaz: trazos de línea (viewBox 24×24) de diseno/Main.dc.html y Topbar.dc.html. Los de los
// objetos, las clases y el bestiario son de game-icons.net (iconosJuego.ts).

import { capital } from '../domain/reglas';

import { ICONOS, type ClaveIcono } from './iconosJuego';

export { ICONOS, type ClaveIcono };

/** Qué es cada icono, en palabras: se ve al elegirlo y en el objeto si no tiene una clase más concreta. */
export const NOMBRE_ICONO: Record<ClaveIcono, string> = {
  sword: 'Espada', axe: 'Hacha', bow: 'Arco', staff: 'Bastón', dagger: 'Daga', shield: 'Escudo',
  helm: 'Casco', armor: 'Armadura', cloak: 'Capa', gloves: 'Guantes', boots: 'Botas', amulet: 'Amuleto',
  ring: 'Anillo', potion: 'Poción', scroll: 'Pergamino', book: 'Libro', key: 'Llave', gem: 'Gema',
  herb: 'Hierba', ore: 'Mineral', fang: 'Colmillo', bread: 'Pan', meat: 'Carne', apple: 'Fruta',
  flask: 'Frasco', hammer: 'Martillo', bag: 'Bolsa', torch: 'Antorcha', drop: 'Gota', mushroom: 'Seta',
};

/** «Casco», «Ración»…: la clase del objeto si la tiene; si no, lo que dice su icono. */
export const claseDe = (o: { subtipo?: string; icono?: string; categoria?: string }) => {
  return capital(o.subtipo || NOMBRE_ICONO[o.icono as ClaveIcono] || o.categoria || '');
};

// Iconos de interfaz
export const UI = {
  menu: 'M5 7h14M5 12h14M5 17h14',
  camara: 'M4 8h3.5L9 5.5h6L16.5 8H20v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  cuenco: 'M3 11h18a9 9 0 0 1-18 0zM9 8V4M12 8V3M15 8V4',
  peso: 'M7 9h10l3 11H4zM9 9a3 3 0 0 1 6 0',
  cofre: 'M3 11h18v9H3zM3 11a9 6 0 0 1 18 0M10.5 13h3v3.5h-3zM3 15h7.5M13.5 15H21',
  lupa: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16 16l4.5 4.5',
  filtro: 'M4 5h16l-6 7v6l-4 2v-8z',
  mas: 'M12 5v14M5 12h14',
  menos: 'M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7',
  cruz: 'M6 6l12 12M18 6L6 18',
  flecha: 'M2 10h34M28 3l8 7-8 7',
  lapiz: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  papelera: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10.5 11v5M13.5 11v5',
  persona: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5',
  ordenar: 'M7 4v16M4 17l3 3 3-3M14 6h6M14 11h4M14 16h2',
  calavera: 'M12 3a8 8 0 0 0-8 8c0 2.8 1.4 4.9 3.5 6v3h9v-3c2.1-1.1 3.5-3.2 3.5-6a8 8 0 0 0-8-8zM9 10.5a1.6 1.6 0 1 0 0 .1M15 10.5a1.6 1.6 0 1 0 0 .1M12 13.5l-1 2h2zM10 20v-2.5M14 20v-2.5',
  garra: 'M5 20c2-5 2-10 0-16M10 20c1.5-5 1.5-10 0-16M15 20c1-5 3-9 6-12',
  biblioteca: 'M5 5.5A1.5 1.5 0 0 1 6.5 4H19v13H6.5A1.5 1.5 0 0 0 5 18.5zM5 18.5A1.5 1.5 0 0 0 6.5 20H19v-3M12 7.5l1.2 2 2.3.3-1.7 1.6.4 2.3-2.2-1.1-2.2 1.1.4-2.3-1.7-1.6 2.3-.3z',
  escudoCa: 'M12 3l7 2.5V12c0 4.2-3 7.3-7 9-4-1.7-7-4.8-7-9V5.5z',
  corazon: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  mano: 'M12 13V5.5a1.5 1.5 0 0 1 3 0V12M15 7.5a1.5 1.5 0 0 1 3 0v6c0 4-2.5 7-6.5 7S5 17.5 5 14v-2.5a1.5 1.5 0 0 1 3 0V13M9 12V4.5a1.5 1.5 0 0 1 3 0',
  rayo: 'M13 2L4 14h7l-1 8 9-12h-7z',
  enlace: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  engranaje: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM10.6 3h2.8l.5 2.4 1.6.9 2.3-.8 1.4 2.4-1.8 1.6v1.9l1.8 1.6-1.4 2.4-2.3-.8-1.6.9-.5 2.4h-2.8l-.5-2.4-1.6-.9-2.3.8-1.4-2.4 1.8-1.6v-1.9L4.8 7.9l1.4-2.4 2.3.8 1.6-.9z',
};

export const ESQUINA = 'M2 28V10L10 2h18M6 24V12l6-6h12M2 10h5M10 2v5';
