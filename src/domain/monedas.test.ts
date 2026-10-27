import { describe, expect, it } from 'vitest';
import { estadoInicial } from '../data/semilla';
import { aMonedaAlta, aplicarMonedas, cambio, CERO, repartir, valorPc } from './monedas';

const m = (x: Partial<typeof CERO>) => ({ ...CERO, ...x });

describe('repartir botín', () => {
  it('moneda a moneda, con el resto al tesoro (ejemplo del diseño)', () => {
    const r = repartir(m({ po: 450, pp: 120, pc: 300 }), 4);
    expect(r.cada).toEqual(m({ po: 112, pp: 30, pc: 75 }));
    expect(r.resto).toEqual(m({ po: 2 }));
  });
  it('convirtiendo a la moneda más alta no pierde valor', () => {
    const botin = m({ po: 450, pp: 120, pc: 301 });
    const r = repartir(botin, 4, true);
    expect(valorPc(r.cada) * 4 + valorPc(r.resto)).toBe(valorPc(botin));
    expect(r.cada).toEqual(aMonedaAlta(11625));
    expect(r.resto).toEqual(m({ pc: 1 }));
  });
});

describe('cambio', () => {
  it('solo si sale exacto', () => {
    expect(cambio(3, 'ppt', 'po')).toBe(30);
    expect(cambio(25, 'pp', 'po')).toBeNull();
    expect(cambio(20, 'pp', 'po')).toBe(2);
  });
});

describe('aplicar monedas', () => {
  const e0 = estadoInicial();
  it('mueve del tesoro a un personaje y lo registra', () => {
    const r = aplicarMonedas(e0, [
      { bolsa: 'tesoro', delta: m({ po: -100 }) },
      { bolsa: { personajeId: 'nerys' }, delta: m({ po: 100 }) },
    ], 'Test', 'Prueba');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.estado.party.tesoro.po).toBe(e0.party.tesoro.po - 100);
    expect(r.estado.personajes.find((p) => p.id === 'nerys')!.monedas.po).toBe(248);
    expect(r.estado.registroMonedas?.[0]).toMatchObject({ actor: 'Test', texto: 'Prueba' });
  });
  it('rechaza dejar una bolsa en negativo', () => {
    expect(aplicarMonedas(e0, [{ bolsa: 'tesoro', delta: m({ ppt: -13 }) }], 'Test', 'x').ok).toBe(false);
  });
  it('rechaza el sobrepeso por monedas', () => {
    // Ysolde va por 47 kg de 68: 3.000 monedas son 27 kg
    const r = aplicarMonedas(e0, [{ bolsa: { personajeId: 'ysolde' }, delta: m({ pc: 3000 }) }], 'Test', 'x');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/^Sobrepeso: Ysolde Mirra/);
  });
});
