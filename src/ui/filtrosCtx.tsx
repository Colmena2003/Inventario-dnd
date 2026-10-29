// Estado de los filtros de búsqueda de la barra superior, compartido por todas las rejillas.

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { SIN_FILTROS, type Filtros } from '../domain/filtros';

type Ctx = { filtros: Filtros; setFiltros: (f: Filtros) => void };
const C = createContext<Ctx>({ filtros: SIN_FILTROS, setFiltros: () => {} });
export const useFiltros = () => useContext(C);

export function FiltrosProvider({ children }: { children: ReactNode }) {
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS);
  const valor = useMemo(() => ({ filtros, setFiltros }), [filtros]);
  return <C.Provider value={valor}>{children}</C.Provider>;
}
