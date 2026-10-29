import { describe, expect, it } from 'vitest';
import { estadoInicial } from '../data/semilla';
import { crearCriatura, conocido, criaturaVacia, editarCriatura, pxPorDesafio, registrarEncuentro, validarCriatura, valorDesafio } from './bestiario';
import { cambiarImagenFicha, objetosDeFicha, olvidarFicha, recuperarFicha, registrarEnBiblioteca, sincronizarBiblioteca } from './biblioteca';
import { descansarEspacios, espaciosDe, espaciosMax, gastarEspacio, gastarPacto, pacto } from './conjuros';
import { cumpleFiltros, SIN_FILTROS } from './filtros';
import { editarObjeto, eliminarObjeto } from './objetos';
import { moverObjeto, objetosDe, ordenarInventario, rejilla } from './reglas';
import type { Estado, Objeto, Personaje } from './tipos';

const e0 = sincronizarBiblioteca(estadoInicial(), 1);
const objeto = (nombre: string, e = e0) => e.objetos.find((o) => o.nombre === nombre)!;
const alijo = { tipo: 'alijo' as const };
const de = (id: string) => ({ tipo: 'personaje' as const, id });

describe('biblioteca', () => {
  it('cada objeto tiene ficha y las pilas iguales comparten la misma', () => {
    expect(e0.objetos.every((o) => o.fichaId)).toBe(true);
    const pociones = e0.objetos.filter((o) => o.nombre === 'Poción de curación');
    expect(new Set(pociones.map((o) => o.fichaId)).size).toBe(1);
  });
  it('editar un objeto pone su ficha al día', () => {
    const o = objeto('Poción de curación');
    const e1 = registrarEnBiblioteca(editarObjeto(e0, { ...o, descripcion: 'Sabe a menta' }, 'Test'), o.id, 2);
    const f = e1.biblioteca!.find((x) => x.id === o.fichaId)!;
    expect(f.descripcion).toBe('Sabe a menta');
    expect(f.actualizada).toBe(2);
  });
  it('lo que se gasta sigue en la biblioteca y se puede recuperar', () => {
    const o = objeto('Pergamino de Revivir');
    const e1 = sincronizarBiblioteca(eliminarObjeto(e0, o.id));
    expect(objetosDeFicha(e1, o.fichaId!)).toHaveLength(0);
    expect(e1.biblioteca!.find((f) => f.id === o.fichaId)!.ultimoDueno).toBe('Aldric Varn');
    const r = recuperarFicha(e1, o.fichaId!, de('brom'), 2, 'DM');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const nuevo = r.estado.objetos.find((x) => x.fichaId === o.fichaId)!;
    expect(nuevo).toMatchObject({ cantidad: 2, propietario: de('brom'), nombre: 'Pergamino de Revivir' });
  });
  it('no deja recuperar con sobrepeso ni olvidar lo que alguien tiene', () => {
    const o = objeto('Poción de curación');
    expect(recuperarFicha(e0, o.fichaId!, de('nerys'), 999, 'DM').ok).toBe(false);
    expect(olvidarFicha(e0, o.fichaId!).ok).toBe(false);
  });
  it('cambiar la imagen de una ficha cambia la de sus objetos', () => {
    const o = objeto('Poción de curación');
    const e1 = cambiarImagenFicha(e0, o.fichaId!, 'https://x/y.webp');
    expect(e1.objetos.filter((x) => x.fichaId === o.fichaId).every((x) => x.imagenUrl === 'https://x/y.webp')).toBe(true);
  });
});

describe('bestiario', () => {
  const huargo = { ...criaturaVacia(), nombre: 'Huargo', actitud: 'agresiva' as const, desafio: '1/2', ca: 13, pv: 26 };
  it('solo pide el nombre y números válidos', () => {
    expect(validarCriatura({ ...huargo, nombre: ' ' })).not.toBeNull();
    expect(validarCriatura({ ...huargo, ca: -1 })).not.toBeNull();
    expect(validarCriatura({ ...huargo, caracteristicas: { fue: 31 } })).not.toBeNull();
    expect(validarCriatura(huargo)).toBeNull();
  });
  it('se crea, se edita y cuenta encuentros', () => {
    const r = crearCriatura(e0, { ...huargo, botin: [{ nombre: '  ' }, { nombre: 'Colmillo', cantidad: '2d4' }] }, 'DM');
    if (!r.ok) throw new Error(r.motivo);
    expect(r.estado.bestiario![0].botin).toHaveLength(1);
    const r2 = editarCriatura(r.estado, r.id, { ...r.estado.bestiario![0], notas: 'Cazan en manada' });
    if (!r2.ok) throw new Error(r2.motivo);
    const e3 = registrarEncuentro(registrarEncuentro(r2.estado, r.id, true), r.id, false);
    expect(e3.bestiario![0]).toMatchObject({ encuentros: 2, derrotadas: 1, notas: 'Cazan en manada' });
  });
  it('PX y orden por desafío; cuánto se conoce', () => {
    expect(pxPorDesafio('1/2')).toBe(100);
    expect(valorDesafio('1/4')).toBe(0.25);
    expect(conocido({ ...huargo, id: 'c', creada: 0, actualizada: 0 })).toBeGreaterThan(0);
  });
});

