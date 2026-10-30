import { describe, expect, it } from 'vitest';
import { estadoInicial } from '../data/semilla';
import {
  cambiarEstiloDados, cambiarSeleccion, critico, dadosEnMesa, esTirada, estiloDe, formula, formulaDe, MAX_DADOS, tintaPara, tirar, total,
  type Tirada,
} from './dados';

describe('dados', () => {
  it('fórmula', () => {
    expect(formula({ d20: 1, d6: 2 }, 3)).toBe('2d6 + 1d20 + 3');
    expect(formula({ d8: 1 }, -1)).toBe('1d8 − 1');
    expect(formula({})).toBe('');
  });
  it('selección con clic izquierdo y derecho, sin pasar del máximo', () => {
    let s = cambiarSeleccion({}, 'd6', 1);
    s = cambiarSeleccion(s, 'd6', 1);
    expect(s).toEqual({ d6: 2 });
    expect(cambiarSeleccion(cambiarSeleccion(s, 'd6', -1), 'd6', -1)).toEqual({});
    expect(cambiarSeleccion({}, 'd6', -1)).toEqual({});
    const lleno = { d6: MAX_DADOS - 1 };
    expect(cambiarSeleccion(lleno, 'd100', 1)).toBe(lleno); // el d100 son dos dados
    expect(dadosEnMesa(cambiarSeleccion(lleno, 'd4', 1))).toBe(MAX_DADOS);
  });
  it('tirar y sumar', () => {
    const dados = tirar({ d6: 2, d20: 1 }, (c) => c);
    expect(dados).toEqual([{ tipo: 'd6', valor: 6 }, { tipo: 'd6', valor: 6 }, { tipo: 'd20', valor: 20 }]);
    expect(total({ dados, modificador: -2 })).toBe(30);
    expect(formulaDe({ dados, modificador: -2 })).toBe('2d6 + 1d20 − 2');
    expect(critico(dados[2])).toBe('exito');
    expect(critico({ tipo: 'd20', valor: 1 })).toBe('pifia');
    expect(critico({ tipo: 'd6', valor: 1 })).toBeNull();
  });
  it('azar dentro del rango', () => {
    const vistos = new Set(tirar({ d4: 20 }).map((d) => d.valor));
    for (const v of vistos) expect(v >= 1 && v <= 4).toBe(true);
  });
  it('tinta legible', () => {
    expect(tintaPara('#f0f0f0')).toBe('#1a1410');
    expect(tintaPara('#202020')).toBe('#f3e6c4');
  });
  it('tirada que llega de otro jugador', () => {
    const t: Tirada = { id: 'a', fecha: 1, quien: 'dm', nombre: 'DM', estilo: estiloDe(undefined), dados: [{ tipo: 'd100', valor: 100 }], modificador: 0 };
    expect(esTirada(t)).toBe(true);
    expect(esTirada({ ...t, dados: [{ tipo: 'd6', valor: 7 }] })).toBe(false);
    expect(esTirada({ ...t, estilo: { ...t.estilo, color: 'red' } })).toBe(false);
    expect(esTirada(null)).toBe(false);
  });
  it('estilo por personaje', () => {
    const e = estadoInicial();
    const p = e.personajes[0];
    expect(estiloDe(p).color).toBe(p.color);
    const nuevo = { color: '#123456', tinta: '#ffffff', acabado: 'metal' as const };
    expect(estiloDe(cambiarEstiloDados(e, p.id, nuevo).personajes[0])).toEqual(nuevo);
    expect(() => cambiarEstiloDados(e, 'nadie', nuevo)).toThrow();
  });
});
