// Estado de la app. Sin party compartida vive en el navegador (localStorage); con Supabase configurado y
// una party abierta, cada cambio se sincroniza con el resto de jugadores (sincro.ts). Las pantallas solo
// usan useCofre(): todos los cambios pasan por `cambiar`, que recibe una función pura del estado.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { estadoInicial, estadoVacio } from '../data/semilla';
import { crearObjeto, editarObjeto, eliminarObjeto, migrar, validarObjeto } from '../domain/objetos';
import { cambiarPv, eliminarPersonaje, guardarPersonaje, validarPersonaje } from '../domain/personajes';
import {
  alternarSintonia, cambiarSaciedad, comer as comerRegla, descansar as descansarRegla, moverObjeto, validarMovimiento,
  type Destino, type ResultadoComer, type ResultadoSintonia, type Validacion,
} from '../domain/reglas';
import { aplicarMonedas, type Cambio, type ResultadoMonedas } from '../domain/monedas';
import {
  aplicarEfecto, aplicarRecarga, aplicarUso, descansarEfectos, pasarTiempo, prepararRecarga, prepararUso, quitarEfecto, usarRasgo,
  type ResultadoPlan,
} from '../domain/uso';
import type { Estado, Objeto, Personaje, PlantillaEfecto } from '../domain/tipos';
import { reducirImagen } from '../ui/interaccion';
import { normalizarCodigo, Sala, subirImagen, supabaseDisponible, type Conexion, type Op } from './sincro';

type SinEstado<T> = T extends { estado: Estado } ? Omit<T, 'estado'> : T;

const CLAVE = 'cofre:estado:v2';
const CLAVE_ACTOR = 'cofre:actor';
const CLAVE_PARTY = 'cofre:party';

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
    if (valor == null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Sin almacenamiento (modo privado, cuota llena): la sesión sigue funcionando en memoria.
  }
}

const migrarSemilla = (e: Estado) => migrar(e, estadoInicial());

/** Si un cambio ya no vale (lanza un error), el estado se queda como estaba. */
const probar = (op: Op) => (e: Estado) => { try { return op(e); } catch { return e; } };

/** Código de party de la URL (?party=ABC123) o el último usado en este navegador. */
function codigoInicial(): string | null {
  const url = new URLSearchParams(window.location.search).get('party');
  return url ? normalizarCodigo(url) : leer<string>(CLAVE_PARTY);
}

function ponerCodigoEnUrl(codigo: string | null) {
  const u = new URL(window.location.href);
  if (codigo) u.searchParams.set('party', codigo);
  else u.searchParams.delete('party');
  window.history.replaceState(null, '', u);
}

export interface Sincronizacion {
  /** Hay Supabase configurado. */
  disponible: boolean;
  conexion: Conexion;
  codigo: string | null;
  error: string | null;
  /** Sube la party de este navegador y devuelve su código. */
  crear: () => Promise<void>;
  unirse: (codigo: string) => Promise<void>;
  /** Deja la party compartida y vuelve a los datos de este navegador. */
  salir: () => void;
}

