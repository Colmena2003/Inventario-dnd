// Menú desplegable de botón (las tres rayas de cada personaje, «Ordenar», «Añadir») y menú contextual.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Icono } from './piezas';

export type OpcionMenu =
  | { texto: string; icono?: string; onClick: () => void; peligro?: boolean; desactivada?: boolean }
  | { titulo: string }
  | 'separador';

export function ListaMenu({ opciones, onCerrar, style, className = '' }: {
  opciones: OpcionMenu[];
  onCerrar: () => void;
  style?: CSSProperties;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fuera = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onCerrar(); };
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    // En el siguiente tic, para no cerrar con el mismo clic que lo abre
    const t = setTimeout(() => window.addEventListener('pointerdown', fuera));
    window.addEventListener('keydown', tecla);
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    return () => { clearTimeout(t); window.removeEventListener('pointerdown', fuera); window.removeEventListener('keydown', tecla); };
  }, [onCerrar]);
  return (
    <div ref={ref} role="menu" className={`panel menu ${className}`} style={style}>
      {opciones.map((o, i) =>
        o === 'separador' ? <hr key={i} /> :
        'titulo' in o ? <span key={i} className="menu-titulo">{o.titulo}</span> : (
          <button
            key={i} type="button" role="menuitem" className={o.peligro ? 'peligro' : ''} disabled={o.desactivada}
            onClick={() => { onCerrar(); o.onClick(); }}
          >
            {o.icono ? <Icono d={o.icono} /> : <span className="menu-hueco" />}{o.texto}
          </button>
        ),
      )}
    </div>
  );
}

/** Botón que abre un menú debajo. `lado` decide hacia qué lado se alinea. */
export function MenuBoton({ etiqueta, opciones, children, className, lado = 'izq' }: {
  etiqueta: string;
  opciones: OpcionMenu[];
  children: ReactNode;
  className: string;
  lado?: 'izq' | 'dcha';
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <span className="menu-ancla">
      <button type="button" className={className} aria-label={etiqueta} title={etiqueta} aria-haspopup="menu" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)}>
        {children}
      </button>
      {abierto && <ListaMenu opciones={opciones} onCerrar={() => setAbierto(false)} className={lado === 'dcha' ? 'a-dcha' : ''} />}
    </span>
  );
}
