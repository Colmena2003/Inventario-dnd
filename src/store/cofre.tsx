// Estado de la app. Sin party compartida vive en el navegador (localStorage); con Supabase configurado y
// una party abierta, cada cambio se sincroniza con el resto de jugadores (sincro.ts). Las pantallas solo
// usan useCofre(): todos los cambios pasan por `cambiar`, que recibe una función pura del estado.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  crearCriatura, editarCriatura, eliminarCriatura, registrarEncuentro, type ResultadoCriatura,
} from '../domain/bestiario';
import { cambiarImagenFicha, olvidarFicha, recuperarFicha, registrarEnBiblioteca, sincronizarBiblioteca, type ResultadoFicha } from '../domain/biblioteca';
import { cambiarEstiloDados, esTirada, estiloDe, type EstiloDados, type Tirada } from '../domain/dados';
import { esperarTirada, propias } from '../dados/espera';
import { descansarEspacios, gastarEspacio, gastarPacto, recuperaEspacios } from '../domain/conjuros';
import { crearObjeto, editarObjeto, eliminarObjeto, estadoVacio, migrar, validarObjeto } from '../domain/objetos';
import { cambiarPv, eliminarPersonaje, guardarPersonaje, validarPersonaje } from '../domain/personajes';
import {
  alternarSintonia, cambiarSaciedad, comer as comerRegla, descansar as descansarRegla, type Destino, moverObjeto, ordenarInventario,
  type OrdenInventario, primerNombre, type ResultadoComer, type ResultadoSintonia, type Validacion, validarMovimiento,
} from '../domain/reglas';
import { aplicarMonedas, type Cambio, type ResultadoMonedas } from '../domain/monedas';
import {
  aplicarEfecto, aplicarRecarga, aplicarUso, descansarEfectos, pasarTiempo, prepararRecarga, prepararUso, quitarEfecto, usarRasgo,
  type ResultadoPlan,
} from '../domain/uso';
import type { Criatura, Estado, Objeto, Personaje, PlantillaEfecto, Propietario } from '../domain/tipos';
import { LADO_IMAGEN, reducirImagen } from '../ui/interaccion';
import { PARTY_POR_DEFECTO } from '../config';
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

/** Pone al día lo guardado con un modelo anterior y da ficha de biblioteca a los objetos que no la tengan. */
const migrarGuardado = (e: Estado) => sincronizarBiblioteca(migrar(e));

/** Si un cambio ya no vale (lanza un error), el estado se queda como estaba. */
const probar = (op: Op) => (e: Estado) => { try { return op(e); } catch { return e; } };

/** Marca de «este navegador salió de la party a propósito»: no se vuelve a entrar sola. */
const SIN_PARTY = '-';

/** Código de party de la URL (?party=ABC123), el último usado en este navegador o el de la mesa. */
function codigoInicial(): string | null {
  const url = new URLSearchParams(window.location.search).get('party');
  if (url) return normalizarCodigo(url);
  const guardado = leer<string>(CLAVE_PARTY);
  if (guardado === SIN_PARTY) return null;
  return guardado || PARTY_POR_DEFECTO || null;
}

/** El enlace lleva el código salvo para la party de la mesa, que es la de la web sin más. */
function ponerCodigoEnUrl(codigo: string | null) {
  const u = new URL(window.location.href);
  if (codigo && codigo !== PARTY_POR_DEFECTO) u.searchParams.set('party', codigo);
  else u.searchParams.delete('party');
  window.history.replaceState(null, '', u);
}

