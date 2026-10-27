import { describe, expect, it } from 'vitest';
import { estadoInicial } from '../data/semilla';
import { claveComida, comer, despensa, diasDeComida, pasarDia } from './despensa';
import type { Estado, Objeto } from './tipos';

const e0 = estadoInicial();
const comida = (nombre: string, e: Estado = e0) => despensa(e).find((c) => c.nombre === nombre)!;
const total = (e: Estado, nombre: string) => e.objetos.filter((o) => o.nombre === nombre).reduce((s, o) => s + o.cantidad, 0);

describe('despensa', () => {
  it('junta la comida de todos los dueños', () => {
    const c = comida('Raciones de viaje');
    expect(c.cantidad).toBe(total(e0, 'Raciones de viaje'));
    expect(despensa(e0).every((x) => x.pilas.every((o) => o.categoria === 'Comida'))).toBe(true);
  });

  it('comer suma la saciedad con tope de 100 y gasta 1 unidad', () => {
    const ysolde = e0.personajes.find((p) => p.id === 'ysolde')!;
    const c = comida('Estofado de jabalí');
    const r = comer(e0, 'ysolde', c.clave);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.estado.personajes.find((p) => p.id === 'ysolde')!.saciedad).toBe(Math.min(100, ysolde.saciedad + 50));
    expect(total(r.estado, 'Estofado de jabalí')).toBe(c.cantidad - 1);

    const lleno = { ...e0, personajes: e0.personajes.map((p) => (p.id === 'aldric' ? { ...p, saciedad: 90 } : p)) };
    const r2 = comer(lleno, 'aldric', c.clave);
    if (!r2.ok) throw new Error(r2.motivo);
    expect(r2.estado.personajes.find((p) => p.id === 'aldric')!.saciedad).toBe(100);
    expect(comer(r2.estado, 'aldric', c.clave).ok).toBe(false);
  });

  it('gasta primero lo propio, luego el alijo, luego lo de otros', () => {
    const base: Omit<Objeto, 'id' | 'propietario'> = {
      nombre: 'Galleta', icono: 'bread', categoria: 'Comida', rareza: 'común', cantidad: 1, pesoKg: 0.1, valorPo: 0, saciedad: 10, equipadoEn: null,
    };
    const e: Estado = {
      ...e0,
      objetos: [
        { ...base, id: 'g1', propietario: { tipo: 'personaje', id: 'brom' } },
        { ...base, id: 'g2', propietario: { tipo: 'alijo' } },
        { ...base, id: 'g3', propietario: { tipo: 'personaje', id: 'nerys' } },
      ],
    };
    const k = claveComida(e.objetos[0]);
    const r1 = comer(e, 'nerys', k);
    if (!r1.ok) throw new Error(r1.motivo);
    expect(r1.estado.objetos.map((o) => o.id)).toEqual(['g1', 'g2']);
    const r2 = comer(r1.estado, 'nerys', k);
    if (!r2.ok) throw new Error(r2.motivo);
    expect(r2.estado.objetos.map((o) => o.id)).toEqual(['g1']);
  });

  it('lo que no se come solo no se puede comer', () => {
    expect(comer(e0, 'aldric', comida('Saco de harina').clave).ok).toBe(false);
  });

  it('un día de viaje quita 25 sin bajar de 0', () => {
    const e = pasarDia(e0);
    e.personajes.forEach((p, i) => expect(p.saciedad).toBe(Math.max(0, e0.personajes[i].saciedad - 25)));
  });

  it('días de comida de la party', () => {
    const puntos = despensa(e0).reduce((s, c) => s + c.saciedad * c.cantidad, 0);
    expect(diasDeComida(e0)).toBe(Math.floor(puntos / (25 * e0.personajes.length)));
  });
});