interface Cofre {
  estado: Estado;
  actor: string;
  setActor: (nombre: string) => void;
  sync: Sincronizacion;
  validar: (objetoId: string, destino: Destino, cantidad?: number) => Validacion;
  mover: (objetoId: string, destino: Destino, cantidad?: number) => Validacion;
  sintonizar: (objetoId: string, sustituir?: string) => SinEstado<ResultadoSintonia>;
  monedas: (cambios: Cambio[], descripcion: string) => SinEstado<ResultadoMonedas>;
  cambiarImagen: (personajeId: string, url: string) => void;
  /** Reduce una imagen subida y, con party compartida, la guarda en el almacenamiento; devuelve su URL. */
  prepararImagen: (f: File, lado: number) => Promise<string>;
  /** Crea (sin id) o guarda (con id) un objeto; devuelve el motivo si no se puede. */
  guardarObjeto: (o: Objeto, nuevo: boolean) => string | null;
  eliminarObjeto: (id: string) => void;
  /** Gasta una carga o una unidad y aplica su efecto; devuelve el texto para el aviso. */
  usar: (objetoId: string, personajeId?: string) => { ok: true; texto: string } | { ok: false; motivo: string };
  usarRasgo: (personajeId: string, nombre: string, delta: number) => void;
  comer: (personajeId: string, objetoId: string) => SinEstado<ResultadoComer>;
  cambiarSaciedad: (ids: string[], delta: number) => void;
  /** Descanso: hambre, recarga de objetos y rasgos, y fin de los efectos que acaban. */
  descansar: (ids: string[], tipo: 'corto' | 'largo') => { hechos: string[]; bloqueados: string[]; recargas: string[]; terminados: string[] };
  aplicarEfecto: (ids: string[], efecto: PlantillaEfecto) => void;
  quitarEfecto: (personajeId: string, efectoId: string) => void;
  /** Pasa el tiempo de juego para toda la party; devuelve los efectos que se acaban. */
  pasarTiempo: (segundos: number) => string[];
  guardarPersonaje: (p: Personaje, nuevo: boolean) => string | null;
  eliminarPersonaje: (id: string) => void;
  /** Daño (negativo) o curación (positivo); devuelve los PV antes y después. */
  cambiarPv: (personajeId: string, delta: number) => { antes: number; despues: number } | null;
  restablecer: () => void;
}

const Ctx = createContext<Cofre | null>(null);

