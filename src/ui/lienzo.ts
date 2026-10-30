// Medidas del lienzo. El diseño es de 1080 de alto y al menos 1920 de ancho: se escala para llenar el alto de la
// ventana y, si la ventana es más apaisada que 16:9 (lo normal con las barras del navegador), el lienzo se
// ensancha en vez de dejar franjas a los lados. Las pantallas reparten ese ancho extra.

import { createContext, useContext, useLayoutEffect, useState } from 'react';

export const ALTO = 1080;
export const ANCHO_MIN = 1920;
/** Más allá (pantallas ultrapanorámicas) el lienzo se centra: las filas se harían demasiado largas. */
export const ANCHO_MAX = 2560;

export interface Lienzo {
  escala: number;
  /** Ancho del lienzo en píxeles de diseño, de ANCHO_MIN a ANCHO_MAX. */
  ancho: number;
}

function medir(): Lienzo {
  const w = window.innerWidth, h = window.innerHeight;
  const escala = Math.min(h / ALTO, w / ANCHO_MIN);
  const ancho = Math.round(Math.min(ANCHO_MAX, Math.max(ANCHO_MIN, w / escala)));
  return { escala, ancho };
}

export function useMedidasLienzo() {
  const [m, setM] = useState(medir);
  useLayoutEffect(() => {
    const f = () => setM(medir());
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return m;
}

export const CtxLienzo = createContext<Lienzo>({ escala: 1, ancho: ANCHO_MIN });

export const useLienzo = () => useContext(CtxLienzo);

/** Lo que sobra respecto al diseño de 1920. */
export const useAnchoExtra = () => useLienzo().ancho - ANCHO_MIN;
