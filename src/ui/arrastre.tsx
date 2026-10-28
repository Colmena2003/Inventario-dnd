// Arrastrar y soltar con eventos de puntero. Los destinos se marcan con data-drop:
//   "alijo" · "pj:<id>" (inventario) · "pj:<id>:<ranura>:<indice>" (ranura de equipo)
//   · "alijo#<celda>" y "pj:<id>#<celda>" (una celda concreta del inventario, para ordenarlo a mano)
//   · "comer:<id>" (fila de la despensa: el personaje se come lo que se suelta; no tiene Destino)

import {
  createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useSyncExternalStore, type ReactNode, type PointerEvent as RPE,
} from 'react';
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

// El arrastre vive en un almacén fuera de React: cada pieza se suscribe solo a lo que pinta
// (useArrastreSel), así coger un objeto no re-renderiza todas las columnas y ranuras.
type Almacen = { actual: Arrastre | null; subs: Set<() => void> };

interface Api {
  /** `onClic`: se llama si se suelta sin haber llegado a arrastrar. */
  empezar: (e: RPE, objeto: Objeto, onClic?: () => void) => void;
  actual: () => Arrastre | null;
  suscribir: (f: () => void) => () => void;
}

const SIN_ARRASTRE: Api = { empezar: () => {}, actual: () => null, suscribir: () => () => {} };
const C = createContext<Api>(SIN_ARRASTRE);

/** Funciones estables del arrastre; no re-renderiza al coger o soltar. */
export const useArrastreApi = () => useContext(C);

/** Re-renderiza solo cuando cambia lo que devuelve `sel` (un valor primitivo o una referencia estable). */
export function useArrastreSel<T>(sel: (a: Arrastre | null) => T): T {
  const api = useContext(C);
  return useSyncExternalStore(api.suscribir, () => sel(api.actual()));
}

/** ¿El objetivo `clave` está dentro de la zona `base` («pj:id» abarca sus celdas y ranuras de equipo)? */
export const dentroDe = (clave: string | undefined, base: string) =>
  !!clave && (clave === base || clave.startsWith(`${base}#`) || clave.startsWith(`${base}:`));

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
  const almacen = useRef<Almacen>({ actual: null, subs: new Set() }).current;
  const soltarRef = useRef(onSoltar);
  soltarRef.current = onSoltar;
  // La posición no pasa por React: se mueve el fantasma directamente
  const pos = useRef({ x: 0, y: 0 });
  const fantasma = useRef<HTMLDivElement>(null);
  const lado = 44 * escala;
  const ladoRef = useRef(lado);
  ladoRef.current = lado;

  const colocar = useCallback(() => {
    const el = fantasma.current;
    if (el) el.style.transform = `translate3d(${pos.current.x - ladoRef.current / 2}px, ${pos.current.y - ladoRef.current / 2}px, 0)`;
  }, []);

  const api = useMemo<Api>(() => {
    // Sin cambiar el cursor de la página: recalcularía los estilos de todo al coger y al soltar
    const fijar = (a: Arrastre | null) => {
      almacen.actual = a;
      almacen.subs.forEach((f) => f());
    };

    const empezar = (e: RPE, objeto: Objeto, onClic?: () => void) => {
      if (e.button !== 0) return;
      const x0 = e.clientX, y0 = e.clientY;
      let activo = false;
      let marco = 0;

      const actualizar = (x: number, y: number, shift: boolean) => {
        marco = 0;
        pos.current = { x, y };
        colocar();
        // Solo se avisa cuando cambia algo que se ve: la zona de destino o Mayús
        const { objetivo, zona } = objetivoEn(x, y);
        const a = almacen.actual;
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
        if (!activo) {
          onClic?.();
          return;
        }
        actualizar(ev.clientX, ev.clientY, ev.shiftKey);
        const a = almacen.actual;
        fijar(null);
        if (a?.objetivo) soltarRef.current(a.objeto, a.objetivo, ev.shiftKey);
      };
      const tecla = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') {
          limpiar();
          fijar(null);
        } else if (ev.key === 'Shift' && almacen.actual) {
          fijar({ ...almacen.actual, shift: ev.type === 'keydown' });
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
    };

    return {
      empezar,
      actual: () => almacen.actual,
      suscribir: (f) => {
        almacen.subs.add(f);
        return () => almacen.subs.delete(f);
      },
    };
  }, [almacen, colocar]);

  return (
    <C.Provider value={api}>
      {children}
      <Fantasma refEl={fantasma} lado={lado} colocar={colocar} />
    </C.Provider>
  );
}

/** El objeto que sigue al puntero. Solo se re-renderiza al empezar y acabar un arrastre. */
function Fantasma({ refEl, lado, colocar }: { refEl: React.RefObject<HTMLDivElement>; lado: number; colocar: () => void }) {
  const objeto = useArrastreSel((a) => a?.objeto ?? null);
  useLayoutEffect(colocar, [objeto, lado, colocar]);
  if (!objeto) return null;
  return createPortal(
    <div ref={refEl} className="arrastre-fantasma">
      <Ranura objeto={objeto} extra="dragging" aria-hidden="true" style={{ width: lado, height: lado }} />
    </div>,
    document.body,
  );
}
