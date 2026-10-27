import { describe, expect, it } from 'vitest';
import { estadoInicial } from '../data/semilla';
import { crearObjeto, editarObjeto, objetoEnBlanco } from './objetos';
import {
  alternarSintonia, ataque, colocar, ordenarInventario, cargaMaxKg, sintonizadosDe, equipadoEn, estadoSaciedad, modificador, moverObjeto, objetosDe, pesoMonedasKg,
  pesoPersonajeKg, resumenInventario, totalEnPo, tramoCarga, validarMovimiento,
} from './reglas';

const e0 = estadoInicial();
const pj = (id: string) => e0.personajes.find((p) => p.id === id)!;
const objeto = (nombre: string, e = e0) => e.objetos.find((o) => o.nombre === nombre)!;

describe('reglas 5e', () => {
  it('modificador', () => {
    expect(modificador(18)).toBe(4);
    expect(modificador(8)).toBe(-1);
    expect(modificador(11)).toBe(0);
  });
  it('carga máxima en kg', () => {
    expect(cargaMaxKg(18)).toBe(122);
    expect(cargaMaxKg(8)).toBe(54);
    expect(cargaMaxKg(10)).toBe(68);
  });
  it('tramos de carga', () => {
    expect(tramoCarga(30, 120).id).toBe('normal');
    expect(tramoCarga(50, 120).id).toBe('cargado');
    expect(tramoCarga(90, 120).id).toBe('sobrecargado');
  });
  it('monedas', () => {
    expect(pesoMonedasKg({ ppt: 0, po: 50, pe: 0, pp: 0, pc: 0 })).toBeCloseTo(0.45);
    expect(totalEnPo({ ppt: 1, po: 1, pe: 2, pp: 10, pc: 100 })).toBe(14);
  });
  it('saciedad', () => {
    expect(estadoSaciedad(86).texto).toBe('Saciado');
    expect(estadoSaciedad(40).texto).toBe('Normal');
    expect(estadoSaciedad(27).texto).toBe('Hambriento');
    expect(estadoSaciedad(8).texto).toBe('Famélico');
  });
  it('ataque con espada mágica +1 de un paladín 5 con FUE 18', () => {
    const espada = objeto('Hoja del Alba Cenicienta');
    expect(ataque(pj('aldric'), espada, 'cuerpoACuerpo')).toEqual({ bono: 8, dano: '1d8+5', tipo: 'cortante' });
  });
  it('arma sutil usa la mejor de FUE y DES', () => {
    expect(ataque(pj('ysolde'), objeto('Estoque de Rivenhold'), 'cuerpoACuerpo')?.bono).toBe(4 + 3 + 1);
  });
});

describe('mover objetos', () => {
  it('rechaza el sobrepeso con el motivo', () => {
    const ysolde = { propietario: { tipo: 'personaje' as const, id: 'ysolde' } };
    const e1 = moverObjeto(e0, objeto('Saco de dormir').id, ysolde, 'Test');
    const v = validarMovimiento(e1, objeto('Cota de escamas', e1).id, ysolde);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.motivo).toMatch(/^Sobrepeso: \d+,\d kg supera su máximo de 68 kg$/);
  });
  it('rechaza una ranura incompatible', () => {
    const v = validarMovimiento(e0, objeto('Escudo').id, { propietario: { tipo: 'personaje', id: 'brom' }, equipar: { ranura: 'cabeza', indice: 0 } });
    expect(v.ok).toBe(false);
  });
  it('divide la pila y la junta con la del destino', () => {
    const pociones = e0.objetos.find((o) => o.nombre === 'Poción de curación' && o.propietario.tipo === 'alijo')!;
    const e1 = moverObjeto(e0, pociones.id, { propietario: { tipo: 'personaje', id: 'nerys' } }, 'Test', 3);
    const deNerys = objetosDe(e1, { tipo: 'personaje', id: 'nerys' }).filter((o) => o.nombre === 'Poción de curación');
    expect(deNerys).toHaveLength(1);
    expect(deNerys[0].cantidad).toBe(5);
    expect(e1.objetos.find((o) => o.id === pociones.id)!.cantidad).toBe(3);
    expect(e1.movimientos[0]).toMatchObject({ actor: 'Test', cantidad: 3, objetoNombre: 'Poción de curación' });
    const nerys = e1.personajes.find((p) => p.id === 'nerys')!;
    expect(pesoPersonajeKg(e1, nerys) - pesoPersonajeKg(e0, nerys)).toBeCloseTo(1.5);
  });
  it('equipar en una ranura ocupada devuelve el anterior al inventario', () => {
    const corona = objeto('Corona del Rey Ahogado');
    const yelmo = objeto('Yelmo del centinela');
    const e1 = moverObjeto(e0, corona.id, { propietario: { tipo: 'personaje', id: 'aldric' }, equipar: { ranura: 'cabeza', indice: 0 } }, 'Test');
    expect(equipadoEn(e1, 'aldric', 'cabeza', 0)?.id).toBe(corona.id);
    expect(e1.objetos.find((o) => o.id === yelmo.id)!.equipadoEn).toBeNull();
  });
  it('cambiar de dueño quita la sintonización', () => {
    const medallon = objeto('Medallón del Juramento');
    const e1 = moverObjeto(e0, medallon.id, { propietario: { tipo: 'alijo' } }, 'Test');
    expect(e1.objetos.find((o) => o.id === medallon.id)!.sintonizado).toBe(false);
  });
});

