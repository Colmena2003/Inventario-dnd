// Alta, edición y borrado de objetos, y la migración de lo guardado cuando cambia el modelo.

import { parsearFormula } from './dados';
import { anotarMovimiento, cargaMaxDe, fmtKg, mismoPropietario, nuevoId, pesoObjeto, pesoPersonajeKg, primerNombre, saciedadDesde100 } from './reglas';
import type { Estado, Modificador, Objeto, TipoObjeto } from './tipos';

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

/** Problemas que impiden guardar: nombre, cantidades y la carga de quien lo recibe. */
export function validarObjeto(e: Estado, o: Objeto): string | null {
  if (!o.nombre.trim()) return 'Ponle un nombre';
  if (!(o.cantidad >= 1)) return 'La cantidad tiene que ser 1 o más';
  if (o.pesoKg < 0 || o.valorPo < 0) return 'El peso y el valor no pueden ser negativos';
  if (o.categoria === 'Comida' && (o.saciedad == null || o.saciedad < 0)) return 'Indica cuánta saciedad llena';
  if (o.tiradaUso?.formula.trim() && !parsearFormula(o.tiradaUso.formula)) return 'La tirada al usarlo no se entiende: escribe dados como 2d6+2 (d4, d6, d8, d10, d12, d20 o d100)';
  if (o.propietario.tipo === 'personaje') {
    const pid = o.propietario.id;
    const p = e.personajes.find((x) => x.id === pid);
    if (!p) return 'El personaje ya no existe';
    const antes = e.objetos.find((x) => x.id === o.id);
    const yaLoTenia = antes && mismoPropietario(antes.propietario, o.propietario) ? pesoObjeto(antes) : 0;
    const peso = pesoPersonajeKg(e, p) - yaLoTenia + pesoObjeto(o);
    const max = cargaMaxDe(e, p);
    if (peso > max + 1e-9) return `Sobrepeso: ${primerNombre(p.nombre)} llevaría ${fmtKg(peso)} kg de un máximo de ${max} kg`;
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
  // Una armadura en el cuerpo sustituye la CA; un casco, guantes o botas solo suman (bonoCa), como un escudo
  const pieza = r.tipo === 'armadura' && r.ranuraEquipo !== 'armadura';
  if (r.tipo !== 'armadura' || pieza) delete r.armadura;
  if (r.tipo !== 'escudo' && !pieza) delete r.bonoCa;
  if (!r.modificadores?.length) delete r.modificadores;
  if (r.tiradaUso && !r.tiradaUso.formula.trim()) delete r.tiradaUso;
  if (r.alUsar && !r.alUsar.nombre.trim()) delete r.alUsar;
  if (r.otrasPropiedades) r.otrasPropiedades = r.otrasPropiedades.map((x) => x.trim()).filter(Boolean);
  return r;
}

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
  const cambiaDueno = !mismoPropietario(antes.propietario, o.propietario);
  if (cambiaDueno || (o.equipadoEn && o.equipadoEn.ranura !== o.ranuraEquipo)) o = { ...o, equipadoEn: null };
  if (cambiaDueno) o = { ...o, sintonizado: false };
  return {
    ...e,
    objetos: e.objetos.map((x) => (x.id === o.id ? o : x)),
    movimientos: cambiaDueno ? anotarMovimiento(e, o, o.cantidad, antes.propietario, o.propietario, actor) : e.movimientos,
  };
}

export const eliminarObjeto = (e: Estado, id: string): Estado => ({ ...e, objetos: e.objetos.filter((o) => o.id !== id) });

/** Hasta la versión 5 la velocidad iba en metros; 1,5 m son 5 pies. */
const pies = (metros: number) => Math.round(metros / 0.3);
const modsEnPies = (ms: Modificador[]) => ms.map((m) => (m.objetivo.startsWith('vel:') && m.valor ? { ...m, valor: pies(m.valor) } : m));
const conModsEnPies = <T extends { modificadores?: Modificador[]; alUsar?: Objeto['alUsar'] }>(o: T): T => ({
  ...o,
  ...(o.modificadores ? { modificadores: modsEnPies(o.modificadores) } : {}),
  ...(o.alUsar ? { alUsar: { ...o.alUsar, modificadores: modsEnPies(o.alUsar.modificadores) } } : {}),
});
const velocidadEnPies = (e: Estado): Estado => ({
  ...e,
  personajes: e.personajes.map((p) => ({
    ...p,
    ...(p.velocidad != null ? { velocidad: pies(p.velocidad) } : {}),
    ...(p.efectos ? { efectos: p.efectos.map((ef) => ({ ...ef, modificadores: modsEnPies(ef.modificadores) })) } : {}),
  })),
  objetos: e.objetos.map(conModsEnPies),
  ...(e.biblioteca ? { biblioteca: e.biblioteca.map(conModsEnPies) } : {}),
});

/** Hasta la versión 3 la saciedad iba de 0 a 100. */
const saciedadDe0a7 = (e: Estado): Estado => ({
  ...e,
  personajes: e.personajes.map((p) => ({ ...p, saciedad: saciedadDesde100(p.saciedad) })),
  objetos: e.objetos.map((o) => (o.saciedad ? { ...o, saciedad: Math.max(1, Math.round(o.saciedad / 10)) } : o)),
});

/** Versión del modelo de datos; al subirla, `migrar` pone al día lo guardado. */
export const VERSION_MODELO = 5;

/** Pone al día un estado guardado con un modelo anterior; solo cambia el formato, nunca el contenido. */
export function migrar(original: Estado): Estado {
  const version = original.version ?? 2;
  if (version >= VERSION_MODELO) return original;
  let e = original;
  if (version < 3) e = saciedadDe0a7(e);
  if (version < 5) e = velocidadEnPies(e);
  return { ...e, version: VERSION_MODELO, objetos: e.objetos.map((o) => ({ ...o, tipo: inferirTipo(o) })) };
}

/** Una party sin nadie: así empieza un navegador nuevo. */
export function estadoVacio(): Estado {
  return {
    version: VERSION_MODELO,
    party: { id: 'party-1', nombre: 'La Compañía', tesoro: { ppt: 0, po: 0, pe: 0, pp: 0, pc: 0 } },
    personajes: [], objetos: [], movimientos: [],
  };
}
