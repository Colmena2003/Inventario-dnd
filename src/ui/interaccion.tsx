// Piezas que comparten la vista grupal y la individual: interacción de ranuras, ranuras de equipo y silueta.

import { useRef, useState } from 'react';
import { equipadoEn } from '../domain/reglas';
import type { Objeto, Personaje, TipoRanura } from '../domain/tipos';
import { useCofre } from '../store/cofre';
import { useArrastre } from './arrastre';
import type { ClaveIcono } from './iconos';
import { Ranura } from './piezas';
import { useTooltip } from './Tooltip';

/** Arrastre, tooltip, doble clic y atenuado por búsqueda para las ranuras con objeto. */
export function useInteraccion(busqueda: string, onDoble?: (o: Objeto) => void) {
  const { arrastre, empezar } = useArrastre();
  const { mostrar, ocultar } = useTooltip();
  const q = busqueda.trim().toLocaleLowerCase('es');
  return {
    arrastre,
    props: (o: Objeto) => ({
      onPointerDown: (e: React.PointerEvent) => { ocultar(); empezar(e, o); },
      onPointerEnter: (e: React.PointerEvent) => { if (!arrastre) mostrar(o, e.currentTarget); },
      onPointerLeave: ocultar,
      onDoubleClick: onDoble ? () => onDoble(o) : undefined,
    }),
    clase: (o: Objeto) => {
      if (arrastre?.objeto.id === o.id) return 'origin';
      if (q && !o.nombre.toLocaleLowerCase('es').includes(q)) return 'no';
      return '';
    },
  };
}

/** Rellena con ranuras vacías hasta completar filas. */
export function celdas(objetos: Objeto[], minimo: number, porFila: number) {
  const total = Math.max(minimo, Math.ceil((objetos.length + 1) / porFila) * porFila);
  return Array.from({ length: total }, (_, i) => objetos[i]);
}

export const IZQ: [TipoRanura, ClaveIcono][] = [['cabeza', 'helm'], ['capa', 'cloak'], ['armadura', 'armor'], ['guantes', 'gloves'], ['botas', 'boots']];
export const DCHA: [TipoRanura, number, ClaveIcono][] = [['amuleto', 0, 'amulet'], ['anillo', 0, 'ring'], ['anillo', 1, 'ring']];

export const nombreRanura = (r: TipoRanura) =>
  ({ cabeza: 'Cabeza', capa: 'Capa', armadura: 'Armadura', guantes: 'Guantes', botas: 'Botas', amuleto: 'Amuleto', anillo: 'Anillo', cuerpoACuerpo: 'Cuerpo a cuerpo', distancia: 'A distancia' })[r];

/** Ranura de equipo: destino de arrastre que se ilumina si el objeto que se arrastra encaja. */
export function RanuraEquipo({ p, ranura, indice, fantasma, etiqueta, busqueda, extra = '', onDoble }: {
  p: Personaje;
  ranura: TipoRanura;
  indice: number;
  fantasma: ClaveIcono;
  etiqueta?: string;
  busqueda: string;
  extra?: string;
  onDoble?: (o: Objeto) => void;
}) {
  const { estado, validar } = useCofre();
  const { arrastre, props, clase } = useInteraccion(busqueda, onDoble);
  const o = equipadoEn(estado, p.id, ranura, indice);
  const k = `pj:${p.id}:${ranura}:${indice}`;
  let marca = '';
  if (arrastre) {
    const compatible = arrastre.objeto.ranuraEquipo === ranura;
    if (arrastre.objetivo?.clave === k) {
      marca = compatible && validar(arrastre.objeto.id, { propietario: { tipo: 'personaje', id: p.id }, equipar: { ranura, indice } }).ok ? 'drop-ok' : 'drop-no';
    } else if (!compatible) marca = 'no';
  }
  if (o) return <Ranura data-drop={k} objeto={o} extra={`${extra} ${clase(o)} ${marca}`} {...props(o)} />;
  return <Ranura data-drop={k} fantasma={fantasma} etiqueta={`${etiqueta ?? nombreRanura(ranura)}: vacío`} extra={`${extra} ${marca}`} />;
}

export const SILUETA_ARMA: Partial<Record<ClaveIcono, string>> = {
  sword: 'M150 190L182 60M176 84l14 4',
  staff: 'M146 360L150 60M150 60a8 8 0 1 1 0.1 0',
  hammer: 'M52 230L30 120M22 112l18-10 6 14-18 10z',
  bow: 'M40 200c-24-40-20-110 10-150M40 200L12 60',
};

