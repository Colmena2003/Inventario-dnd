// Arrastrar y soltar con eventos de puntero. Los destinos se marcan con data-drop:
//   "alijo" · "pj:<id>" (inventario) · "pj:<id>:<ranura>:<indice>" (ranura de equipo)
//   · "alijo#<celda>" y "pj:<id>#<celda>" (una celda concreta del inventario, para ordenarlo a mano)
//   · "comer:<id>" (fila de la despensa: el personaje se come lo que se suelta; no tiene Destino)

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type PointerEvent as RPE } from 'react';
import { createPortal } from 'react-dom';
import type { Destino } from '../domain/reglas';
import type { Objeto, TipoRanura } from '../domain/tipos';
import { Ranura } from './piezas';

export type Objetivo = { clave: string; destino: Destino | null };

export interface Arrastre {
  objeto: Objeto;
  shift: boolean;
  objetivo: Objetivo | null;
  /** Zona data-drop bajo el puntero */
  zona: Element | null;
}

interface Ctx {
  arrastre: Arrastre | null;
  empezar: (e: RPE, objeto: Objeto) => void;
}

const C = createContext<Ctx>({ arrastre: null, empezar: () => {} });
export const useArrastre = () => useContext(C);

/** Clave sin la celda: «pj:aldric#4» → «pj:aldric». */
export const claveBase = (clave: string) => clave.split('#')[0];
export const celdaDe = (clave: string | undefined) => {
  const c = clave?.split('#')[1];
  return c === undefined ? undefined : Number(c);
};

export function parsearDestino(clave: string): Destino | null {
  const base = claveBase(clave);
  const posicion = celdaDe(clave);
  if (base === 'alijo') return { propietario: { tipo: 'alijo' }, posicion };
  const [t, id, ranura, indice] = base.split(':');
  if (t !== 'pj' || !id) return null;
  return {
    propietario: { tipo: 'personaje', id },
    equipar: ranura ? { ranura: ranura as TipoRanura, indice: Number(indice) } : undefined,
    posicion: ranura ? undefined : posicion,
  };
}

function objetivoEn(x: number, y: number): { objetivo: Objetivo | null; zona: Element | null } {
  const zona = document.elementFromPoint(x, y)?.closest('[data-drop]') ?? null;
  const clave = zona?.getAttribute('data-drop');
  const destino = clave ? parsearDestino(clave) : null;
  const valido = !!clave && (!!destino || clave.startsWith('comer:'));
  return { objetivo: valido ? { clave: clave!, destino } : null, zona };
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
  // La posición no pasa por el estado: re-renderizar la app en cada pointermove la ralentiza.
  const pos = useRef({ x: 0, y: 0 });
  const fantasma = useRef<HTMLDivElement>(null);
  const lado = 44 * escala;
  const ladoRef = useRef(lado);
  ladoRef.current = lado;

  const colocar = () => {
    const el = fantasma.current;
    if (el) el.style.transform = `translate3d(${pos.current.x - ladoRef.current / 2}px, ${pos.current.y - ladoRef.current / 2}px, 0)`;
  };

  const fijar = (a: Arrastre | null) => {
    ref.current = a;
    setArrastre(a);
  };

  const empezar = useCallback((e: RPE, objeto: Objeto) => {
    if (e.button !== 0) return;
    const x0 = e.clientX, y0 = e.clientY;
    let activo = false;
    let marco = 0;

    const actualizar = (x: number, y: number, shift: boolean) => {
      marco = 0;
      pos.current = { x, y };
      colocar();
      // Solo se re-renderiza cuando cambia algo que se ve: la zona de destino o Mayús
      const { objetivo, zona } = objetivoEn(x, y);
      const a = ref.current;
      if (!a || a.zona !== zona || a.objetivo?.clave !== objetivo?.clave || a.shift !== shift) {
        fijar({ objeto, shift, objetivo, zona });
      }
    };
    const mover = (ev: PointerEvent) => {
      if (!activo && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
      activo = true;
      const { clientX: x, clientY: y, shiftKey } = ev;
      if (marco) cancelAnimationFrame(marco);
      marco = requestAnimationFrame(() => actualizar(x, y, shiftKey));
    };
    const fin = (ev: PointerEvent) => {
      limpiar();
      if (activo) actualizar(ev.clientX, ev.clientY, ev.shiftKey);
      const a = ref.current;
      fijar(null);
      if (activo && a?.objetivo) soltarRef.current(a.objeto, a.objetivo, ev.shiftKey);
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
      if (marco) cancelAnimationFrame(marco);
      marco = 0;
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

  const arrastrando = arrastre !== null;
  useEffect(() => {
    document.body.style.cursor = arrastrando ? 'grabbing' : '';
  }, [arrastrando]);
  useLayoutEffect(colocar, [arrastrando, lado]);

  return (
    <C.Provider value={{ arrastre, empezar }}>
      {children}
      {arrastre &&
        createPortal(
          <div ref={fantasma} className="arrastre-fantasma">
            <Ranura objeto={arrastre.objeto} extra="dragging" aria-hidden="true" style={{ width: lado, height: lado }} />
          </div>,
          document.body,
        )}
    </C.Provider>
  );
}
