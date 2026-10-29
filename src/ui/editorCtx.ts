// Contexto para abrir el editor de objetos desde cualquier pantalla (el editor vive en EditorObjeto.tsx).

import { createContext, useContext } from 'react';
import type { Objeto, Propietario, TipoObjeto } from '../domain/tipos';

export type ApiEditor = {
  nuevo: (p?: { propietario?: Propietario; tipo?: TipoObjeto }) => void;
  editar: (o: Objeto) => void;
};

export const CtxEditor = createContext<ApiEditor>({ nuevo: () => {}, editar: () => {} });
export const useEditor = () => useContext(CtxEditor);
