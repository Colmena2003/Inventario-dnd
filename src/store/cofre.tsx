// Estado de la app. Hoy vive en el navegador (localStorage); cuando haya Supabase, este módulo
// es el único que cambia: las pantallas solo usan useCofre().

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { estadoInicial } from '../data/semilla';
import {
  alternarSintonia, moverObjeto, nuevoId, ordenarInventario, validarMovimiento, type CriterioOrden, type Destino, type ResultadoSintonia, type Validacion,
} from '../domain/reglas';
import { crearObjeto as crear, editarObjeto as editar, eliminarObjeto as eliminar, type DatosObjeto } from '../domain/objetos';
import { comer as comerComida, pasarDia as pasarDiaViaje } from '../domain/despensa';
import { aplicarMonedas, type Cambio, type ResultadoMonedas } from '../domain/monedas';
import type { Estado, Personaje, Propietario } from '../domain/tipos';

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
  comer: (personajeId: string, claveComida: string) => { ok: true; texto: string } | { ok: false; motivo: string };
  pasarDia: () => void;
  cambiarImagen: (personajeId: string, url: string) => void;
  crearObjeto: (datos: DatosObjeto) => Resultado;
  editarObjeto: (id: string, datos: DatosObjeto) => Resultado;
  eliminarObjeto: (id: string) => void;
  ordenar: (dueno: Propietario, criterio: CriterioOrden) => void;
  editarPersonaje: (id: string, cambios: Partial<Personaje>) => void;
  crearPersonaje: (datos: Omit<Personaje, 'id'>) => void;
  eliminarPersonaje: (id: string) => void;
  restablecer: () => void;
}

type Resultado = { ok: true } | { ok: false; motivo: string };

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

  const comer = useCallback(
    (personajeId: string, claveComida: string) => {
      const r = comerComida(estado, personajeId, claveComida);
      if (!r.ok) return r;
      setEstado(r.estado);
      return { ok: true as const, texto: r.texto };
    },
    [estado],
  );

  const pasarDia = useCallback(() => setEstado((e) => pasarDiaViaje(e)), []);

  const cambiarImagen = useCallback((personajeId: string, url: string) => {
    setEstado((e) => ({ ...e, personajes: e.personajes.map((p) => (p.id === personajeId ? { ...p, imagenUrl: url } : p)) }));
  }, []);

  const crearObjeto = useCallback((datos: DatosObjeto): Resultado => {
    const r = crear(estado, datos, actor);
    if (!r.ok) return r;
    setEstado(r.estado);
    return { ok: true };
  }, [estado, actor]);

  const editarObjeto = useCallback((id: string, datos: DatosObjeto): Resultado => {
    const r = editar(estado, id, datos);
    if (!r.ok) return r;
    setEstado(r.estado);
    return { ok: true };
  }, [estado]);

  const eliminarObjeto = useCallback((id: string) => setEstado((e) => eliminar(e, id)), []);

  const ordenar = useCallback((dueno: Propietario, criterio: CriterioOrden) => setEstado((e) => ordenarInventario(e, dueno, criterio)), []);

  const editarPersonaje = useCallback((id: string, cambios: Partial<Personaje>) => {
    setEstado((e) => ({ ...e, personajes: e.personajes.map((p) => (p.id === id ? { ...p, ...cambios, id: p.id } : p)) }));
  }, []);

  const crearPersonaje = useCallback((datos: Omit<Personaje, 'id'>) => {
    setEstado((e) => ({ ...e, personajes: [...e.personajes, { ...datos, id: nuevoId('pj') }] }));
  }, []);

  // Lo que llevaba pasa al alijo, desequipado y sin sintonizar
  const eliminarPersonaje = useCallback((id: string) => {
    setEstado((e) => ({
      ...e,
      personajes: e.personajes.filter((p) => p.id !== id),
      objetos: e.objetos.map((o) => (o.propietario.tipo === 'personaje' && o.propietario.id === id
        ? { ...o, propietario: { tipo: 'alijo' }, equipadoEn: null, sintonizado: false, posicion: undefined } : o)),
    }));
  }, []);

  const restablecer = useCallback(() => setEstado(estadoInicial()), []);

  const valor = useMemo(
    () => ({ estado, actor, setActor, validar, mover, sintonizar, monedas, comer, pasarDia, cambiarImagen, crearObjeto, editarObjeto, eliminarObjeto, ordenar, editarPersonaje, crearPersonaje, eliminarPersonaje, restablecer }),
    [estado, actor, setActor, validar, mover, sintonizar, monedas, comer, pasarDia, cambiarImagen, crearObjeto, editarObjeto, eliminarObjeto, ordenar, editarPersonaje, crearPersonaje, eliminarPersonaje, restablecer],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useCofre() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCofre fuera de CofreProvider');
  return c;
}
