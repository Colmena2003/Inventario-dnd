// Alta, edición y borrado de objetos, y la migración de lo guardado cuando cambia el modelo.

import { cargaMaxDe, fmtKg, nuevoId, pesoObjeto, pesoPersonajeKg, saciedadDesde100 } from './reglas';
import type { Estado, Movimiento, Objeto, Propietario, TipoObjeto } from './tipos';

/** Deduce el tipo de formulario de un objeto antiguo que no lo tiene guardado. */
export function inferirTipo(o: Objeto): TipoObjeto {
  if (o.tipo) return o.tipo;
  if (o.categoria === 'Comida') return 'comida';
  if (o.categoria === 'Pociones') return 'pocion';
  if (o.categoria === 'Pergaminos') return 'pergamino';
  if (o.categoria === 'Materiales') return 'material';
  if (o.categoria === 'Llaves/misión') return 'mision';
  if (o.subtipo === 'munición') return 'municion';
  if (o.dado) return 'arma';
  if (o.armadura || o.ranuraEquipo === 'armadura') return 'armadura';
  if (o.icono === 'shield' || (o.bonoCa && o.ranuraEquipo === 'cuerpoACuerpo')) return 'escudo';
  if (o.ranuraEquipo) return 'equipable';
  return 'varios';
}

const mismo = (a: Propietario, b: Propietario) =>
  a.tipo === b.tipo && (a.tipo === 'alijo' || (b.tipo === 'personaje' && a.id === b.id));

/** Problemas que impiden guardar: nombre, cantidades y la carga de quien lo recibe. */
export function validarObjeto(e: Estado, o: Objeto): string | null {
  if (!o.nombre.trim()) return 'Ponle un nombre';
  if (!(o.cantidad >= 1)) return 'La cantidad tiene que ser 1 o más';
  if (o.pesoKg < 0 || o.valorPo < 0) return 'El peso y el valor no pueden ser negativos';
  if (o.categoria === 'Comida' && (o.saciedad == null || o.saciedad < 0)) return 'Indica cuánta saciedad llena';
  if (o.propietario.tipo === 'personaje') {
    const pid = o.propietario.id;
    const p = e.personajes.find((x) => x.id === pid);
    if (!p) return 'El personaje ya no existe';
    const antes = e.objetos.find((x) => x.id === o.id);
    const yaLoTenia = antes && mismo(antes.propietario, o.propietario) ? pesoObjeto(antes) : 0;
    const peso = pesoPersonajeKg(e, p) - yaLoTenia + pesoObjeto(o);
    const max = cargaMaxDe(e, p);
    if (peso > max + 1e-9) return `Sobrepeso: ${p.nombre.split(' ')[0]} llevaría ${fmtKg(peso)} kg de un máximo de ${max} kg`;
  }
  return null;
}

/** Quita lo que no aplica al tipo para no guardar restos de otro formulario. */
export function limpiar(o: Objeto): Objeto {
  const r: Objeto = { ...o, nombre: o.nombre.trim() };
  if (!r.requiereSintonizacion) r.sintonizado = false;
  if (r.categoria !== 'Comida') delete r.saciedad;
  if (r.tipo !== 'arma') {
    for (const k of ['tipoArma', 'dado', 'dadoVersatil', 'tipoDano', 'bonoAtaque', 'bonoDano', 'propiedades', 'otrasPropiedades', 'rango', 'critico', 'danosExtra'] as const) delete r[k];
  }
  if (r.tipo !== 'armadura') delete r.armadura;
  if (r.tipo !== 'escudo') delete r.bonoCa;
  if (!r.modificadores?.length) delete r.modificadores;
  if (r.otrasPropiedades) r.otrasPropiedades = r.otrasPropiedades.map((x) => x.trim()).filter(Boolean);
  return r;
}

const movimiento = (o: Objeto, origen: Propietario, destino: Propietario, actor: string): Movimiento => ({
  id: nuevoId('m'), objetoId: o.id, objetoNombre: o.nombre, rareza: o.rareza, icono: o.icono,
  cantidad: o.cantidad, origen, destino, actor, fecha: Date.now(),
});

export function crearObjeto(e: Estado, datos: Objeto, actor: string): Estado {
  const o = limpiar({ ...datos, id: nuevoId('o'), equipadoEn: null, sintonizado: false, creadoPor: actor });
  return { ...e, objetos: [...e.objetos, o] };
}

/**
 * Guarda los cambios. Si cambia de dueño se desequipa, pierde la sintonización y queda en el historial;
 * si cambia la ranura en la que se equipa, vuelve al inventario.
 */
export function editarObjeto(e: Estado, datos: Objeto, actor: string): Estado {
  const antes = e.objetos.find((x) => x.id === datos.id);
  if (!antes) return e;
  let o = limpiar(datos);
  const cambiaDueno = !mismo(antes.propietario, o.propietario);
  if (cambiaDueno || (o.equipadoEn && o.equipadoEn.ranura !== o.ranuraEquipo)) o = { ...o, equipadoEn: null };
  if (cambiaDueno) o = { ...o, sintonizado: false };
  return {
    ...e,
    objetos: e.objetos.map((x) => (x.id === o.id ? o : x)),
    movimientos: cambiaDueno ? [movimiento(o, antes.propietario, o.propietario, actor), ...e.movimientos].slice(0, 200) : e.movimientos,
  };
}

export const eliminarObjeto = (e: Estado, id: string): Estado => ({ ...e, objetos: e.objetos.filter((o) => o.id !== id) });

/**
 * Pone al día un estado guardado con un modelo anterior. Los objetos y personajes de ejemplo toman los
 * datos nuevos de la semilla (armaduras, modificadores…) y conservan dónde están, cuántos hay y su estado.
 */
export function migrar(guardado: Estado, semilla: Estado): Estado {
  if ((guardado.version ?? 2) >= (semilla.version ?? 0)) return guardado;
  const objSemilla = new Map(semilla.objetos.map((o) => [o.id, o]));
  const pjSemilla = new Map(semilla.personajes.map((p) => [p.id, p]));
  const viejo = (guardado.version ?? 2) < 3;
  return {
    ...guardado,
    version: semilla.version,
    personajes: guardado.personajes.map((p) => {
      const s = pjSemilla.get(p.id);
      const saciedad = viejo ? saciedadDesde100(p.saciedad) : p.saciedad;
      return s
        ? { ...s, pvActual: p.pvActual, imagenUrl: p.imagenUrl, monedas: p.monedas, saciedad, condiciones: p.condiciones, px: p.px }
        : { ...p, saciedad };
    }),
    objetos: guardado.objetos.map((o) => {
      const s = objSemilla.get(o.id) ?? semilla.objetos.find((x) => x.nombre === o.nombre && x.rareza === o.rareza);
      const base = s
        ? { ...s, id: o.id, cantidad: o.cantidad, propietario: o.propietario, equipadoEn: o.equipadoEn, sintonizado: o.sintonizado, imagenUrl: o.imagenUrl }
        : { ...o, saciedad: viejo && o.saciedad ? Math.max(1, Math.round(o.saciedad / 10)) : o.saciedad };
      return { ...base, tipo: inferirTipo(base) };
    }),
  };
}
