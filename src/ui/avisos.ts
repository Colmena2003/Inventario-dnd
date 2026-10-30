// Contexto para enseñar un aviso en el pie desde cualquier pantalla (lo pinta App).

import { createContext, useContext } from 'react';

export type Avisar = (texto: string, error?: boolean) => void;

export const CtxAvisar = createContext<Avisar>(() => {});
export const useAvisar = () => useContext(CtxAvisar);

/** Avisa del resultado de usar un objeto; si tira dados, cuando se paran (antes destriparía el número). */
export function avisarUso(avisar: Avisar, r: { ok: true; texto: string; tras?: Promise<void> } | { ok: false; motivo: string }) {
  if (!r.ok) avisar(r.motivo, true);
  else if (r.tras) void r.tras.then(() => avisar(r.texto));
  else avisar(r.texto);
}
