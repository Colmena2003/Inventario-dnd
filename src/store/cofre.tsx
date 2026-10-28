// Estado de la app. Publicada en claude.ai, la party lo comparte en la base de datos del artefacto
// (ver compartido.ts); fuera de ahí, o hasta que alguien sube los datos, vive en el navegador
// (localStorage). Las pantallas solo usan useCofre().

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
import { Sincronizador, type Modo } from './compartido';
import { encajarImagen } from '../ui/interaccion';

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

export interface Compartido {
  /** local: sin base de datos · conectando · vacio: hay base de datos pero la party aún no ha subido sus datos · compartido */
  modo: Modo;
  soloLectura: boolean;
  /** Cambios que aún se están guardando en la base de datos compartida. */
  pendientes: number;
  /** null: la plataforma no lo ha dicho (se sabrá al intentar escribir). */
  puedeEscribir: boolean | null;
  /** Solo el dueño del artefacto sube los datos la primera vez. */
  esDueno: boolean;
  /** Último problema con la base de datos compartida, para avisar. */
  error: { id: number; texto: string } | null;
  /** Veces que se ha intentado cambiar algo sin poder (conectando o solo lectura), para avisar. */
  rechazos: number;
  /** Sube a la base de datos vacía los datos de este navegador o los de ejemplo. */
  subir: (origen: 'navegador' | 'ejemplo', progreso: (hechos: number, total: number) => void) => Promise<Resultado>;
}

interface Cofre {
  estado: Estado;
  compartido: Compartido;
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
  const [estado, setEstadoReal] = useState<Estado>(() => {
    const g = leer<Estado>(CLAVE);
    return completarBiblioteca(g ? deGuardado(g) : estadoInicial());
  });

  // ── Base de datos compartida ──────────────────────────────────────
  const hayClaude = typeof window !== 'undefined' && !!(window as unknown as { claude?: unknown }).claude;
  const [modo, setModo] = useState<Modo>(hayClaude ? 'conectando' : 'local');
  const [soloLectura, setSoloLectura] = useState(false);
  const [pendientesBd, setPendientesBd] = useState(0);
  const [puedeEscribir, setPuedeEscribir] = useState<boolean | null>(null);
  const [esDueno, setEsDueno] = useState(false);
  const [errorBd, setErrorBd] = useState<{ id: number; texto: string } | null>(null);
  const [rechazos, setRechazos] = useState(0);
  const sinc = useRef<Sincronizador | null>(null);

  useEffect(() => {
    if (!hayClaude) return;
    let vivo = true;
    let s: Sincronizador | null = null;
    void Sincronizador.conectar({
      estado: (e) => setEstadoReal(e),
      modo: setModo,
      pendientes: setPendientesBd,
      soloLectura: () => setSoloLectura(true),
      error: (texto) => setErrorBd({ id: Date.now(), texto }),
    }).then((x) => {
      if (!vivo) return x?.cerrar();
      s = sinc.current = x;
      if (!x) return setModo('local');
      setPuedeEscribir(x.puedeEscribir);
      setEsDueno(x.esDueno);
      if (x.puedeEscribir === false) setSoloLectura(true);
    });
    return () => { vivo = false; s?.cerrar(); sinc.current = null; };
  }, [hayClaude]);

  // Mientras conecta, o si este visor solo puede leer, no se aplica ningún cambio
  const bloqueo = useRef<string | null>(null);
  bloqueo.current = modo === 'conectando' ? 'Conectando con la party, espera un momento'
    : modo === 'compartido' && soloLectura ? 'Solo lectura: pide al dueño que te dé acceso de editor' : null;
  const setEstado = useCallback((f: Estado | ((e: Estado) => Estado)) => {
    if (bloqueo.current) return setRechazos((n) => n + 1);
    setEstadoReal(f);
  }, []);
  const bloqueado = () => (bloqueo.current ? { ok: false as const, motivo: bloqueo.current } : null);

  useEffect(() => {
    if (modo === 'compartido' && !soloLectura) sinc.current?.publicar(estado);
  }, [estado, modo, soloLectura]);

  const subir = useCallback(async (origen: 'navegador' | 'ejemplo', progreso: (hechos: number, total: number) => void): Promise<Resultado> => {
    const s = sinc.current;
    if (!s) return { ok: false, motivo: 'No hay conexión con la base de datos de la party' };
    let e = origen === 'ejemplo' ? completarBiblioteca(estadoInicial()) : estado;
    // Las imágenes guardadas antes pueden no caber en un documento compartido: se reducen
    const cache = new Map<string, Promise<string>>();
    const encajar = async <T extends { imagenUrl?: string }>(x: T): Promise<T> => {
      if (!x.imagenUrl) return x;
      if (!cache.has(x.imagenUrl)) cache.set(x.imagenUrl, encajarImagen(x.imagenUrl).catch(() => ''));
      const url = await cache.get(x.imagenUrl)!;
      return { ...x, imagenUrl: url || undefined };
    };
    e = {
      ...e,
      personajes: await Promise.all(e.personajes.map(encajar)),
      objetos: await Promise.all(e.objetos.map(encajar)),
      biblioteca: e.biblioteca && await Promise.all(e.biblioteca.map(encajar)),
      bestiario: e.bestiario && await Promise.all(e.bestiario.map(encajar)),
    };
    return s.subir(e, progreso);
  }, [estado]);
  const [actor, setActorState] = useState<string>(() => leer<string>(CLAVE_ACTOR) ?? '');