export interface Sincronizacion {
  /** Hay Supabase configurado. */
  disponible: boolean;
  conexion: Conexion;
  codigo: string | null;
  error: string | null;
  /** Cuántos cambios de este jugador se han descartado porque otro guardó antes algo incompatible. */
  descartes: number;
  /** Sube la party de este navegador como una party compartida nueva y entra en ella. */
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
  /** `desde`: dónde vio el objeto el jugador al cogerlo; si ya no está ahí, no se mueve. */
  mover: (objetoId: string, destino: Destino, cantidad?: number, desde?: Propietario) => Validacion;
  sintonizar: (objetoId: string, sustituir?: string) => SinEstado<ResultadoSintonia>;
  monedas: (cambios: Cambio[], descripcion: string) => SinEstado<ResultadoMonedas>;
  cambiarImagen: (personajeId: string, url: string) => void;
  /** Reduce una imagen subida y, con party compartida, la guarda en el almacenamiento; devuelve su URL. */
  prepararImagen: (f: File, lado?: number) => Promise<string>;
  /** Crea (sin id) o guarda (con id) un objeto; devuelve el motivo si no se puede. */
  guardarObjeto: (o: Objeto, nuevo: boolean) => string | null;
  eliminarObjeto: (id: string) => void;
  /** Gasta una carga o una unidad y aplica su efecto; devuelve el texto para el aviso. */
  /**
   * Usa un objeto. Si tira dados, salen en la mesa 3D con el color de quien lo usa y el efecto (curar,
   * gastarlo) se aplica cuando se paran: `tras` se resuelve entonces.
   */
  usar: (objetoId: string, personajeId?: string) => { ok: true; texto: string; tras?: Promise<void> } | { ok: false; motivo: string };
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
  /** Gasta (+1) o recupera (−1) un espacio de conjuro; nivel 0 = magia del pacto. Devuelve el motivo si no se puede. */
  gastarEspacio: (personajeId: string, nivel: number, delta: 1 | -1) => string | null;
  /** Junta pilas y coloca el inventario de un dueño en orden. */
  ordenar: (propietario: Propietario, orden: OrdenInventario) => void;
  recuperarFicha: (fichaId: string, propietario: Propietario, cantidad: number) => SinEstado<ResultadoFicha>;
  olvidarFicha: (fichaId: string) => SinEstado<ResultadoFicha>;
  cambiarImagenFicha: (fichaId: string, url: string | undefined) => void;
  /** Crea (sin id) o guarda una criatura. */
  guardarCriatura: (datos: Omit<Criatura, 'id' | 'creada' | 'actualizada'>, id?: string) => SinEstado<ResultadoCriatura>;
  eliminarCriatura: (id: string) => void;
  registrarEncuentro: (id: string, abatida: boolean) => void;
  /** Últimas tiradas de dados: las de este jugador y las que llegan del resto de la party (no se guardan). */
  tiradas: Tirada[];
  /** Apunta una tirada y, si no es privada, se la enseña al resto de la party. */
  lanzarDados: (t: Tirada) => void;
  cambiarEstiloDados: (personajeId: string, estilo: EstiloDados) => void;
}

const Ctx = createContext<Cofre | null>(null);

