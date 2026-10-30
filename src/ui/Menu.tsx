// Menús: el de clic derecho (flotante, donde está el puntero) y el de un botón (anclado debajo de él).

import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { Icono } from './piezas';

export type OpcionMenu =
  | { texto: string; icono?: string; onClick: () => void; peligro?: boolean; desactivada?: boolean }
  | { titulo: string }
  | 'separador';

/** Cierra un desplegable al pulsar fuera de `ref` o con Escape. */
export function useCerrarFuera(ref: RefObject<HTMLElement>, abierto: boolean, onCerrar: () => void) {
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onCerrar(); };
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    // Se espera un ciclo para que el mismo clic que lo abre no lo cierre
    const t = setTimeout(() => window.addEventListener('pointerdown', fuera));
    window.addEventListener('keydown', tecla);
    return () => { clearTimeout(t); window.removeEventListener('pointerdown', fuera); window.removeEventListener('keydown', tecla); };
  }, [ref, abierto, onCerrar]);
}

function ListaMenu({ opciones, onCerrar, className = '', style }: { opciones: OpcionMenu[]; onCerrar: () => void; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useCerrarFuera(ref, true, onCerrar);
  useEffect(() => { ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus(); }, []);
  return (
    <div ref={ref} role="menu" className={`panel menu ${className}`} style={style}>
      {opciones.map((o, i) => (o === 'separador' ? <hr key={i} />
        : 'titulo' in o ? <span key={i} className="menu-titulo">{o.titulo}</span>
        : (
          <button key={i} type="button" role="menuitem" className={o.peligro ? 'peligro' : ''} disabled={o.desactivada} onClick={() => { onCerrar(); o.onClick(); }}>
            {o.icono ? <Icono d={o.icono} /> : <span className="menu-hueco" />}{o.texto}
          </button>
        )))}
    </div>
  );
}

/** Botón que abre un menú debajo. */
export function BotonMenu({ etiqueta, opciones, children, className, lado = 'izq' }: {
  etiqueta: string; opciones: OpcionMenu[]; children: ReactNode; className?: string; lado?: 'izq' | 'dcha';
}) {
  const [abierto, setAbierto] = useState(false);
  const cerrar = useCallback(() => setAbierto(false), []);
  return (
    <span className="menu-ancla">
      <button type="button" className={className} aria-label={etiqueta} title={etiqueta} aria-haspopup="menu" aria-expanded={abierto} onClick={() => setAbierto((x) => !x)}>
        {children}
      </button>
      {abierto && <ListaMenu opciones={opciones} onCerrar={cerrar} className={lado === 'dcha' ? 'a-dcha' : ''} />}
    </span>
  );
}

// ── Menú de clic derecho ───────────────────────────────────────────

type Abierto = { opciones: OpcionMenu[]; left: number; top: number };
const Ctx = createContext<(e: { clientX: number; clientY: number }, opciones: OpcionMenu[]) => void>(() => {});

/** Abre un menú en la posición del puntero. */
export const useMenuContextual = () => useContext(Ctx);

const ANCHO = 260;

export function MenuProvider({ lienzo, escala, children }: { lienzo: RefObject<HTMLDivElement>; escala: number; children: ReactNode }) {
  const [abierto, setAbierto] = useState<Abierto | null>(null);
  const abrir = useCallback((e: { clientX: number; clientY: number }, opciones: OpcionMenu[]) => {
    const base = lienzo.current?.getBoundingClientRect();
    if (!base) return;
    const x = (e.clientX - base.left) / escala, y = (e.clientY - base.top) / escala;
    // Que no se salga del lienzo de 1920×1080
    const alto = opciones.reduce((s, o) => s + (o === 'separador' ? 11 : 'titulo' in (o as object) ? 30 : 36), 12);
    setAbierto({ opciones, left: Math.min(x, 1920 - ANCHO - 8), top: Math.min(y, 1080 - alto - 8) });
  }, [lienzo, escala]);
  const cerrar = useCallback(() => setAbierto(null), []);
  return (
    <Ctx.Provider value={abrir}>
      {children}
      {abierto && <ListaMenu opciones={abierto.opciones} onCerrar={cerrar} className="flotante" style={{ left: abierto.left, top: abierto.top, minWidth: ANCHO }} />}
    </Ctx.Provider>
  );
}
