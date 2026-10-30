// Piezas comunes del sistema visual: icono, esquinas de panel, orla, ranura y monedas.

import type { HTMLAttributes, ReactNode } from 'react';
import { CLASE_RAREZA } from '../domain/reglas';
import type { Monedas, Objeto } from '../domain/tipos';
import { ESQUINA, ICONOS, type ClaveIcono } from './iconos';

export function Icono({ d, size }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width={size} height={size}>
      <path d={d} />
    </svg>
  );
}

/** El icono de un tipo de objeto. Todos los iconos de objeto se pintan aquí. */
export function IconoObjeto({ icono, size }: { icono?: string; size?: number }) {
  return <Icono d={ICONOS[(icono ?? 'bag') as ClaveIcono] ?? ICONOS.bag} size={size} />;
}

/** El dibujo de un objeto: su imagen si la tiene; si no, su icono. */
export function ImagenObjeto({ o, alt = '' }: { o?: { imagenUrl?: string; icono?: string }; alt?: string }) {
  return o?.imagenUrl ? <img src={o.imagenUrl} alt={alt} /> : <IconoObjeto icono={o?.icono} />;
}

export function Esquinas({ solo }: { solo?: 'arriba' }) {
  const pos = solo === 'arriba' ? ['tl', 'tr'] : ['tl', 'tr', 'bl', 'br'];
  return (
    <>
      {pos.map((p) => (
        <svg key={p} className={`cn ${p}`} viewBox="0 0 30 30" aria-hidden="true">
          <path d={ESQUINA} />
          <circle cx="10" cy="10" r="1.8" fill="#b89a55" />
        </svg>
      ))}
    </>
  );
}

export function Orla({ ancho = 330 }: { ancho?: number }) {
  return (
    <svg className="orla" viewBox="0 0 330 10" width={ancho} height="10" aria-hidden="true">
      <path d="M20 5h132M178 5h132" stroke="#4d3e25" strokeWidth="1" />
      <path d="M165 1l4 4-4 4-4-4z" fill="#b89a55" />
      <path d="M156 5h2M172 5h2" stroke="#b89a55" strokeWidth="2" />
    </svg>
  );
}

type RanuraProps = HTMLAttributes<HTMLDivElement> & {
  objeto?: Objeto;
  fantasma?: ClaveIcono;
  extra?: string;
  etiqueta?: string;
  children?: ReactNode;
};

/** Una ranura de inventario o de equipo. Sin objeto, vacía; con `fantasma`, ranura de equipo libre. */
export function Ranura({ objeto, fantasma, extra = '', etiqueta, children, ...resto }: RanuraProps) {
  if (!objeto) {
    return (
      <div className={`slot ${fantasma ? 'ghost' : ''} ${extra}`} aria-label={etiqueta ?? 'Ranura vacía'} {...resto}>
        {fantasma && <IconoObjeto icono={fantasma} />}
        {children}
      </div>
    );
  }
  const nombre = objeto.nombre + (objeto.cantidad > 1 ? ` ×${objeto.cantidad}` : '');
  return (
    <div className={`slot has ${CLASE_RAREZA[objeto.rareza]} ${extra}`} aria-label={etiqueta ?? nombre} {...resto}>
      <ImagenObjeto o={objeto} />
      {objeto.cantidad > 1 && <span className="qty">{objeto.cantidad}</span>}
      {objeto.requiereSintonizacion && <span className="attm" title={objeto.sintonizado ? 'Sintonizado' : 'Requiere sintonización'} />}
      {children}
    </div>
  );
}

export const MONEDAS: { k: keyof Monedas; t: string; bg: string; fg: string }[] = [
  { k: 'ppt', t: 'PPT', bg: '#c9d3dc', fg: '#1d252c' },
  { k: 'po', t: 'PO', bg: '#d9a83c', fg: '#2b1d05' },
  { k: 'pe', t: 'PE', bg: '#bcb67a', fg: '#24210c' },
  { k: 'pp', t: 'PP', bg: '#a9adb3', fg: '#1c1e21' },
  { k: 'pc', t: 'PC', bg: '#b06d43', fg: '#24120a' },
];

export function Moneda({ t, bg, fg, tam }: { t: string; bg: string; fg: string; tam?: number }) {
  const grande = tam ? { width: tam, height: tam, fontSize: tam > 30 ? 11 : 9, boxShadow: 'inset 0 0 0 2px rgba(0,0,0,.3), 0 0 0 1px #000' } : {};
  return (
    <span className="moneda" style={{ color: fg, background: `radial-gradient(circle at 35% 30%, #fff8 0, transparent 45%), ${bg}`, ...grande }}>
      {t}
    </span>
  );
}

export { fmtNum, fmtKg as fmt1 } from '../domain/reglas';
export const iniciales = (nombre: string) => nombre.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