  // Se guarda fuera del clic que lo provoca, para que soltar un objeto no espere a serializarlo todo;
  // si se cierra la página antes, se guarda en ese momento
  const pendiente = useRef<Estado | null>(null);
  const [sinGuardar, setSinGuardar] = useState(false);
  const guardaEnNavegador = modo === 'local' || modo === 'vacio';
  useEffect(() => {
    // Compartido, los datos están en la base de datos; la copia del navegador se queda como estaba
    if (!guardaEnNavegador) return;
    pendiente.current = estado;
    const t = window.setTimeout(() => {
      pendiente.current = null;
      setSinGuardar(!guardar(CLAVE, aGuardar(estado)));
    }, 250);
    return () => window.clearTimeout(t);
  }, [estado, guardaEnNavegador]);
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
    (objetoId: string, destino: Destino, cantidad?: number): Validacion => {
      const b = bloqueado();
      if (b) return b;
      const v = validarMovimiento(estado, objetoId, destino, cantidad);
      if (v.ok) setEstado((e) => moverObjeto(e, objetoId, destino, actor || 'Alguien', cantidad));
      return v;
    },
    [estado, actor],
  );

  const sintonizar = useCallback(
    (objetoId: string, sustituir?: string): SinEstado<ResultadoSintonia> => {
    const b = bloqueado();
    if (b) return b;
      const r = alternarSintonia(estado, objetoId, sustituir);
      if (!r.ok) return r;
      setEstado(r.estado);
      return { ok: true };
    },
    [estado],
  );

  const monedas = useCallback(
    (cambios: Cambio[], descripcion: string): SinEstado<ResultadoMonedas> => {
    const b = bloqueado();
    if (b) return b;
      const r = aplicarMonedas(estado, cambios, actor || 'Alguien', descripcion);
      if (!r.ok) return r;
      setEstado(r.estado);
      return { ok: true };
    },
    [estado, actor],
  );

  const comer = useCallback(
    (personajeId: string, claveComida: string) => {
      const b = bloqueado();
      if (b) return b;
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
    const b = bloqueado();
    if (b) return b;
    const r = crear(estado, datos, actor);
    if (!r.ok) return r;
    setEstado(registrar(r.estado, r.id));
    return { ok: true };
  }, [estado, actor]);

  const editarObjeto = useCallback((id: string, datos: DatosObjeto): Resultado => {
    const b = bloqueado();
    if (b) return b;
    const r = editar(estado, id, datos);
    if (!r.ok) return r;
    setEstado(registrar(r.estado, id));
    return { ok: true };
  }, [estado]);

  // Antes de borrarlo, su ficha apunta quién lo tuvo por última vez
  const eliminarObjeto = useCallback((id: string) => setEstado((e) => eliminar(registrar(e, id), id)), []);

  const recuperarFicha = useCallback((fichaId: string, propietario: Propietario, cantidad: number): Resultado => {
    const b = bloqueado();
    if (b) return b;
    const r = recuperar(estado, fichaId, propietario, cantidad, actor);
    if (!r.ok) return r;
    setEstado(r.estado);
    return { ok: true };
  }, [estado, actor]);

  const olvidarFicha = useCallback((fichaId: string): Resultado => {
    const b = bloqueado();
    if (b) return b;
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
    const b = bloqueado();
    if (b) return b;
    const r = id ? editarCriatura(estado, id, datos) : crearCriatura(estado, datos, actor);
    if (!r.ok) return r;
    setEstado(r.estado);
    return { ok: true as const, id: r.id };
  }, [estado, actor]);
  const eliminarCriaturaCb = useCallback((id: string) => setEstado((e) => eliminarCriatura(e, id)), []);
  const anotarEncuentroCb = useCallback((id: string, derrotada: boolean) => setEstado((e) => anotarEncuentro(e, id, derrotada)), []);

  const restablecer = useCallback(() => setEstado(completarBiblioteca(estadoInicial())), [setEstado]);

  const compartido = useMemo<Compartido>(
    () => ({ modo, soloLectura, pendientes: pendientesBd, puedeEscribir, esDueno, error: errorBd, rechazos, subir }),
    [modo, soloLectura, pendientesBd, puedeEscribir, esDueno, errorBd, rechazos, subir],
  );

  const valor = useMemo(
    () => ({ estado, compartido, sinGuardar, actor, setActor, validar, mover, sintonizar, monedas, comer, pasarDia, cambiarImagen, crearObjeto, editarObjeto, eliminarObjeto, ordenar, editarPersonaje, crearPersonaje, eliminarPersonaje, recuperarFicha, olvidarFicha, cambiarImagenFicha: cambiarImagenFichaCb, guardarCriatura, eliminarCriatura: eliminarCriaturaCb, anotarEncuentro: anotarEncuentroCb, restablecer }),
    [compartido, guardarCriatura, eliminarCriaturaCb, anotarEncuentroCb, recuperarFicha, olvidarFicha, cambiarImagenFichaCb, sinGuardar, estado, actor, setActor, validar, mover, sintonizar, monedas, comer, pasarDia, cambiarImagen, crearObjeto, editarObjeto, eliminarObjeto, ordenar, editarPersonaje, crearPersonaje, eliminarPersonaje, restablecer],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useCofre() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCofre fuera de CofreProvider');
  return c;
}
