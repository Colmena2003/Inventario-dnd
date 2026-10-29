// Estado de la app. Hoy vive en el navegador (localStorage); cuando haya Supabase, este módulo
// es el único que cambia: las pantallas solo usan useCofre().

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { estadoInicial } from '../data/semilla';
import { crearObjeto, editarObjeto, eliminarObjeto, migrar, validarObjeto } from '../domain/objetos';
import {
  alternarSintonia, cambiarSaciedad, comer as comerRegla, descansar as descansarRegla, moverObjeto, validarMovimiento,
  type Destino, type ResultadoComer, type ResultadoSintonia, type Validacion,
} from '../domain/reglas';
import { aplicarMonedas, type Cambio, type ResultadoMonedas } from '../domain/monedas';
import type { Estado, Objeto } from '../domain/tipos';

type SinEstado<T> = T extends { estado: Estado } ? Omit<T, 'estado'> : T;

const CLAVE = 'cofre:estado:v2';
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
  sintonizar: (objetoId: string, sustituir?: string) => SinEstado<ResultadoSintonia>;
  monedas: (cambios: Cambio[], descripcion: string) => SinEstado<ResultadoMonedas>;
  cambiarImagen: (personajeId: string, url: string) => void;
  /** Crea (sin id) o guarda (con id) un objeto; devuelve el motivo si no se puede. */
  guardarObjeto: (o: Objeto, nuevo: boolean) => string | null;
  eliminarObjeto: (id: string) => void;
  comer: (personajeId: string, objetoId: string) => SinEstado<ResultadoComer>;
  cambiarSaciedad: (ids: string[], delta: number) => void;
  descansar: (ids: string[], tipo: 'corto' | 'largo') => { hechos: string[]; bloqueados: string[] };
  restablecer: () => void;
}

const Ctx = createContext<Cofre | null>(null);

export function CofreProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>(() => {
    const guardado = leer<Estado>(CLAVE);
    return guardado ? migrar(guardado, estadoInicial()) : estadoInicial();
  });
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

  const sintonizar = useCallback(
    (objetoId: string, sustituir?: string): SinEstado<ResultadoSintonia> => {
      const r = alternarSintonia(estado, objetoId, sustituir);
      if (!r.ok) return r;
      setEstado(r.estado);
      return { ok: true };
    },
    [estado],
  );

  const monedas = useCallback(
    (cambios: Cambio[], descripcion: string): SinEstado<ResultadoMonedas> => {
      const r = aplicarMonedas(estado, cambios, actor || 'Alguien', descripcion);
      if (!r.ok) return r;
      setEstado(r.estado);
      return { ok: true };
    },
    [estado, actor],
  );

  const cambiarImagen = useCallback((personajeId: string, url: string) => {
    setEstado((e) => ({ ...e, personajes: e.personajes.map((p) => (p.id === personajeId ? { ...p, imagenUrl: url } : p)) }));
  }, []);

  const guardarObjeto = useCallback((o: Objeto, nuevo: boolean) => {
    const motivo = validarObjeto(estado, o);
    if (motivo) return motivo;
    setEstado((e) => (nuevo ? crearObjeto(e, o, actor || 'Alguien') : editarObjeto(e, o, actor || 'Alguien')));
    return null;
  }, [estado, actor]);

  const eliminar = useCallback((id: string) => setEstado((e) => eliminarObjeto(e, id)), []);

  const comer = useCallback((personajeId: string, objetoId: string): SinEstado<ResultadoComer> => {
    const r = comerRegla(estado, personajeId, objetoId);
    if (!r.ok) return r;
    setEstado(r.estado);
    return { ok: true, antes: r.antes, despues: r.despues };
  }, [estado]);

  const saciedad = useCallback((ids: string[], delta: number) => setEstado((e) => cambiarSaciedad(e, ids, delta)), []);

  const descansar = useCallback((ids: string[], tipo: 'corto' | 'largo') => {
    const r = descansarRegla(estado, ids, tipo);
    setEstado(r.estado);
    return { hechos: r.hechos, bloqueados: r.bloqueados };
  }, [estado]);

  const restablecer = useCallback(() => setEstado(estadoInicial()), []);

  const valor = useMemo(
    () => ({
      estado, actor, setActor, validar, mover, sintonizar, monedas, cambiarImagen, guardarObjeto, eliminarObjeto: eliminar,
      comer, cambiarSaciedad: saciedad, descansar, restablecer,
    }),
    [estado, actor, setActor, validar, mover, sintonizar, monedas, cambiarImagen, guardarObjeto, eliminar, comer, saciedad, descansar, restablecer],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useCofre() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCofre fuera de CofreProvider');
  return c;
}