describe('rejilla', () => {
  const o = (id: string, posicion?: number) => ({ id, posicion });
  it('respeta las posiciones y rellena huecos', () => {
    const celdas = rejilla([o('a', 3), o('b'), o('c', 0)], 0, 4);
    expect(celdas.map((x) => x?.id)).toEqual(['c', 'b', undefined, 'a', undefined, undefined, undefined, undefined]);
  });
  it('mover a una celda libre la deja ahí; a una ocupada por su dueño, se intercambian', () => {
    const inv = objetosDe(e0, de('nerys')).filter((x) => !x.equipadoEn);
    const [a, b] = inv;
    const e1 = moverObjeto(e0, a.id, { propietario: de('nerys'), posicion: 30 }, 'Test');
    expect(e1.objetos.find((x) => x.id === a.id)!.posicion).toBe(30);
    const e2 = moverObjeto(e1, b.id, { propietario: de('nerys'), posicion: 30 }, 'Test');
    const pa = e2.objetos.find((x) => x.id === a.id)!.posicion, pb = e2.objetos.find((x) => x.id === b.id)!.posicion;
    expect(pb).toBe(30);
    expect(pa).not.toBe(30);
  });
  it('ordenar junta pilas y las pone en orden', () => {
    const pocion = objeto('Poción de curación');
    const e1 = moverObjeto(e0, pocion.id, { propietario: de('aldric') }, 'Test', 1);
    const e2 = ordenarInventario(e1, de('aldric'), 'nombre');
    const inv = objetosDe(e2, de('aldric')).filter((x) => !x.equipadoEn).sort((a, b) => a.posicion! - b.posicion!);
    expect(inv.map((x) => x.posicion)).toEqual(inv.map((_, i) => i));
    expect(inv.filter((x) => x.nombre === 'Poción de curación')).toHaveLength(1);
    expect([...inv.map((x) => x.nombre)]).toEqual([...inv.map((x) => x.nombre)].sort((a, b) => a.localeCompare(b, 'es')));
  });
});

describe('espacios de conjuro', () => {
  const pj = (clases: Personaje['clases'], extra: Partial<Personaje> = {}) => ({ ...e0.personajes[0], clases, espaciosUsados: undefined, espaciosMax: undefined, pactoUsados: undefined, ...extra });
  it('salen de las tablas de 5e, con multiclase', () => {
    expect(espaciosMax(pj([{ clase: 'Hechicero', nivel: 3 }]))).toEqual([4, 2]);
    expect(espaciosMax(pj([{ clase: 'Paladín', nivel: 1 }]))).toEqual([]);
    expect(espaciosMax(pj([{ clase: 'Paladín', nivel: 5 }]))).toEqual([4, 2]);
    expect(espaciosMax(pj([{ clase: 'Monje', nivel: 3 }]))).toEqual([]);
    // Mago 3 + Paladín 2: nivel de lanzador 3 + 1 = 4
    expect(espaciosMax(pj([{ clase: 'Mago', nivel: 3 }, { clase: 'Paladín', nivel: 2 }]))).toEqual([4, 3]);
    expect(pacto(pj([{ clase: 'Brujo', nivel: 5 }]))).toEqual({ espacios: 2, nivel: 3 });
  });
  it('se gastan, no pasan del máximo y vuelven con el descanso que toca', () => {
    const e1: Estado = { ...e0, personajes: [pj([{ clase: 'Hechicero', nivel: 2 }, { clase: 'Brujo', nivel: 1 }], { id: 'x' })] };
    let e2 = gastarEspacio(gastarEspacio(gastarEspacio(e1, 'x', 1, 1), 'x', 1, 1), 'x', 1, 1);
    expect(() => gastarEspacio(e2, 'x', 1, 1)).toThrow();
    e2 = gastarPacto(e2, 'x', 1);
    expect(espaciosDe(e2.personajes[0])).toMatchObject({ niveles: [{ nivel: 1, max: 3, usados: 3 }], pacto: { usados: 1 } });
    const corto = descansarEspacios(e2, ['x'], 'corto').personajes[0];
    expect(espaciosDe(corto)).toMatchObject({ niveles: [{ usados: 3 }], pacto: { usados: 0 } });
    expect(espaciosDe(descansarEspacios(e2, ['x'], 'largo').personajes[0]).niveles[0].usados).toBe(0);
  });
});

describe('filtros', () => {
  const o = (x: Partial<Objeto>): Objeto => ({ id: 'o', nombre: 'Daga', icono: 'dagger', categoria: 'Armas', rareza: 'común', cantidad: 1, pesoKg: 0, valorPo: 0, propietario: alijo, equipadoEn: null, ...x });
  it('combinan texto, rareza, categoría y rasgos', () => {
    expect(cumpleFiltros(o({}), SIN_FILTROS)).toBe(true);
    expect(cumpleFiltros(o({}), SIN_FILTROS, 'espada')).toBe(false);
    expect(cumpleFiltros(o({ rareza: 'raro' }), { ...SIN_FILTROS, rarezas: ['raro', 'legendario'] })).toBe(true);
    expect(cumpleFiltros(o({}), { ...SIN_FILTROS, rasgos: ['magico'] })).toBe(false);
    expect(cumpleFiltros(o({ bonoMagico: 1 }), { ...SIN_FILTROS, rasgos: ['magico'], categorias: ['Armas'] })).toBe(true);
  });
});
