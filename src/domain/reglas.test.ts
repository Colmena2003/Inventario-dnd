import { describe, expect, it } from 'vitest';
import { estadoInicial } from '../data/semilla';
import {
  ataque, cargaMaxKg, equipadoEn, estadoSaciedad, modificador, moverObjeto, objetosDe, pesoMonedasKg,
  pesoPersonajeKg, totalEnPo, tramoCarga, validarMovimiento,
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

describe('datos de ejemplo', () => {
  it('nadie empieza por encima de su máximo', () => {
    for (const p of e0.personajes) expect(pesoPersonajeKg(e0, p)).toBeLessThanOrEqual(cargaMaxKg(p.fue));
  });
});
