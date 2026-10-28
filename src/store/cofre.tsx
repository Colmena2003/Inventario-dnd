// Estado de la app. Hoy vive en el navegador (localStorage); cuando haya Supabase, este módulo
// es el único que cambia: las pantallas solo usan useCofre().

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { estadoInicial } from '../data/semilla';
import {
  alternarSintonia, moverObjeto, nuevoId, ordenarInventario, validarMovimiento, type CriterioOrden, type Destino, type ResultadoSintonia, type Validacion,
} from '../domain/reglas';
import { crearObjeto as crear, editarObjeto as editar, eliminarObjeto as eliminar, type DatosObjeto } from '../domain/objetos';
import { comer as comerComida, pasarDia as pasarDiaViaje } from '../domain/despensa';
import { aplicarMonedas, type Cambio, type ResultadoMonedas } from '../domain/monedas';
import { cambiarImagenFicha, completarBiblioteca, olvidar, recuperar, registrar } from '../domain/biblioteca';
import { anotarEncuentro, crearCriatura, editarCriatura, eliminarCriatura, type DatosCriatura } from '../domain/bestiario';
import type { Estado, Personaje, Propietario } from '../domain/tipos';
import { aGuardar, deGuardado } from './imagenes';

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

/** Devuelve false si no se ha podido guardar (modo privado, cuota llena): la sesión sigue en memoria. */
function guardar(clave: string, valor: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

interface Cofre {
  estado: Estado;
  /** El último guardado en el navegador falló: lo cambiado se perderá al cerrar. */
  sinGuardar: boolean;
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
  /** Biblioteca: vuelve a crear un objeto desde su ficha. */
  recuperarFicha: (fichaId: string, propietario: Propietario, cantidad: number) => Resultado;
  olvidarFicha: (fichaId: string) => Resultado;
  cambiarImagenFicha: (fichaId: string, url: string | undefined) => void;
  /** Bestiario. Crear devuelve el id de la criatura nueva. */
  guardarCriatura: (id: string | undefined, datos: DatosCriatura) => { ok: true; id: string } | { ok: false; motivo: string };
  eliminarCriatura: (id: string) => void;
  anotarEncuentro: (id: string, derrotada: boolean) => void;
  restablecer: () => void;
}

type Resultado = { ok: true } | { ok: false; motivo: string };

const Ctx = createContext<Cofre | null>(null);

export function CofreProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>(() => {
    const g = leer<Estado>(CLAVE);
    return completarBiblioteca(g ? deGuardado(g) : estadoInicial());
  });
  const [actor, setActorState] = useState<string>(() => leer<string>(CLAVE_ACTOR) ?? '');

  // Se guarda fuera del clic que lo provoca, para que soltar un objeto no espere a serializarlo todo;
  // si se cierra la página antes, se guarda en ese momento
  const pendiente = useRef<Estado | null>(null);
  const [sinGuardar, setSinGuardar] = useState(false);
  useEffect(() => {
    pendiente.current = estado;
    const t = window.setTimeout(() => {
      pendiente.current = null;
      setSinGuardar(!guardar(CLAVE, aGuardar(estado)));
    }, 250);
    return () => window.clearTimeout(t);
  }, [estado]);
  useEffect(() => {
    const ya = () => { if (pendiente.current) guardar(CLAVE, aGuardar(pendiente.current)); pendiente.current = null; };
    window.addEventListener('pagehide', ya);
    return () => window.removeEventListener('pagehide', ya);
  }, []);

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
    setEstado(registrar(r.estado, r.id));
    return { ok: true };
  }, [estado, actor]);

  const editarObjeto = useCallback((id: string, datos: DatosObjeto): Resultado => {
    const r = editar(estado, id, datos);
    if (!r.ok) return r;
    setEstado(registrar(r.estado, id));
    return { ok: true };
  }, [estado]);

  // Antes de borrarlo, su ficha apunta quién lo tuvo por última vez
  const eliminarObjeto = useCallback((id: string) => setEstado((e) => eliminar(registrar(e, id), id)), []);

  const recuperarFicha = useCallback((fichaId: string, propietario: Propietario, cantidad: number): Resultado => {
    const r = recuperar(estado, fichaId, propietario, cantidad, actor);
    if (!r.ok) return r;
    setEstado(r.estado);
    return { ok: true };
  }, [estado, actor]);

  const olvidarFicha = useCallback((fichaId: string): Resultado => {
    const r = olvidar(estado, fichaId);
    if (!r.ok) return r;
    setEstado(r.estado);
    return { ok: true };
  }, [estado]);

  const cambiarImagenFichaCb = useCallback((fichaId: string, url: string | undefined) => setEstado((e) => cambiarImagenFicha(e, fichaId, url)), []);

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

  const guardarCriatura = useCallback((id: string | undefined, datos: DatosCriatura) => {
    const r = id ? editarCriatura(estado, id, datos) : crearCriatura(estado, datos, actor);
    if (!r.ok) return r;
    setEstado(r.estado);
    return { ok: true as const, id: r.id };
  }, [estado, actor]);
  const eliminarCriaturaCb = useCallback((id: string) => setEstado((e) => eliminarCriatura(e, id)), []);
  const anotarEncuentroCb = useCallback((id: string, derrotada: boolean) => setEstado((e) => anotarEncuentro(e, id, derrotada)), []);

  const restablecer = useCallback(() => setEstado(completarBiblioteca(estadoInicial())), []);

  const valor = useMemo(
    () => ({ estado, sinGuardar, actor, setActor, validar, mover, sintonizar, monedas, comer, pasarDia, cambiarImagen, crearObjeto, editarObjeto, eliminarObjeto, ordenar, editarPersonaje, crearPersonaje, eliminarPersonaje, recuperarFicha, olvidarFicha, cambiarImagenFicha: cambiarImagenFichaCb, guardarCriatura, eliminarCriatura: eliminarCriaturaCb, anotarEncuentro: anotarEncuentroCb, restablecer }),
    [guardarCriatura, eliminarCriaturaCb, anotarEncuentroCb, recuperarFicha, olvidarFicha, cambiarImagenFichaCb, sinGuardar, estado, actor, setActor, validar, mover, sintonizar, monedas, comer, pasarDia, cambiarImagen, crearObjeto, editarObjeto, eliminarObjeto, ordenar, editarPersonaje, crearPersonaje, eliminarPersonaje, restablecer],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useCofre() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCofre fuera de CofreProvider');
  return c;
}
