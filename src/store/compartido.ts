// Sincronización con la base de datos compartida del artefacto (capacidad `db` de claude.ai): toda la
// party ve y cambia los mismos datos, en vivo. Fuera de claude.ai (desarrollo, fichero suelto) no hay
// base de datos y la app sigue guardando en el navegador.
//
// Cada cambio local se traduce en escribir solo los documentos que han cambiado; cada cambio de otra
// persona llega por las suscripciones y rehace el estado. Si dos personas cambian lo mismo a la vez,
// gana la última escritura de ese documento (un objeto, un personaje...), no la de toda la party.

import type { Estado } from '../domain/tipos';
import {
  aDocumentos, COLECCIONES, deDocumentos, diferencias, DOC_META, DOC_MOVIMIENTOS, DOC_PARTY, DOC_REGISTRO, MAX_DOCUMENTO, memoriaNueva,
  type Documentos, type Ordenes,
} from './documentos';

// Lo mínimo del contrato de `db` y `user` que se usa aquí (las definiciones completas las da claude.ai)
type Error = { code: string; message: string };
type Instantanea = { id: string; exists: boolean; data(): Record<string, unknown> | undefined };
type Cambio = { type: 'added' | 'modified' | 'removed'; doc: Instantanea };
type Doc = {
  get(): Promise<Instantanea>;
  set(d: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
  acquire(o: { holder: string; ttlMs?: number }): Promise<{ acquired: boolean }>;
  onSnapshot(next: (s: Instantanea) => void, error?: (e: Error) => void): () => void;
};
type Coleccion = { onSnapshot(next: (s: { docChanges(): Cambio[] }) => void, error?: (e: Error) => void): () => void };
type Db = { doc(ruta: string): Doc; collection(ruta: string): Coleccion };
type Usuario = { can(nombre: string): Promise<boolean | null> };
type Claude = { use(nombre: string): Promise<unknown> };

export type Modo = 'local' | 'conectando' | 'vacio' | 'compartido';

export interface Avisos {
  /** Estado de la party tal como está en la base de datos, tras un cambio de cualquiera. */
  estado: (e: Estado) => void;
  modo: (m: Modo) => void;
  /** Escrituras pendientes de confirmar (para «Guardando…»). */
  pendientes: (n: number) => void;
  /** La base de datos ha rechazado escribir: este visor solo puede leer. */
  soloLectura: () => void;
  error: (texto: string) => void;
}

const SIMULTANEAS = 6;
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** `claude.use(nombre)`, o null fuera de claude.ai. */
export async function capacidad<T>(nombre: string): Promise<T | null> {
  const c = (window as unknown as { claude?: Claude }).claude;
  if (!c?.use) return null;
  try {
    return ((await c.use(nombre)) as T | null) ?? null;
  } catch {
    return null;
  }
}

export class Sincronizador {
  private cuerpos = new Map<string, Record<string, unknown>>();
  private ordenes: Ordenes = new Map();
  private memoria = memoriaNueva();
  /** Lo que está (o va camino de estar) en la base de datos, en nuestra propia serialización. */
  private base: Documentos = new Map();
  private sembrado = false;
  private faltan: number;
  private modo: Modo = 'conectando';
  private colas = new Map<string, { pendiente: string | null | undefined; enCurso: boolean }>();
  private enVuelo = 0;
  private esperando: (() => void)[] = [];
  private pendientes = 0;
  private programado = false;
  private bajas: (() => void)[] = [];
  private cerrado = false;

  private constructor(private db: Db, readonly puedeEscribir: boolean | null, private av: Avisos) {
    const suscripciones = 1 + 3 + COLECCIONES.length;
    this.faltan = suscripciones;
    this.suscribir();
  }

  /** null si esta vista no tiene base de datos compartida (fuera de claude.ai, sin sesión…). */
  static async conectar(av: Avisos): Promise<Sincronizador | null> {
    const db = await capacidad<Db>('db');
    if (!db) return null;
    const usuario = await capacidad<Usuario>('user');
    const puede = usuario ? await usuario.can('data.write').catch(() => null) : null;
    return new Sincronizador(db, puede, av);
  }

  cerrar() {
    this.cerrado = true;
    this.bajas.forEach((f) => f());
  }

  // ── Lectura ───────────────────────────────────────────────────────

  private suscribir() {
    const primera = new Set<string>();
    const lista = (clave: string) => {
      if (primera.has(clave)) return;
      primera.add(clave);
      this.faltan--;
    };
    const fallo = (e: Error) => {
      if (this.cerrado) return;
      this.av.error(e.code === 'revoked' ? 'Se ha perdido el acceso a los datos de la party.' : `No se pueden leer los datos de la party (${e.code}). Recarga la página.`);
    };

    this.bajas.push(this.db.doc(DOC_META).onSnapshot((s) => {
      this.sembrado = !!s.exists && s.data()?.sembrado === true;
      lista(DOC_META);
      this.programar();
    }, fallo));
    for (const ruta of [DOC_PARTY, DOC_MOVIMIENTOS, DOC_REGISTRO]) {
      this.bajas.push(this.db.doc(ruta).onSnapshot((s) => {
        const d = s.exists ? s.data() : undefined;
        if (d) this.cuerpos.set(ruta, d);
        else this.cuerpos.delete(ruta);
        lista(ruta);
        this.programar();
      }, fallo));
    }
    for (const col of COLECCIONES) {
      this.bajas.push(this.db.collection(col).onSnapshot((qs) => {
        for (const c of qs.docChanges()) {
          const ruta = `${col}/${c.doc.id}`;
          const d = c.type === 'removed' ? undefined : c.doc.data();
          if (d) this.cuerpos.set(ruta, d);
          else this.cuerpos.delete(ruta);
        }
        lista(col);
        this.programar();
      }, fallo));
    }
  }

  /** Junta las fotos que llegan seguidas en una sola reconstrucción. */
  private programar() {
    if (this.programado) return;
    this.programado = true;
    setTimeout(() => {
      this.programado = false;
      if (!this.cerrado) this.reconstruir();
    }, 30);
  }

  private reconstruir() {
    if (this.faltan > 0) return;
    const e = this.sembrado ? deDocumentos(this.cuerpos, this.ordenes, this.memoria) : null;
    if (!e) {
      this.cambiarModo('vacio');
      return;
    }
    const docs = aDocumentos(e, this.ordenes, this.memoria);
    // El eco de una escritura propia no cambia nada: no hace falta redibujar la app
    const d = diferencias(this.base, docs);
    if (this.modo === 'compartido' && !d.escribir.length && !d.borrar.length) return;
    this.base = docs;
    this.cambiarModo('compartido');
    this.av.estado(e);
  }

  private cambiarModo(m: Modo) {
    if (m === this.modo) return;
    this.modo = m;
    this.av.modo(m);
  }

  // ── Escritura ─────────────────────────────────────────────────────

  /** Escribe en la base de datos lo que ha cambiado respecto a lo último sincronizado. */
  publicar(e: Estado) {
    if (this.modo !== 'compartido') return;
    const docs = aDocumentos(e, this.ordenes, this.memoria);
    const { escribir, borrar } = diferencias(this.base, docs);
    this.base = docs;
    for (const [ruta, json] of escribir) this.encolar(ruta, json);
    for (const ruta of borrar) this.encolar(ruta, null);
  }

  private encolar(ruta: string, json: string | null) {
    const c = this.colas.get(ruta) ?? { pendiente: undefined, enCurso: false };
    c.pendiente = json;
    this.colas.set(ruta, c);
    if (!c.enCurso) void this.vaciar(ruta, c);
  }

  /** Una escritura a la vez por documento; si llega otra mientras tanto, solo cuenta la última. */
  private async vaciar(ruta: string, c: { pendiente: string | null | undefined; enCurso: boolean }) {
    c.enCurso = true;
    this.contar(+1);
    while (c.pendiente !== undefined && !this.cerrado) {
      const json = c.pendiente;
      c.pendiente = undefined;
      if (json && json.length > MAX_DOCUMENTO) {
        this.av.error('Hay una imagen demasiado grande para compartirla; súbela otra vez.');
        continue;
      }
      try {
        await this.conTurno(() => (json === null ? this.db.doc(ruta).delete() : this.db.doc(ruta).set(JSON.parse(json))));
      } catch (e) {
        this.fallido(ruta, e as Error);
      }
    }
    c.enCurso = false;
    this.colas.delete(ruta);
    this.contar(-1);
  }

  private fallido(ruta: string, e: Error) {
    if (e?.code === 'invalid_argument' && this.puedeEscribir !== true) {
      this.av.soloLectura();
      // Vuelve a lo que de verdad hay en la base de datos
      this.reconstruir();
    } else if (e?.code === 'quota_exceeded') {
      this.av.error('La base de datos de la party está llena: borrad imágenes o criaturas que no uséis.');
    } else {
      this.av.error(`No se ha podido guardar un cambio (${e?.code ?? 'error'}: ${ruta}).`);
    }
  }

  private contar(d: number) {
    this.pendientes += d;
    this.av.pendientes(this.pendientes);
  }

  /** Como mucho unas pocas llamadas a la vez, con reintentos si la base de datos pide calma. */
  private async conTurno<T>(f: () => Promise<T>): Promise<T> {
    while (this.enVuelo >= SIMULTANEAS) await new Promise<void>((r) => this.esperando.push(r));
    this.enVuelo++;
    try {
      for (let intento = 0; ; intento++) {
        try {
          return await f();
        } catch (e) {
          const code = (e as Error)?.code;
          if (intento >= 4 || (code !== 'resource_exhausted' && code !== 'unavailable')) throw e;
          await espera(400 * 2 ** intento + Math.random() * 300);
        }
      }
    } finally {
      this.enVuelo--;
      this.esperando.shift()?.();
    }
  }

  /**
   * Sube una partida entera a la base de datos vacía (los datos de este navegador o los de ejemplo).
   * Un lease sobre `party/meta` evita que dos personas suban a la vez.
   */
  async subir(e: Estado, progreso: (hechos: number, total: number) => void): Promise<{ ok: true } | { ok: false; motivo: string }> {
    const meta = this.db.doc(DOC_META);
    const lease = await meta.acquire({ holder: `subida-${Math.random().toString(36).slice(2)}`, ttlMs: 300000 }).catch(() => null);
    if (!lease?.acquired) return { ok: false, motivo: 'Otra persona está subiendo los datos ahora mismo. Espera un momento.' };
    const m = await meta.get();
    if (m.exists && m.data()?.sembrado === true) return { ok: false, motivo: 'La party ya tiene datos compartidos.' };

    const docs = aDocumentos(e, this.ordenes, this.memoria);
    const grandes = [...docs].filter(([, j]) => j.length > MAX_DOCUMENTO);
    if (grandes.length) return { ok: false, motivo: `Hay ${grandes.length} documento(s) demasiado grandes.` };
    const lista = diferencias(new Map(), docs).escribir;
    let hechos = 0;
    progreso(0, lista.length);
    try {
      await Promise.all(lista.map(([ruta, json]) => this.conTurno(() => this.db.doc(ruta).set(JSON.parse(json))).then(() => progreso(++hechos, lista.length))));
      await meta.set({ sembrado: true, fecha: Date.now() });
    } catch (err) {
      const code = (err as Error)?.code;
      return {
        ok: false,
        motivo: code === 'invalid_argument' ? 'No tienes permiso para escribir en esta party.'
          : code === 'quota_exceeded' ? 'No cabe todo en la base de datos de la party.'
            : `No se ha podido subir todo (${code ?? 'error'}). Vuelve a intentarlo.`,
      };
    }
    return { ok: true };
  }
}
