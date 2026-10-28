// Imágenes en el almacén de archivos del artefacto (capacidad `assets`): hasta 20 MiB por archivo, así
// que se guardan grandes y con calidad alta. La plataforma solo se lo da a quien puede editar el
// artefacto (Editor o dueño); para los demás, y fuera de claude.ai, la imagen se reduce hasta caber en
// un documento de la base de datos (unos 230 KB), como antes.
//
// En los datos se guarda la ruta «/_blob/<id>», que sirve tal cual como `src` desde cualquier versión
// del artefacto.

import { capacidad } from './compartido';
import { imagenGrande, reducirImagen } from '../ui/interaccion';

type Archivos = {
  upload(blob: Blob, opciones?: { type?: string }): Promise<{ id: string; url: string; sizeBytes: number }>;
};

/** Para qué es la imagen: decide el tamaño. */
export type UsoImagen = 'objeto' | 'personaje' | 'criatura';

const LADO: Record<UsoImagen, { grande: number; reducida: number }> = {
  objeto: { grande: 1200, reducida: 640 },
  personaje: { grande: 1600, reducida: 900 },
  criatura: { grande: 2400, reducida: 1100 },
};

export const PREFIJO_ARCHIVO = '/_blob/';

let archivos: Promise<Archivos | null> | null = null;
/** El almacén de archivos, o null si este visor no puede subir (o no está en claude.ai). */
export const almacenArchivos = () => (archivos ??= capacidad<Archivos>('assets'));

/**
 * Guarda una imagen subida y devuelve lo que va en `imagenUrl`. Si el almacén de archivos falla
 * (cuota llena, límite de llamadas…), se queda con la versión reducida en vez de perder la imagen.
 */
export async function guardarImagen(f: File, uso: UsoImagen): Promise<string> {
  const a = await almacenArchivos();
  if (a) {
    try {
      const blob = await imagenGrande(f, LADO[uso].grande);
      const r = await a.upload(blob, { type: blob.type });
      return PREFIJO_ARCHIVO + r.id;
    } catch (e) {
      console.warn('No se ha podido subir la imagen al almacén de archivos; se guarda reducida', e);
    }
  }
  return reducirImagen(f, LADO[uso].reducida);
}
