import { describe, expect, it } from 'vitest';
import { estadoInicial } from '../data/semilla';
import { tiradaAtaque, tiradaDano } from './ataques';
import { criticoDe, crearTirada, descartados, esTirada, parsearFormula, total, type Tirada } from './dados';
import { hoja } from './hoja';

const e0 = estadoInicial();
const aldric = e0.personajes.find((p) => p.id === 'aldric')!;
const espada = hoja(e0, aldric).ataques.find((a) => a.ranura === 'cuerpoACuerpo')!;

describe('fórmulas de dados', () => {
  it('entiende varias formas y rechaza lo que no se puede tirar en 3D', () => {
    expect(parsearFormula('2d6+2')).toEqual({ seleccion: { d6: 2 }, modificador: 2 });
    expect(parsearFormula('1d8 + 1d6 − 1')).toEqual({ seleccion: { d8: 1, d6: 1 }, modificador: -1 });
    expect(parsearFormula('d20')).toEqual({ seleccion: { d20: 1 }, modificador: 0 });
    expect(parsearFormula('1d3')).toBeNull();
    expect(parsearFormula('5')).toBeNull();
    expect(parsearFormula('2d6 de fuego')).toBeNull();
    expect(parsearFormula('30d6')).toBeNull();
  });
});

describe('ventaja y crítico', () => {
  const t = (valores: number[], extra: Partial<Tirada> = {}): Tirada => ({
    id: 'x', fecha: 0, quien: 'dm', nombre: 'DM', estilo: { color: '#000000', tinta: '#ffffff', acabado: 'mate' },
    dados: valores.map((valor) => ({ tipo: 'd20' as const, valor })), modificador: 3, ...extra,
  });
  it('con ventaja cuenta el d20 más alto; con desventaja, el más bajo', () => {
    expect(total(t([4, 17], { modo: 'ventaja' }))).toBe(20);
    expect(total(t([4, 17], { modo: 'desventaja' }))).toBe(7);
    expect([...descartados(t([4, 17], { modo: 'ventaja' }))]).toEqual([0]);
  });
  it('el crítico mira solo el dado que cuenta y el rango del arma', () => {
    expect(criticoDe(t([20, 3], { modo: 'desventaja' }))).toBeNull();
    expect(criticoDe(t([19], { critMin: 19 }))).toBe('exito');
    expect(criticoDe(t([1]))).toBe('pifia');
  });
  it('una tirada creada pasa la validación al llegar a otro jugador', () => {
    const x = crearTirada({ quien: 'aldric', nombre: 'Aldric', estilo: { color: '#112233', tinta: '#ffffff', acabado: 'metal' }, seleccion: { d20: 2 }, modificador: 5, modo: 'ventaja', motivo: 'Espada · ataque' });
    expect(esTirada(x)).toBe(true);
    expect(esTirada({ ...x, modo: 'trampa' })).toBe(false);
  });
});

describe('tiradas de armas', () => {
  it('ataque: 1d20 + bono, o 2d20 con ventaja', () => {
    expect(tiradaAtaque(espada)).toMatchObject({ seleccion: { d20: 1 }, modificador: espada.bono.total });
    expect(tiradaAtaque(espada, 'ventaja')).toMatchObject({ seleccion: { d20: 2 }, modo: 'ventaja' });
  });
  it('daño: dados del arma, modificador y extras; en crítico se doblan los dados', () => {
    const d = tiradaDano(espada)!;
    expect(d.modificador).toBe(espada.danoMod.total);
    const crit = tiradaDano(espada, { critico: true })!;
    for (const [tipo, n] of Object.entries(d.seleccion)) expect(crit.seleccion[tipo as 'd8']).toBe(n * 2);
    expect(crit.modificador).toBe(d.modificador);
  });
});
