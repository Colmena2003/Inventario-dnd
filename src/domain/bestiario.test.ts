import { describe, expect, it } from 'vitest';
import { estadoInicial } from '../data/semilla';
import { completarBiblioteca } from './biblioteca';
import {
  anotarEncuentro, conocimiento, crearCriatura, criaturaEnBlanco, editarCriatura, eliminarCriatura, fichaDeBotin, habilidadEnBlanco,
  modDe, pxDeDesafio, sinDescubrir,
} from './bestiario';

const e0 = completarBiblioteca({ ...estadoInicial(), bestiario: [] }, 1);

describe('bestiario', () => {
  it('basta con el nombre: todo lo demás puede quedar sin descubrir', () => {
    expect(crearCriatura(e0, criaturaEnBlanco(), 'DM').ok).toBe(false);
    const r = crearCriatura(e0, { ...criaturaEnBlanco(), nombre: '  Sombra del pozo ' }, 'DM', 7);
    if (!r.ok) throw new Error(r.motivo);
    const c = r.estado.bestiario!.find((x) => x.id === r.id)!;
    expect(c).toMatchObject({ nombre: 'Sombra del pozo', actitud: 'desconocida', creada: 7, creadaPor: 'DM' });
    expect(c.ca).toBeUndefined();
    expect(modDe(c, 'fue')).toBeUndefined();
    expect(conocimiento(c)).toBe(0);
  });

  it('una habilidad sin nombre ni descripción es un hueco que se conserva', () => {
    const habilidades = [
      { ...habilidadEnBlanco('accion'), nombre: 'Mordisco', detalle: '+5, 2d6+3 perforante' },
      { ...habilidadEnBlanco('accion'), nombre: 'Aullido' },
      habilidadEnBlanco('accion'),
    ];
    const r = crearCriatura(e0, { ...criaturaEnBlanco(), nombre: 'Huargo', actitud: 'agresiva', habilidades }, 'DM');
    if (!r.ok) throw new Error(r.motivo);
    const c = r.estado.bestiario!.at(-1)!;
    expect(c.habilidades).toHaveLength(3);
    expect(c.habilidades.map(sinDescubrir)).toEqual([false, false, true]);
  });

  it('valida números y características, y limpia textos vacíos y botín vacío', () => {
    const base = { ...criaturaEnBlanco(), nombre: 'Ogro' };
    expect(crearCriatura(e0, { ...base, ca: -1 }, 'DM')).toMatchObject({ ok: false });
    expect(crearCriatura(e0, { ...base, pv: 2.5 }, 'DM')).toMatchObject({ ok: false });
    expect(crearCriatura(e0, { ...base, caracteristicas: { fue: 31 } }, 'DM')).toMatchObject({ ok: false });
    const r = crearCriatura(e0, { ...base, tipo: '  ', caracteristicas: { fue: 19 }, botin: [{ id: 'b1' }, { id: 'b2', nombre: 'Garrote' }] }, 'DM');
    if (!r.ok) throw new Error(r.motivo);
    const c = r.estado.bestiario!.at(-1)!;
    expect(c.tipo).toBeUndefined();
    expect(modDe(c, 'fue')).toBe(4);
    expect(c.botin.map((b) => b.nombre)).toEqual(['Garrote']);
  });

  it('editar conserva la fecha de alta y quién la creó; eliminar la quita', () => {
    const r = crearCriatura(e0, { ...criaturaEnBlanco(), nombre: 'Ghoul' }, 'Aldric', 1);
    if (!r.ok) throw new Error(r.motivo);
    const r2 = editarCriatura(r.estado, r.id, { ...criaturaEnBlanco(), nombre: 'Ghoul', ca: 12, actitud: 'agresiva' }, 9);
    if (!r2.ok) throw new Error(r2.motivo);
    expect(r2.estado.bestiario!.find((x) => x.id === r.id)).toMatchObject({ ca: 12, creada: 1, actualizada: 9, creadaPor: 'Aldric' });
    expect(eliminarCriatura(r2.estado, r.id).bestiario!.some((x) => x.id === r.id)).toBe(false);
    expect(editarCriatura(e0, 'no-existe', { ...criaturaEnBlanco(), nombre: 'X' }).ok).toBe(false);
  });

  it('el botín se pinta con su ficha de la biblioteca, enlazada o por nombre', () => {
    const f = e0.biblioteca![0];
    expect(fichaDeBotin(e0, { id: 'a', fichaId: f.id })?.id).toBe(f.id);
    expect(fichaDeBotin(e0, { id: 'b', nombre: f.nombre.toUpperCase() })?.id).toBe(f.id);
    expect(fichaDeBotin(e0, { id: 'c', nombre: 'Algo que nadie conoce' })).toBeUndefined();
  });

  it('PX por desafío y encuentros', () => {
    expect(pxDeDesafio('1/2')).toBe(100);
    expect(pxDeDesafio('5')).toBe(1800);
    expect(pxDeDesafio('?')).toBeUndefined();
    const r = crearCriatura(e0, { ...criaturaEnBlanco(), nombre: 'Kobold' }, 'DM');
    if (!r.ok) throw new Error(r.motivo);
    const e = anotarEncuentro(anotarEncuentro(r.estado, r.id, true), r.id, false);
    expect(e.bestiario!.at(-1)).toMatchObject({ encuentros: 2, derrotadas: 1 });
  });
});
