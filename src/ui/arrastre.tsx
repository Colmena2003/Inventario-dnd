// Arrastrar y soltar con eventos de puntero. Los destinos se marcan con data-drop:
//   "alijo" · "pj:<id>" (inventario) · "pj:<id>:<ranura>:<indice>" (ranura de equipo)
//   "alijo#<celda>" · "pj:<id>#<celda>" (una celda concreta de la rejilla) · "comer:<id>" (darle de comer)
// Pulsar y soltar sin mover es un clic: llama a `alTocar`.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type PointerEvent as RPE } from 'react';
import { createPortal } from 'react-dom';
import type { Destino } from '../domain/reglas';
import type { Objeto, TipoRanura } from '../domain/tipos';
import { Ranura } from './piezas';

/** Dónde se suelta: un destino de movimiento o, en la despensa, el personaje que se lo come. */
export type Objetivo = { clave: string; destino: Destino | null; comer?: string };

export interface Arrastre {
  objeto: Objeto;
  x: number;
  y: number;
  shift: boolean;
  objetivo: Objetivo | null;
  /** Elemento bajo el puntero */
  celda: Element | null;
}

interface Ctx {
  arrastre: Arrastre | null;
  empezar: (e: RPE, objeto: Objeto, alTocar?: () => void) => void;
}

const C = createContext<Ctx>({ arrastre: null, empezar: () => {} });
export const useArrastre = () => useContext(C);

export function parsearDestino(clave: string): Destino | null {
  const [base, celda] = clave.split('#');
  const posicion = celda !== undefined && celda !== '' ? Number(celda) : undefined;
  if (base === 'alijo') return { propietario: { tipo: 'alijo' }, posicion };
  const [t, id, ranura, indice] = base.split(':');
  if (t !== 'pj' || !id) return null;
  return {
    propietario: { tipo: 'personaje', id },
    equipar: ranura ? { ranura: ranura as TipoRanura, indice: Number(indice) } : undefined,
    posicion: ranura ? undefined : posicion,
  };
}

/** Dueño de una clave de destino sin la celda: "pj:<id>#3" → "pj:<id>". */
export const baseDe = (clave: string) => clave.split('#')[0];
export const celdaDe = (clave: string) => { const c = clave.split('#')[1]; return c === undefined ? undefined : Number(c); };

function objetivoEn(x: number, y: number): { objetivo: Objetivo | null; celda: Element | null } {
  const el = document.elementFromPoint(x, y);
  const zona = el?.closest('[data-drop]');
  const clave = zona?.getAttribute('data-drop');
  if (clave?.startsWith('comer:')) return { objetivo: { clave, destino: null, comer: clave.slice(6) }, celda: el };
  const destino = clave ? parsearDestino(clave) : null;
  return { objetivo: clave && destino ? { clave, destino } : null, celda: el };
}

export function ArrastreProvider({ escala, onSoltar, children }: {
  escala: number;
  onSoltar: (objeto: Objeto, objetivo: Objetivo, dividir: boolean) => void;
  children: ReactNode;
}) {
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const ref = useRef<Arrastre | null>(null);
  const soltarRef = useRef(onSoltar);
  soltarRef.current = onSoltar;

  const fijar = (a: Arrastre | null) => {
    ref.current = a;
    setArrastre(a);
  };

  const empezar = useCallback((e: RPE, objeto: Objeto, alTocar?: () => void) => {
    if (e.button !== 0) return;
    const x0 = e.clientX, y0 = e.clientY;
    let activo = false;

    const mover = (ev: PointerEvent) => {
      if (!activo && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
      activo = true;
      fijar({ objeto, x: ev.clientX, y: ev.clientY, shift: ev.shiftKey, ...objetivoEn(ev.clientX, ev.clientY) });
    };
    const fin = (ev: PointerEvent) => {
      limpiar();
      const a = ref.current;
      fijar(null);
      if (activo && a?.objetivo) soltarRef.current(a.objeto, a.objetivo, ev.shiftKey);
      else if (!activo) alTocar?.();
    };
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        limpiar();
        fijar(null);
      } else if (ev.key === 'Shift' && ref.current) {
        fijar({ ...ref.current, shift: ev.type === 'keydown' });
      }
    };
    const limpiar = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', fin);
      window.removeEventListener('keydown', tecla);
      window.removeEventListener('keyup', tecla);
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', fin);
    window.addEventListener('keydown', tecla);
    window.addEventListener('keyup', tecla);
  }, []);

  useEffect(() => {
    document.body.style.cursor = arrastre ? 'grabbing' : '';
  }, [arrastre]);

  const lado = 44 * escala;
  return (
    <C.Provider value={{ arrastre, empezar }}>
      {children}
      {arrastre &&
        createPortal(
          <Ranura
            objeto={arrastre.objeto}
            extra="dragging"
            aria-hidden="true"
            style={{ left: arrastre.x - lado / 2, top: arrastre.y - lado / 2, width: lado, height: lado }}
          />,
          document.body,
        )}
    </C.Provider>
  );
}
