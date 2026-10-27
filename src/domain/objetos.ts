// Alta, edición y borrado de objetos (pantallas 7 y 8 del diseño). Funciones puras.

import { cargaMaxKg, fmtKg, mismoPropietario, nuevoId, pesoObjeto, pesoPersonajeKg } from './reglas';
import type { Estado, Objeto, Propietario } from './tipos';

export type DatosObjeto = Omit<Objeto, 'id' | 'equipadoEn' | 'posicion' | 'sintonizado'>;

export type ResultadoObjeto = { ok: true; estado: Estado; id: string } | { ok: false; motivo: string };

function comprobar(e: Estado, d: DatosObjeto, sinContar?: string): string | null {
  if (!d.nombre.trim()) return 'Ponle un nombre al objeto';
  if (!Number.isInteger(d.cantidad) || d.cantidad < 1) return 'La cantidad tiene que ser un número entero mayor que 0';
  if (!(d.pesoKg >= 0)) return 'El peso no puede ser negativo';
  if (!(d.valorPo >= 0)) return 'El valor no puede ser negativo';
  if (d.propietario.tipo === 'personaje') {
    const pid = d.propietario.id;
    const p = e.personajes.find((x) => x.id === pid);
    if (!p) return 'El personaje ya no existe';
    const max = cargaMaxKg(p.fue);
    // Sin el propio objeto si ya lo llevaba, para no contarlo dos veces
    const antes = e.objetos.find((o) => o.id === sinContar);
    const yaLoLleva = antes && mismoPropietario(antes.propietario, d.propietario) ? pesoObjeto(antes) : 0;
    const peso = pesoPersonajeKg(e, p) - yaLoLleva + d.pesoKg * d.cantidad;
    if (peso > max + 1e-9) return `Sobrepeso: ${p.nombre} llevaría ${fmtKg(peso)} kg y su máximo es ${max} kg`;
  }
  return null;
}

export function crearObjeto(e: Estado, d: DatosObjeto, actor: string): ResultadoObjeto {
  const error = comprobar(e, d);
  if (error) return { ok: false, motivo: error };
  const o: Objeto = { ...d, nombre: d.nombre.trim(), id: nuevoId('o'), equipadoEn: null, sintonizado: false, creadoPor: actor || undefined };
  return { ok: true, estado: { ...e, objetos: [...e.objetos, o] }, id: o.id };
}

/**
 * Cambia los datos de un objeto. Si pasa a otro dueño, se desequipa y pierde la sintonización;
 * si deja de encajar en la ranura donde está equipado, vuelve al inventario.
 */
export function editarObjeto(e: Estado, id: string, d: DatosObjeto): ResultadoObjeto {
  const o = e.objetos.find((x) => x.id === id);
  if (!o) return { ok: false, motivo: 'El objeto ya no existe' };
  const error = comprobar(e, d, id);
  if (error) return { ok: false, motivo: error };
  const cambiaDueno = !mismoPropietario(o.propietario, d.propietario);
  const sigueEquipado = !cambiaDueno && o.equipadoEn && d.ranuraEquipo === o.equipadoEn.ranura;
  const nuevo: Objeto = {
    ...o, ...d, nombre: d.nombre.trim(),
    equipadoEn: sigueEquipado ? o.equipadoEn : null,
    sintonizado: !cambiaDueno && !!d.requiereSintonizacion && !!o.sintonizado,
    posicion: cambiaDueno || (o.equipadoEn && !sigueEquipado) ? undefined : o.posicion,
  };
  return { ok: true, estado: { ...e, objetos: e.objetos.map((x) => (x.id === id ? nuevo : x)) }, id };
}

export function eliminarObjeto(e: Estado, id: string): Estado {
  return { ...e, objetos: e.objetos.filter((o) => o.id !== id) };
}

/** Datos de un objeto nuevo en blanco para el formulario. */
export const objetoEnBlanco = (propietario: Propietario): DatosObjeto => ({
  nombre: '', icono: 'bag', categoria: 'Varios', rareza: 'común', cantidad: 1, pesoKg: 0, valorPo: 0, propietario, ranuraEquipo: null,
});
