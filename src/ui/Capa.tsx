// Pinta un diálogo directamente en el lienzo, aunque se declare dentro de un panel con
// posición propia (la ficha, el bestiario, las monedas): así se centra en la pantalla y no lo recorta nadie.

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Capa({ children }: { children: ReactNode }) {
  const lienzo = document.querySelector('.lienzo');
  return lienzo ? createPortal(children, lienzo) : <>{children}</>;
}