/** Silueta de relleno mientras el jugador no sube una imagen. */
export function Silueta({ tinte, id, arma, className, aura = true }: { tinte: string; id: string; arma?: string; className?: string; aura?: boolean }) {
  return (
    <svg viewBox="0 0 200 400" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={`fg-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tinte} stopOpacity=".95" />
          <stop offset=".6" stopColor={tinte} stopOpacity=".35" />
          <stop offset="1" stopColor="#0c0a08" stopOpacity=".9" />
        </linearGradient>
        <radialGradient id={`aura-${id}`} cx=".5" cy=".45" r=".55">
          <stop offset="0" stopColor={tinte} stopOpacity=".28" />
          <stop offset="1" stopColor={tinte} stopOpacity="0" />
        </radialGradient>
      </defs>
      {aura && <rect x="-40" y="0" width="280" height="400" fill={`url(#aura-${id})`} />}
      <ellipse cx="100" cy="374" rx="78" ry="13" fill="none" stroke={tinte} strokeOpacity=".45" strokeWidth="1.2" />
      <ellipse cx="100" cy="374" rx="58" ry="8" fill={tinte} opacity=".18" />
      <path d="M28 362c30-14 120-16 150 2M40 352c40-8 90-8 124 4" fill="none" stroke={tinte} strokeOpacity=".3" strokeWidth="1" />
      <path d="M68 98L38 360l40-14 12 24 10-20 10 20 12-24 40 14L132 98z" fill="#090706" opacity=".9" />
      {arma && <path d={arma} fill="none" stroke="#d8d0c0" strokeOpacity=".55" strokeWidth="2.5" strokeLinecap="round" />}
      <path
        d="M100 30c14 0 24 10 24 25s-10 26-24 26-24-11-24-26 10-25 24-25zM78 88h44l20 10 12 78-14 6-10-52-6 62 8 118h-28l-10-104-10 104H66l8-118-6-62-10 52-14-6 12-78z"
        fill={`url(#fg-${id})`} stroke={tinte} strokeOpacity=".6" strokeWidth="1"
      />
    </svg>
  );
}

const ENCUADRE_INICIAL = { x: 50, y: 20 };
const limitar = (n: number) => Math.min(100, Math.max(0, n));

/**
 * Imagen del personaje: rellena su hueco (object-fit: cover) y se puede arrastrar para elegir
 * qué parte se ve. El encuadre se guarda en el personaje al soltar.
 */
export function ImagenPersonaje({ p, className }: { p: Personaje; className: string }) {
  const { encuadrarImagen } = useCofre();
  const ref = useRef<HTMLImageElement>(null);
  const [vivo, setVivo] = useState<{ x: number; y: number } | null>(null);
  const pos = vivo ?? p.imagenEncuadre ?? ENCUADRE_INICIAL;

  const empezar = (e: React.PointerEvent<HTMLImageElement>) => {
    const img = ref.current;
    if (e.button !== 0 || !img?.naturalWidth) return;
    e.preventDefault();
    e.stopPropagation();
    // Lo que sobra de la imagen a cada lado, en píxeles de pantalla (el lienzo puede estar escalado)
    const caja = img.getBoundingClientRect();
    const k = Math.max(caja.width / img.naturalWidth, caja.height / img.naturalHeight);
    const sobraX = img.naturalWidth * k - caja.width;
    const sobraY = img.naturalHeight * k - caja.height;
    const x0 = e.clientX, y0 = e.clientY, ini = pos;
    let ultimo = ini;
    const mover = (ev: PointerEvent) => {
      ultimo = {
        x: sobraX > 0.5 ? limitar(ini.x - ((ev.clientX - x0) / sobraX) * 100) : ini.x,
        y: sobraY > 0.5 ? limitar(ini.y - ((ev.clientY - y0) / sobraY) * 100) : ini.y,
      };
      setVivo(ultimo);
    };
    const fin = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', fin);
      setVivo(null);
      if (ultimo !== ini) encuadrarImagen(p.id, { x: Math.round(ultimo.x), y: Math.round(ultimo.y) });
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', fin);
  };

  return (
    <img
      ref={ref} className={`${className} encuadrable ${vivo ? 'moviendo' : ''}`} src={p.imagenUrl} alt={`Imagen de ${p.nombre}`}
      title="Arrastra para encuadrar la imagen" draggable={false} onPointerDown={empezar}
      style={{ objectPosition: `${pos.x}% ${pos.y}%` }}
    />
  );
}

/** Reduce la imagen subida para que quepa en el almacenamiento local. */
export function reducirImagen(f: File, lado: number): Promise<string> {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, lado / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      ok(c.toDataURL('image/webp', 0.85));
    };
    img.onerror = mal;
    img.src = URL.createObjectURL(f);
  });
}