export function CofreProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>(() => {
    const guardado = leer<Estado>(CLAVE);
    return guardado ? migrarSemilla(guardado) : estadoVacio();
  });
  const [actor, setActorState] = useState<string>(() => leer<string>(CLAVE_ACTOR) ?? '');
  const [conexion, setConexion] = useState<Conexion>('local');
  const [codigo, setCodigo] = useState<string | null>(null);
  const [errorSync, setErrorSync] = useState<string | null>(null);
  const sala = useRef<Sala | null>(null);
  const local = useRef(estado);

  // Sin party compartida, lo de este navegador se guarda en localStorage
  useEffect(() => {
    if (!codigo) { local.current = estado; guardar(CLAVE, estado); }
  }, [estado, codigo]);

  const emitir = useCallback((e: Estado, c: Conexion) => { setEstado(e); setConexion(c); }, []);

  const entrar = useCallback((s: Sala) => {
    sala.current?.cerrar();
    sala.current = s;
    setCodigo(s.codigo);
    setErrorSync(null);
    guardar(CLAVE_PARTY, s.codigo);
    ponerCodigoEnUrl(s.codigo);
  }, []);

  const unirse = useCallback(async (texto: string) => {
    const c = normalizarCodigo(texto);
    if (!c) { setErrorSync('Escribe el código de la party'); return; }
    setConexion('conectando');
    try {
      const s = await Sala.abrir(c, emitir, migrarSemilla);
      if (!s) { setErrorSync(`No hay ninguna party con el código ${c}`); setConexion(sala.current ? 'sincronizado' : 'local'); return; }
      entrar(s);
    } catch (err) {
      setErrorSync(`No se pudo conectar: ${(err as Error).message}`);
      setConexion(sala.current ? 'sin-conexion' : 'local');
    }
  }, [emitir, entrar]);

  const crear = useCallback(async () => {
    setConexion('conectando');
    try {
      entrar(await Sala.crear(local.current, emitir, migrarSemilla));
    } catch (err) {
      setErrorSync(`No se pudo crear la party: ${(err as Error).message}`);
      setConexion('local');
    }
  }, [emitir, entrar]);

  const salir = useCallback(() => {
    sala.current?.cerrar();
    sala.current = null;
    setCodigo(null);
    setConexion('local');
    guardar(CLAVE_PARTY, null);
    ponerCodigoEnUrl(null);
    setEstado(local.current);
  }, []);

  // Al abrir, vuelve a la party de la URL o a la última usada
  useEffect(() => {
    const c = codigoInicial();
    if (c && supabaseDisponible) void unirse(c);
    return () => sala.current?.cerrar();
  }, [unirse]);

  const cambiar = useCallback((op: Op) => {
    if (sala.current) sala.current.aplicar(op);
    else setEstado(probar(op));
  }, []);

  const setActor = useCallback((nombre: string) => {
    setActorState(nombre);
    guardar(CLAVE_ACTOR, nombre);
  }, []);

  const quien = actor || 'Alguien';

  const validar = useCallback(
    (objetoId: string, destino: Destino, cantidad?: number) => validarMovimiento(estado, objetoId, destino, cantidad),
    [estado],
  );

  const mover = useCallback(
    (objetoId: string, destino: Destino, cantidad?: number) => {
      const v = validarMovimiento(estado, objetoId, destino, cantidad);
      if (v.ok) cambiar((e) => moverObjeto(e, objetoId, destino, quien, cantidad));
      return v;
    },
    [estado, quien, cambiar],
  );

  const sintonizar = useCallback(
    (objetoId: string, sustituir?: string): SinEstado<ResultadoSintonia> => {
      const r = alternarSintonia(estado, objetoId, sustituir);
      if (!r.ok) return r;
      cambiar((e) => { const x = alternarSintonia(e, objetoId, sustituir); if (!x.ok) throw new Error(x.motivo); return x.estado; });
      return { ok: true };
    },
    [estado, cambiar],
  );

  const monedas = useCallback(
    (cambios: Cambio[], descripcion: string): SinEstado<ResultadoMonedas> => {
      const r = aplicarMonedas(estado, cambios, quien, descripcion);
      if (!r.ok) return r;
      cambiar((e) => { const x = aplicarMonedas(e, cambios, quien, descripcion); if (!x.ok) throw new Error(x.motivo); return x.estado; });
      return { ok: true };
    },
    [estado, quien, cambiar],
  );

  const cambiarImagen = useCallback((personajeId: string, url: string) => {
    cambiar((e) => ({ ...e, personajes: e.personajes.map((p) => (p.id === personajeId ? { ...p, imagenUrl: url } : p)) }));
  }, [cambiar]);

  const prepararImagen = useCallback(async (f: File, lado: number) => {
    const dataUrl = await reducirImagen(f, lado);
    if (!codigo) return dataUrl;
    try {
      return await subirImagen(codigo, dataUrl);
    } catch {
      return dataUrl; // sin almacenamiento configurado, la imagen va dentro del estado
    }
  }, [codigo]);

  const guardarObjeto = useCallback((o: Objeto, nuevo: boolean) => {
    const motivo = validarObjeto(estado, o);
    if (motivo) return motivo;
    cambiar((e) => (nuevo ? crearObjeto(e, o, quien) : editarObjeto(e, o, quien)));
    return null;
  }, [estado, quien, cambiar]);

  const eliminar = useCallback((id: string) => cambiar((e) => eliminarObjeto(e, id)), [cambiar]);

  const comer = useCallback((personajeId: string, objetoId: string): SinEstado<ResultadoComer> => {
    const r = comerRegla(estado, personajeId, objetoId);
    if (!r.ok) return r;
    cambiar((e) => { const x = comerRegla(e, personajeId, objetoId); if (!x.ok) throw new Error(x.motivo); return x.estado; });
    return { ok: true, antes: r.antes, despues: r.despues };
  }, [estado, cambiar]);

  const usar = useCallback((objetoId: string, personajeId?: string) => {
    const o = estado.objetos.find((x) => x.id === objetoId);
    // La comida se usa comiéndola: suma saciedad
    if (o?.categoria === 'Comida') {
      const pid = o.propietario.tipo === 'personaje' ? o.propietario.id : personajeId;
      const p = estado.personajes.find((x) => x.id === pid);
      if (!p) return { ok: false as const, motivo: `Dale ${o.nombre} a un personaje para comerlo` };
      const r = comer(p.id, o.id);
      return r.ok ? { ok: true as const, texto: `${p.nombre.split(' ')[0]} come ${o.nombre.toLowerCase()}: saciedad ${r.antes} → ${r.despues}` } : r;
    }
    const r: ResultadoPlan = prepararUso(estado, objetoId, personajeId);
    if (!r.ok) return r;
    cambiar((e) => aplicarUso(e, r.plan));
    return { ok: true as const, texto: r.texto };
  }, [estado, comer, cambiar]);

  const rasgo = useCallback((personajeId: string, nombre: string, delta: number) => cambiar((e) => usarRasgo(e, personajeId, nombre, delta)), [cambiar]);

  const saciedad = useCallback((ids: string[], delta: number) => cambiar((e) => cambiarSaciedad(e, ids, delta)), [cambiar]);

  const descansar = useCallback((ids: string[], tipo: 'corto' | 'largo') => {
    const r = descansarRegla(estado, ids, tipo);
    // Quien no puede hacer el descanso largo por hambre tampoco recupera
    const recarga = prepararRecarga(estado, r.hechos, tipo);
    const efectos = descansarEfectos(estado, r.hechos, tipo);
    cambiar((e) => descansarEfectos(aplicarRecarga(descansarRegla(e, r.hechos, tipo).estado, recarga), r.hechos, tipo).estado);
    return { hechos: r.hechos, bloqueados: r.bloqueados, recargas: recarga.textos, terminados: efectos.terminados };
  }, [estado, cambiar]);

  const efecto = useCallback((ids: string[], ef: PlantillaEfecto) => cambiar((e) => aplicarEfecto(e, ids, ef)), [cambiar]);
  const quitar = useCallback((personajeId: string, efectoId: string) => cambiar((e) => quitarEfecto(e, personajeId, efectoId)), [cambiar]);

  const tiempo = useCallback((segundos: number) => {
    const ids = estado.personajes.map((p) => p.id);
    const { terminados } = pasarTiempo(estado, ids, segundos);
    cambiar((e) => pasarTiempo(e, e.personajes.map((p) => p.id), segundos).estado);
    return terminados;
  }, [estado, cambiar]);

  const guardarPj = useCallback((p: Personaje, nuevo: boolean) => {
    const motivo = validarPersonaje(estado, p);
    if (motivo) return motivo;
    cambiar((e) => guardarPersonaje(e, p, nuevo));
    return null;
  }, [estado, cambiar]);

  const eliminarPj = useCallback((id: string) => cambiar((e) => eliminarPersonaje(e, id)), [cambiar]);

  const pv = useCallback((personajeId: string, delta: number) => {
    if (!estado.personajes.some((p) => p.id === personajeId)) return null;
    const r = cambiarPv(estado, personajeId, delta);
    cambiar((e) => cambiarPv(e, personajeId, delta).estado);
    return { antes: r.antes, despues: r.despues };
  }, [estado, cambiar]);

  const restablecer = useCallback(() => cambiar(() => estadoVacio()), [cambiar]);

  const sync = useMemo<Sincronizacion>(
    () => ({ disponible: supabaseDisponible, conexion, codigo, error: errorSync, crear, unirse, salir }),
    [conexion, codigo, errorSync, crear, unirse, salir],
  );

  const valor = useMemo(
    () => ({
      estado, actor, setActor, sync, validar, mover, sintonizar, monedas, cambiarImagen, prepararImagen, guardarObjeto,
      eliminarObjeto: eliminar, usar, usarRasgo: rasgo, comer, cambiarSaciedad: saciedad, descansar, aplicarEfecto: efecto,
      quitarEfecto: quitar, pasarTiempo: tiempo, guardarPersonaje: guardarPj, eliminarPersonaje: eliminarPj, cambiarPv: pv, restablecer,
    }),
    [estado, actor, setActor, sync, validar, mover, sintonizar, monedas, cambiarImagen, prepararImagen, guardarObjeto, eliminar,
      usar, rasgo, comer, saciedad, descansar, efecto, quitar, tiempo, guardarPj, eliminarPj, pv, restablecer],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useCofre() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCofre fuera de CofreProvider');
  return c;
}
