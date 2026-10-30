// Sincronización entre jugadores con Supabase. Cada party es una fila de la tabla `parties` con todo el
// estado en JSON y un número de versión (supabase/esquema.sql).
//
// Cada cambio es una función pura (Estado → Estado). Se aplica al momento en pantalla y se envía con
// «actualiza si la versión sigue siendo N». Si otro jugador guardó antes, se descarga su estado y se
// vuelven a aplicar encima los cambios pendientes: así dos jugadores que mueven objetos a la vez no se
// pisan, y un movimiento que ya no vale (el objeto lo cogió otro) se descarta. El tiempo real solo avisa
// de que hay versión nueva; el estado se descarga aparte para no depender del tamaño del mensaje.

import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { Estado } from '../domain/tipos';

export type Op = (e: Estado) => Estado;

/** local: sin Supabase o sin party; el resto, el estado de la conexión con la party. */
export type Conexion = 'local' | 'conectando' | 'sincronizado' | 'guardando' | 'sin-conexion';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const CLAVE = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const TABLA = 'parties';
const BUCKET = 'imagenes';

/** Hay Supabase configurado (variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY). */
export const supabaseDisponible = !!(URL && CLAVE);

let cliente: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!supabaseDisponible) throw new Error('Supabase no está configurado');
  cliente ??= createClient(URL!, CLAVE!, { auth: { persistSession: false } });
  return cliente;
}

/** Código corto y fácil de dictar en la mesa: sin 0/O ni 1/I/L. */
export function nuevoCodigo() {
  const letras = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint32Array(6));
  return Array.from(r, (n) => letras[n % letras.length]).join('');
}

export const normalizarCodigo = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** Aplica una operación; si ya no vale sobre ese estado, lo deja como estaba. */
const probar = (e: Estado, op: Op) => { try { return op(e); } catch { return e; } };

/** `descartado`: un cambio de este jugador ya no valía sobre lo que guardó otro y no se ha aplicado. */
type Emitir = (estado: Estado, conexion: Conexion, descartado?: boolean) => void;

export class Sala {
  private pendientes: Op[] = [];
  private enviando = false;
  private ultimaVista: number;
  private canal?: RealtimeChannel;
  private cerrada = false;
  private conexion: Conexion = 'sincronizado';
  private alVolver = () => { if (document.visibilityState === 'visible') void this.recargar(); };
  private limpieza?: ReturnType<typeof setTimeout>;

  private constructor(
    readonly codigo: string,
    private base: Estado,
    private version: number,
    private emitir: Emitir,
    private migrar: (e: Estado) => Estado,
  ) {
    this.ultimaVista = version;
    this.escuchar();
    document.addEventListener('visibilitychange', this.alVolver);
    this.programarLimpieza(5000);
    this.emitirActual();
  }

  /** Entra en una party existente; null si ese código no existe. */
  static async abrir(codigo: string, emitir: Emitir, migrar: (e: Estado) => Estado): Promise<Sala | null> {
    const { data, error } = await sb().from(TABLA).select('estado, version').eq('id', codigo).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return new Sala(codigo, migrar(data.estado as Estado), data.version as number, emitir, migrar);
  }

  /** Crea una party nueva con este estado (el que el jugador tenía en su navegador). */
  static async crear(estado: Estado, emitir: Emitir, migrar: (e: Estado) => Estado): Promise<Sala> {
    for (let intento = 0; intento < 5; intento++) {
      const codigo = nuevoCodigo();
      const { error } = await sb().from(TABLA).insert({ id: codigo, estado, version: 1 });
      if (!error) return new Sala(codigo, estado, 1, emitir, migrar);
      if (error.code !== '23505') throw error; // 23505: código repetido, se prueba otro
    }
    throw new Error('No se pudo crear la party');
  }

  /** Lo que se ve: el último estado guardado con los cambios pendientes encima. */
  actual(): Estado {
    return this.pendientes.reduce(probar, this.base);
  }

  aplicar(op: Op) {
    if (this.cerrada) return;
    this.pendientes.push(op);
    this.emitirActual();
    void this.bombear();
  }

  cerrar() {
    this.cerrada = true;
    document.removeEventListener('visibilitychange', this.alVolver);
    clearTimeout(this.limpieza);
    if (this.canal) void sb().removeChannel(this.canal);
  }

  private emitirActual(conexion?: Conexion, descartado = false) {
    if (conexion) this.conexion = conexion;
    if (!this.cerrada) this.emitir(this.actual(), this.pendientes.length && this.conexion === 'sincronizado' ? 'guardando' : this.conexion, descartado);
  }

