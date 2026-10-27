// Estado de la app. Hoy vive en el navegador (localStorage); cuando haya Supabase, este módulo
// es el único que cambia: las pantallas solo usan useCofre().

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { estadoInicial } from '../data/semilla';
import { moverObjeto, validarMovimiento, type Destino, type Validacion } from '../domain/reglas';
import type { Estado } from '../domain/tipos';

const CLAVE = 'cofre:estado:v1';
const CLAVE_ACTOR = 'cofre:actor';

function leer<T>(clave: string): T | null {
  try {
    const s = localStorage.getItem(clave);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}

function guardar(clave: string, valor: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Sin almacenamiento (modo privado, cuota llena): la sesión sigue funcionando en memoria.
  }
}

interface Cofre {
  estado: Estado;
  actor: string;
  setActor: (nombre: string) => void;
  validar: (objetoId: string, destino: Destino, cantidad?: number) => Validacion;
  mover: (objetoId: string, destino: Destino, cantidad?: number) => Validacion;
  cambiarImagen: (personajeId: string, url: string) => void;
  restablecer: () => void;
}

const Ctx = createContext<Cofre | null>(null);

export function CofreProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>(() => leer<Estado>(CLAVE) ?? estadoInicial());
  const [actor, setActorState] = useState<string>(() => leer<string>(CLAVE_ACTOR) ?? '');

  useEffect(() => guardar(CLAVE, estado), [estado]);

  const setActor = useCallback((nombre: string) => {
    setActorState(nombre);
    guardar(CLAVE_ACTOR, nombre);
  }, []);

  const validar = useCallback(
    (objetoId: string, destino: Destino, cantidad?: number) => validarMovimiento(estado, objetoId, destino, cantidad),
    [estado],
  );

  const mover = useCallback(
    (objetoId: string, destino: Destino, cantidad?: number) => {
      const v = validarMovimiento(estado, objetoId, destino, cantidad);
      if (v.ok) setEstado((e) => moverObjeto(e, objetoId, destino, actor || 'Alguien', cantidad));
      return v;
    },
    [estado, actor],
  );

  const cambiarImagen = useCallback((personajeId: string, url: string) => {
    setEstado((e) => ({ ...e, personajes: e.personajes.map((p) => (p.id === personajeId ? { ...p, imagenUrl: url } : p)) }));
  }, []);

  const restablecer = useCallback(() => setEstado(estadoInicial()), []);

  const valor = useMemo(
    () => ({ estado, actor, setActor, validar, mover, cambiarImagen, restablecer }),
    [estado, actor, setActor, validar, mover, cambiarImagen, restablecer],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useCofre() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCofre fuera de CofreProvider');
  return c;
}