export function CofreProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>(() => {
    const guardado = leer<Estado>(CLAVE);
    return guardado ? migrarGuardado(guardado) : estadoVacio();
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

  const [descartes, setDescartes] = useState(0);
  const emitir = useCallback((e: Estado, c: Conexion, descartado?: boolean) => {
    setEstado(e);
    setConexion(c);
    if (descartado) setDescartes((n) => n + 1);
  }, []);

  const [tiradas, setTiradas] = useState<Tirada[]>([]);
  const apuntarTirada = useCallback((t: unknown) => {
    if (esTirada(t)) setTiradas((l) => [t, ...l.filter((x) => x.id !== t.id)].slice(0, 30));
  }, []);

  const entrar = useCallback((s: Sala) => {
    sala.current?.cerrar();
    s.alTirar = apuntarTirada;
    sala.current = s;
    setCodigo(s.codigo);
    setErrorSync(null);
    guardar(CLAVE_PARTY, s.codigo);
    ponerCodigoEnUrl(s.codigo);
  }, [apuntarTirada]);

  const unirse = useCallback(async (texto: string) => {
    const c = normalizarCodigo(texto);
    if (!c) { setErrorSync('Escribe el código de la party'); return; }
    setConexion('conectando');
    try {
      const s = await Sala.abrir(c, emitir, migrarGuardado);
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
      entrar(await Sala.crear(local.current, emitir, migrarGuardado));
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
    guardar(CLAVE_PARTY, SIN_PARTY);
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
    // Después de cada cambio, la biblioteca apunta los objetos nuevos y quién tiene cada uno
    const conBiblioteca: Op = (e) => sincronizarBiblioteca(op(e));
    if (sala.current) sala.current.aplicar(conBiblioteca);
    else setEstado(probar(conBiblioteca));
  }, []);

  const setActor = useCallback((nombre: string) => {
    setActorState(nombre);
    guardar(CLAVE_ACTOR, nombre);
  }, []);

  const quien = actor || 'Alguien';

  /** Comprueba un resultado sobre el estado actual y, si vale, repite el cambio sobre el que haya al guardar. */
  const conResultado = useCallback(<R extends { ok: true; estado: Estado } | { ok: false; motivo: string }>(f: (e: Estado) => R): SinEstado<R> => {
    const r = f(estado);
    if (!r.ok) return r as SinEstado<R>;
    cambiar((e) => { const x = f(e); if (!x.ok) throw new Error(x.motivo); return x.estado; });
    const { estado: _e, ...resto } = r;
    return resto as SinEstado<R>;
  }, [estado, cambiar]);

  const validar = useCallback(
    (objetoId: string, destino: Destino, cantidad?: number) => validarMovimiento(estado, objetoId, destino, cantidad),
    [estado],
  );

  const mover = useCallback(
    (objetoId: string, destino: Destino, cantidad?: number, desde?: Propietario) => {
      // Si otro jugador ya lo ha movido (antes de soltarlo o al guardarse), el movimiento se descarta: no se le
      // quita a quien lo cogió
      const origen = JSON.stringify(desde ?? estado.objetos.find((o) => o.id === objetoId)?.propietario);
      if (JSON.stringify(estado.objetos.find((o) => o.id === objetoId)?.propietario) !== origen) return { ok: false as const, motivo: 'Otro jugador lo ha movido antes que tú' };
      const v = validarMovimiento(estado, objetoId, destino, cantidad);
      if (v.ok) {
        cambiar((e) => {
          if (JSON.stringify(e.objetos.find((o) => o.id === objetoId)?.propietario) !== origen) throw new Error('Otro jugador lo ha movido antes');
          return moverObjeto(e, objetoId, destino, quien, cantidad);
        });
      }
      return v;
    },
    [estado, quien, cambiar],
  );

  const sintonizar = useCallback(
    (objetoId: string, sustituir?: string) => conResultado((e) => alternarSintonia(e, objetoId, sustituir)),
    [conResultado],
  );

  const monedas = useCallback(
    (cambios: Cambio[], descripcion: string) => conResultado((e) => aplicarMonedas(e, cambios, quien, descripcion)),
    [conResultado, quien],
  );

  const cambiarImagen = useCallback((personajeId: string, url: string) => {
    cambiar((e) => ({ ...e, personajes: e.personajes.map((p) => (p.id === personajeId ? { ...p, imagenUrl: url } : p)) }));
  }, [cambiar]);

  const prepararImagen = useCallback(async (f: File, lado = LADO_IMAGEN) => {
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
    cambiar((e) => {
      const r = nuevo ? crearObjeto(e, o, quien) : editarObjeto(e, o, quien);
      return registrarEnBiblioteca(r, nuevo ? r.objetos[r.objetos.length - 1].id : o.id);
    });
    return null;
  }, [estado, quien, cambiar]);

  const eliminar = useCallback((id: string) => cambiar((e) => eliminarObjeto(e, id)), [cambiar]);

  const comer = useCallback((personajeId: string, objetoId: string) => conResultado((e) => comerRegla(e, personajeId, objetoId)), [conResultado]);

  const lanzarDados = useCallback((t: Tirada) => {
    propias.add(t.id);
    apuntarTirada(t);
    if (!t.privada) sala.current?.difundirTirada(t);
  }, [apuntarTirada]);

  const usar = useCallback((objetoId: string, personajeId?: string) => {
    const o = estado.objetos.find((x) => x.id === objetoId);
    // La comida se usa comiéndola: suma saciedad
    if (o?.categoria === 'Comida') {
      const pid = o.propietario.tipo === 'personaje' ? o.propietario.id : personajeId;
      const p = estado.personajes.find((x) => x.id === pid);
      if (!p) return { ok: false as const, motivo: `Dale ${o.nombre} a un personaje para comerlo` };
      const r = comer(p.id, o.id);
      return r.ok ? { ok: true as const, texto: r.texto } : r;
    }
    const r: ResultadoPlan = prepararUso(estado, objetoId, personajeId);
    if (!r.ok) return r;
    const p = estado.personajes.find((x) => x.id === r.plan.personajeId);
    if (!r.plan.dados || !p || !o) {
      cambiar((e) => aplicarUso(e, r.plan));
      return { ok: true as const, texto: r.texto };
    }
    // Los números ya están sacados en el plan: la mesa solo los enseña
    const t: Tirada = {
      id: crypto.randomUUID(), fecha: Date.now(), quien: p.id, nombre: primerNombre(p.nombre), estilo: estiloDe(p),
      dados: r.plan.dados.dados, modificador: r.plan.dados.modificador,
      motivo: `${o.nombre}${r.plan.cura != null ? ' · curación' : o.tiradaUso?.efecto === 'dano' ? ' · daño' : ''}`,
    };
    lanzarDados(t);
    const tras = esperarTirada(t.id).then(() => cambiar((e) => aplicarUso(e, r.plan)));
    return { ok: true as const, texto: r.texto, tras };
  }, [estado, comer, cambiar, lanzarDados]);

  const rasgo = useCallback((personajeId: string, nombre: string, delta: number) => cambiar((e) => usarRasgo(e, personajeId, nombre, delta)), [cambiar]);

  const saciedad = useCallback((ids: string[], delta: number) => cambiar((e) => cambiarSaciedad(e, ids, delta)), [cambiar]);

  const descansar = useCallback((ids: string[], tipo: 'corto' | 'largo') => {
    const r = descansarRegla(estado, ids, tipo);
    // Quien no puede hacer el descanso largo por hambre tampoco recupera
    const recarga = prepararRecarga(estado, r.hechos, tipo);
    const efectos = descansarEfectos(estado, r.hechos, tipo);
    const espacios = estado.personajes.filter((p) => r.hechos.includes(p.id) && recuperaEspacios(p, tipo)).map((p) => `${primerNombre(p.nombre)}: espacios de conjuro`);
    cambiar((e) => descansarEspacios(descansarEfectos(aplicarRecarga(descansarRegla(e, r.hechos, tipo).estado, recarga), r.hechos, tipo).estado, r.hechos, tipo));
    return { hechos: r.hechos, bloqueados: r.bloqueados, recargas: [...recarga.textos, ...espacios], terminados: efectos.terminados };
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

  const espacio = useCallback((personajeId: string, nivel: number, delta: 1 | -1) => {
    const op = (e: Estado) => (nivel === 0 ? gastarPacto(e, personajeId, delta) : gastarEspacio(e, personajeId, nivel, delta));
    try { op(estado); } catch (err) { return (err as Error).message; }
    cambiar(op);
    return null;
  }, [estado, cambiar]);

  const ordenar = useCallback((p: Propietario, orden: OrdenInventario) => cambiar((e) => ordenarInventario(e, p, orden)), [cambiar]);

  const recuperar = useCallback((fichaId: string, p: Propietario, n: number) => conResultado((e) => recuperarFicha(e, fichaId, p, n, quien)), [conResultado, quien]);
  const olvidar = useCallback((fichaId: string) => conResultado((e) => olvidarFicha(e, fichaId)), [conResultado]);
  const imagenFicha = useCallback((fichaId: string, url: string | undefined) => cambiar((e) => cambiarImagenFicha(e, fichaId, url)), [cambiar]);

  const guardarCriatura = useCallback((datos: Omit<Criatura, 'id' | 'creada' | 'actualizada'>, id?: string) => {
    // El id de una criatura nueva se decide una vez, para que repetir el cambio no cree otra
    const r = id ? editarCriatura(estado, id, datos) : crearCriatura(estado, datos, quien);
    if (!r.ok) return r;
    const nueva = r.estado.bestiario!.find((c) => c.id === r.id)!;
    cambiar((e) => {
      if (!id) return { ...e, bestiario: [...(e.bestiario ?? []), nueva] };
      const x = editarCriatura(e, id, datos);
      if (!x.ok) throw new Error(x.motivo);
      return x.estado;
    });
    return { ok: true as const, id: r.id };
  }, [estado, quien, cambiar]);

  const estiloDados = useCallback((personajeId: string, estilo: EstiloDados) => cambiar((e) => cambiarEstiloDados(e, personajeId, estilo)), [cambiar]);

  const borrarCriatura = useCallback((id: string) => cambiar((e) => eliminarCriatura(e, id)), [cambiar]);
  const encuentro = useCallback((id: string, abatida: boolean) => cambiar((e) => registrarEncuentro(e, id, abatida)), [cambiar]);


  const sync = useMemo<Sincronizacion>(
    () => ({ disponible: supabaseDisponible, conexion, codigo, error: errorSync, descartes, crear, unirse, salir }),
    [conexion, codigo, errorSync, descartes, crear, unirse, salir],
  );

  const valor = useMemo(
    () => ({
      estado, actor, setActor, sync, validar, mover, sintonizar, monedas, cambiarImagen, prepararImagen, guardarObjeto,
      eliminarObjeto: eliminar, usar, usarRasgo: rasgo, comer, cambiarSaciedad: saciedad, descansar, aplicarEfecto: efecto,
      quitarEfecto: quitar, pasarTiempo: tiempo, guardarPersonaje: guardarPj, eliminarPersonaje: eliminarPj, cambiarPv: pv, gastarEspacio: espacio, ordenar,
      recuperarFicha: recuperar, olvidarFicha: olvidar, cambiarImagenFicha: imagenFicha, guardarCriatura, eliminarCriatura: borrarCriatura,
      registrarEncuentro: encuentro, tiradas, lanzarDados, cambiarEstiloDados: estiloDados,
    }),
    [estado, actor, setActor, sync, validar, mover, sintonizar, monedas, cambiarImagen, prepararImagen, guardarObjeto, eliminar,
      usar, rasgo, comer, saciedad, descansar, efecto, quitar, tiempo, guardarPj, eliminarPj, pv, espacio, ordenar, recuperar, olvidar, imagenFicha, guardarCriatura, borrarCriatura, encuentro,
      tiradas, lanzarDados, estiloDados],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useCofre() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCofre fuera de CofreProvider');
  return c;
}