  private escuchar() {
    this.canal = sb()
      .channel(`party:${this.codigo}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: TABLA, filter: `id=eq.${this.codigo}` }, (cambio) => {
        const v = (cambio.new as { version?: number }).version;
        if (typeof v !== 'number' || v <= this.version) return;
        this.ultimaVista = Math.max(this.ultimaVista, v);
        if (!this.enviando) void this.recargar();
      })
      .subscribe((estado) => {
        // Al reconectar puede haberse perdido algún aviso: se comprueba la versión
        if (estado === 'SUBSCRIBED') void this.recargar();
      });
  }

  /** Envía los cambios pendientes de uno en uno, reintentando sobre el estado nuevo si hay conflicto. */
  private async bombear() {
    if (this.enviando) return;
    this.enviando = true;
    try {
      while (this.pendientes.length && !this.cerrada) {
        const op = this.pendientes[0];
        let nuevo: Estado;
        try {
          nuevo = op(this.base);
        } catch {
          this.pendientes.shift(); // ya no vale: otro jugador cambió lo que tocaba
          this.emitirActual(undefined, true);
          continue;
        }
        const { data, error } = await sb().from(TABLA)
          .update({ estado: nuevo, version: this.version + 1, actualizado: new Date().toISOString() })
          .eq('id', this.codigo).eq('version', this.version).select('version');
        if (error) {
          this.emitirActual('sin-conexion');
          await esperar(3000);
          continue;
        }
        if (!data?.length) {
          await this.descargar(); // conflicto: alguien guardó antes
          continue;
        }
        this.base = nuevo;
        this.version = data[0].version as number;
        this.pendientes.shift();
        this.emitirActual('sincronizado');
        this.programarLimpieza();
      }
    } finally {
      this.enviando = false;
    }
    if (this.ultimaVista > this.version) void this.recargar();
  }

  private async descargar(): Promise<boolean> {
    const { data, error } = await sb().from(TABLA).select('estado, version').eq('id', this.codigo).maybeSingle();
    if (error || !data) {
      this.emitirActual('sin-conexion');
      await esperar(3000);
      return false;
    }
    if ((data.version as number) > this.version) {
      this.base = this.migrar(data.estado as Estado);
      this.version = data.version as number;
    }
    this.emitirActual('sincronizado');
    return true;
  }

  private async recargar() {
    if (this.enviando || this.cerrada) return;
    this.enviando = true;
    try {
      await this.descargar();
    } finally {
      this.enviando = false;
    }
    if (this.pendientes.length) void this.bombear();
  }

  /** Tras un rato sin guardar nada, borra las imágenes de la party que ya no usa nadie. */
  private programarLimpieza(ms = 60_000) {
    clearTimeout(this.limpieza);
    this.limpieza = setTimeout(() => void this.limpiarImagenes().catch(() => {}), ms);
  }

  /**
   * Cambiar un retrato o una imagen sube una nueva y deja la anterior sin usar, igual que subir una y cancelar
   * el editor. Se compara con el estado recién descargado (y lo pendiente de aquí) para no borrar una que otro
   * jugador acaba de volver a poner, y se respetan las de menos de una hora: puede tenerlas un editor abierto.
   */
  private async limpiarImagenes() {
    if (this.cerrada) return;
    const almacen = sb().storage.from(BUCKET);
    const { data: archivos, error } = await almacen.list(this.codigo, { limit: 1000 });
    if (error || !archivos?.length) return;
    const { data: fila } = await sb().from(TABLA).select('estado').eq('id', this.codigo).maybeSingle();
    if (!fila || this.cerrada) return;
    const usadas = JSON.stringify(fila.estado) + JSON.stringify(this.actual());
    const hace1h = Date.now() - 3600_000;
    const sobran = archivos
      .filter((a) => a.id && !usadas.includes(a.name) && a.created_at && new Date(a.created_at).getTime() < hace1h)
      .map((a) => `${this.codigo}/${a.name}`);
    if (sobran.length) await almacen.remove(sobran);
  }
}

/** Sube una imagen al almacenamiento de la party y devuelve su URL pública. */
export async function subirImagen(codigo: string, dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const ruta = `${codigo}/${crypto.randomUUID()}.webp`;
  const { error } = await sb().storage.from(BUCKET).upload(ruta, blob, { contentType: blob.type || 'image/webp' });
  if (error) throw error;
  return sb().storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
}
