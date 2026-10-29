// Contexto para enseñar un aviso en el pie desde cualquier pantalla (lo pinta App).

import { createContext, useContext } from 'react';

export type Avisar = (texto: string, error?: boolean) => void;

export const CtxAvisar = createContext<Avisar>(() => {});
export const useAvisar = () => useContext(CtxAvisar);
