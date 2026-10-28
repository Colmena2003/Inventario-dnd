import { describe, expect, it } from 'vitest';
import { estadoInicial } from '../data/semilla';
import { cambiarImagenFicha, completarBiblioteca, ejemplares, olvidar, recuperar, registrar } from './biblioteca';
import { crearObjeto, editarObjeto, eliminarObjeto, objetoEnBlanco } from './objetos';
import { moverObjeto } from './reglas';
import type { Estado } from './tipos';

const e0 = completarBiblioteca(estadoInicial(), 1);
const ficha = (e: Estado, id: string) => e.biblioteca!.find((f) => f.id === id)!;

describe('biblioteca', () => {
  it('al cargar, todos los objetos tienen ficha y los iguales comparten una', () => {
    expect(e0.objetos.every((o) => o.fichaId && ficha(e0, o.fichaId))).toBe(true);
    const nombres = e0.biblioteca!.map((f) => `${f.nombre.toLowerCase()}|${f.rareza}`);
    expect(new Set(nombres).size).toBe(nombres.length);
    expect(completarBiblioteca(e0, 2)).toBe(e0);
  });

  it('un objeto nuevo se guarda solo y conserva su descripción aunque se borre', () => {
    const datos = { ...objetoEnBlanco({ tipo: 'alijo' }), nombre: 'Cuerno de Valhalla', rareza: 'raro' as const, descripcion: 'Invoca guerreros espectrales.' };
    const r = crearObjeto(e0, datos, 'DM');
    if (!r.ok) throw new Error(r.motivo);
    const e1 = registrar(r.estado, r.id, 5);
    const o = e1.objetos.find((x) => x.id === r.id)!;
    expect(ficha(e1, o.fichaId!).descripcion).toBe('Invoca guerreros espectrales.');
    expect(ficha(e1, o.fichaId!).ultimoDueno).toBe('Alijo de la party');

    const e2 = eliminarObjeto(e1, r.id);
    expect(ficha(e2, o.fichaId!).nombre).toBe('Cuerno de Valhalla');
    expect(ejemplares(e2, o.fichaId!)).toHaveLength(0);
  });

  it('editar el objeto actualiza su ficha, incluso al borrar un campo', () => {
    const o = e0.objetos.find((x) => x.descripcion)!;
    const { id: _i, equipadoEn: _e, posicion: _p, sintonizado: _s, ...d } = o;
    const r = editarObjeto(e0, o.id, { ...d, descripcion: undefined, efectos: 'Brilla en la oscuridad.' });
    if (!r.ok) throw new Error(r.motivo);
    const f = ficha(registrar(r.estado, o.id, 9), o.fichaId!);
    expect(f.descripcion).toBeUndefined();
    expect(f.efectos).toBe('Brilla en la oscuridad.');
    expect(f.actualizada).toBe(9);
  });

  it('crear uno con el mismo nombre que una ficha no le borra lo que ya sabía', () => {
    const conDesc = e0.biblioteca!.find((f) => f.descripcion)!;
    const r = crearObjeto(e0, { ...objetoEnBlanco({ tipo: 'alijo' }), nombre: conDesc.nombre.toUpperCase(), rareza: conDesc.rareza }, 'DM');
    if (!r.ok) throw new Error(r.motivo);
    const e1 = registrar(r.estado, r.id);
    expect(e1.biblioteca).toHaveLength(e0.biblioteca!.length);
    expect(e1.objetos.find((x) => x.id === r.id)!.fichaId).toBe(conDesc.id);
    expect(ficha(e1, conDesc.id).descripcion).toBe(conDesc.descripcion);
  });

  it('recuperar crea el objeto otra vez, con sus cargas llenas, y respeta la carga', () => {
    const f = e0.biblioteca!.find((x) => x.cargasMax)!;
    const sinEl = e0.objetos.reduce((e, o) => (o.fichaId === f.id ? eliminarObjeto(e, o.id) : e), e0);
    const r = recuperar(sinEl, f.id, { tipo: 'alijo' }, 1, 'DM');
    if (!r.ok) throw new Error(r.motivo);
    const o = r.estado.objetos.find((x) => x.id === r.id)!;
    expect(o).toMatchObject({ nombre: f.nombre, fichaId: f.id, cargas: f.cargasMax, cantidad: 1 });

    const pesada = { ...e0, biblioteca: e0.biblioteca!.map((x) => (x.id === f.id ? { ...x, pesoKg: 9999 } : x)) };
    expect(recuperar(pesada, f.id, { tipo: 'personaje', id: 'aldric' }, 1, 'DM').ok).toBe(false);
  });

  it('dividir una pila mantiene la ficha; olvidar solo si nadie lo tiene', () => {
    const pila = e0.objetos.find((o) => o.cantidad > 1 && !o.equipadoEn)!;
    const e1 = moverObjeto(e0, pila.id, { propietario: { tipo: 'alijo' } }, 'DM', 1);
    expect(ejemplares(e1, pila.fichaId!).length).toBeGreaterThanOrEqual(1);
    expect(e1.objetos.filter((o) => o.nombre === pila.nombre).every((o) => o.fichaId === pila.fichaId)).toBe(true);
    expect(olvidar(e1, pila.fichaId!).ok).toBe(false);

    const sinEl = e1.objetos.reduce((e, o) => (o.fichaId === pila.fichaId ? eliminarObjeto(e, o.id) : e), e1);
    const r = olvidar(sinEl, pila.fichaId!);
    expect(r.ok && r.estado.biblioteca!.some((f) => f.id === pila.fichaId)).toBe(false);
  });

  it('cambiar la imagen de la ficha cambia la de sus ejemplares', () => {
    const o = e0.objetos[0];
    const e1 = cambiarImagenFicha(e0, o.fichaId!, 'data:image/webp;base64,AAA');
    expect(ficha(e1, o.fichaId!).imagenUrl).toBe('data:image/webp;base64,AAA');
    expect(ejemplares(e1, o.fichaId!).every((x) => x.imagenUrl === 'data:image/webp;base64,AAA')).toBe(true);
  });
});