describe('sintonización', () => {
  it('pide elegir al intentar el 4.º objeto y luego sustituye', () => {
    // Aldric tiene 3: Hoja del Alba, Medallón y Anillo de protección
    const e1 = moverObjeto(e0, objeto('Corona del Rey Ahogado').id, { propietario: { tipo: 'personaje', id: 'aldric' } }, 'Test');
    const corona = objeto('Corona del Rey Ahogado', e1);
    const r = alternarSintonia(e1, corona.id);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.lleno).toHaveLength(3);
    const anillo = objeto('Anillo de protección', e1);
    const r2 = alternarSintonia(e1, corona.id, anillo.id);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(sintonizadosDe(r2.estado, 'aldric').map((o) => o.nombre).sort()).toEqual(['Corona del Rey Ahogado', 'Hoja del Alba Cenicienta', 'Medallón del Juramento']);
  });
  it('desintoniza si ya lo estaba y rechaza objetos del alijo', () => {
    const r = alternarSintonia(e0, objeto('Medallón del Juramento').id);
    expect(r.ok && sintonizadosDe(r.estado, 'aldric')).toHaveLength(2);
    expect(alternarSintonia(e0, objeto('Tomo de los Siete Sellos').id).ok).toBe(false);
  });
});

describe('datos de ejemplo', () => {
  it('nadie empieza por encima de su máximo', () => {
    for (const p of e0.personajes) expect(pesoPersonajeKg(e0, p)).toBeLessThanOrEqual(cargaMaxKg(p.fue));
  });
});

describe('estadísticas', () => {
  it('resumen del inventario de un personaje', () => {
    const p = pj('aldric');
    const propios = objetosDe(e0, { tipo: 'personaje', id: p.id });
    const r = resumenInventario(e0, p);
    expect(r.objetos).toBe(propios.length);
    expect(Object.values(r.porRareza).reduce((s, n) => s + n, 0)).toBe(propios.length);
    expect(r.valorPo).toBe(propios.reduce((s, o) => s + o.valorPo * o.cantidad, 0));
    expect(r.pesoKg).toBeCloseTo(pesoPersonajeKg(e0, p));
  });
});

describe('posiciones y orden del inventario', () => {
  const dueno = { tipo: 'personaje' as const, id: 'nerys' };
  const visibles = (e: typeof e0) => colocar(objetosDe(e, dueno).filter((o) => !o.equipadoEn), 0, 1);

  it('mover a una celda libre del propio inventario', () => {
    const [a] = visibles(e0);
    const e = moverObjeto(e0, a!.id, { propietario: dueno, posicion: 30 }, 'T');
    expect(visibles(e)[30]?.id).toBe(a!.id);
    expect(visibles(e)[0]?.id).not.toBe(a!.id);
  });

  it('soltar sobre otro objeto del mismo inventario intercambia los sitios', () => {
    const [a, b] = visibles(e0);
    const e = moverObjeto(e0, a!.id, { propietario: dueno, posicion: 1 }, 'T');
    expect(visibles(e)[0]?.id).toBe(b!.id);
    expect(visibles(e)[1]?.id).toBe(a!.id);
    expect(e.objetos.length).toBe(e0.objetos.length);
  });

  it('ordenar por rareza pone primero lo más raro y no toca el equipo', () => {
    const e = ordenarInventario(e0, dueno, 'rareza');
    const orden = ['artefacto', 'legendario', 'muy raro', 'raro', 'poco común', 'común'];
    const rarezas = visibles(e).filter(Boolean).map((o) => orden.indexOf(o!.rareza));
    expect(rarezas).toEqual([...rarezas].sort((x, y) => x - y));
    const equipo = (x: typeof e0) => objetosDe(x, dueno).filter((o) => o.equipadoEn).map((o) => o.id).sort();
    expect(equipo(e)).toEqual(equipo(e0));
  });

  it('ordenar junta las pilas iguales sin perder unidades', () => {
    const base = objetosDe(e0, dueno).find((o) => !o.equipadoEn && !o.sintonizado)!;
    const e1 = { ...e0, objetos: [...e0.objetos, { ...base, id: 'copia', cantidad: 2 }] };
    const e = ordenarInventario(e1, dueno, 'nombre');
    const pilas = objetosDe(e, dueno).filter((o) => o.nombre === base.nombre && !o.equipadoEn);
    expect(pilas.length).toBe(1);
    expect(pilas[0].cantidad).toBe(base.cantidad + 2);
  });
});

describe('alta y edición de objetos', () => {
  const datos = objetoEnBlanco({ tipo: 'personaje', id: 'nerys' });
  it('crea un objeto y rechaza el sobrepeso', () => {
    const r = crearObjeto(e0, { ...datos, nombre: 'Lámpara' }, 'T');
    if (!r.ok) throw new Error(r.motivo);
    expect(r.estado.objetos.find((o) => o.id === r.id)?.nombre).toBe('Lámpara');
    expect(crearObjeto(e0, { ...datos, nombre: 'Yunque', pesoKg: 500 }, 'T').ok).toBe(false);
    expect(crearObjeto(e0, { ...datos, nombre: '  ' }, 'T').ok).toBe(false);
  });
  it('cambiar de dueño al editar desequipa y quita la sintonización', () => {
    const o = e0.objetos.find((x) => x.sintonizado && x.equipadoEn)!;
    const { id: _id, equipadoEn: _eq, posicion: _p, sintonizado: _s, ...d } = o;
    const r = editarObjeto(e0, o.id, { ...d, propietario: { tipo: 'alijo' } });
    if (!r.ok) throw new Error(r.motivo);
    const n = r.estado.objetos.find((x) => x.id === o.id)!;
    expect(n.equipadoEn).toBeNull();
    expect(n.sintonizado).toBe(false);
  });
});
