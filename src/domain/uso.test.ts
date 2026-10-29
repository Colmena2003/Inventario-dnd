import { describe, expect, it } from 'vitest';
import { estadoInicial } from '../data/semilla';
import { hoja } from './hoja';
import { cambiarPv, eliminarPersonaje, guardarPersonaje, personajeVacio, validarPersonaje } from './personajes';
import {
  aplicarEfecto, aplicarRecarga, aplicarUso, descansarEfectos, EFECTOS_COMUNES, HORA, pasarTiempo, prepararRecarga, prepararUso,
  quitarEfecto, RONDA, textoDuracion, tirar, usarRasgo,
} from './uso';
import type { Estado } from './tipos';

const e0 = estadoInicial();
const pj = (id: string, e = e0) => e.personajes.find((p) => p.id === id)!;
const objeto = (nombre: string, dueno: string | null, e = e0) =>
  e.objetos.find((o) => o.nombre === nombre && (dueno ? o.propietario.tipo === 'personaje' && o.propietario.id === dueno : o.propietario.tipo === 'alijo'))!;
/** Siempre saca el máximo del dado. */
const alto = () => 0.999;

describe('dados', () => {
  it('tira expresiones con modificador', () => {
    expect(tirar('Recuperas 2d4+2 PV', alto)).toMatchObject({ expr: '2d4+2', total: 10 });
    expect(tirar('1d6 − 1', () => 0)).toMatchObject({ total: 0 });
    expect(tirar('sin dados')).toBeNull();
  });
});

describe('usar objetos', () => {
  it('una poción de curación se gasta y cura sin pasar del máximo', () => {
    const e1: Estado = { ...e0, personajes: e0.personajes.map((p) => (p.id === 'aldric' ? { ...p, pvActual: 10 } : p)) };
    const pocion = objeto('Poción de curación', 'aldric', e1);
    const r = prepararUso(e1, pocion.id, undefined, alto);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.cura).toBe(10);
    expect(r.texto).toContain('recupera 10 PV');
    const e2 = aplicarUso(e1, r.plan);
    expect(pj('aldric', e2).pvActual).toBe(20);
    expect(objeto('Poción de curación', 'aldric', e2).cantidad).toBe(pocion.cantidad - 1);
  });
  it('un objeto con cargas gasta una y se niega sin cargas', () => {
    const anillo = objeto('Anillo de estrellas fugaces', 'nerys');
    const r = prepararUso(e0, anillo.id);
    if (!r.ok) throw new Error(r.motivo);
    const e1 = aplicarUso(e0, r.plan);
    expect(e1.objetos.find((o) => o.id === anillo.id)!.cargas).toBe(2);
    const vacio = { ...e0, objetos: e0.objetos.map((o) => (o.id === anillo.id ? { ...o, cargas: 0 } : o)) };
    expect(prepararUso(vacio, anillo.id)).toMatchObject({ ok: false });
  });
  it('un objeto del alijo necesita quién lo use', () => {
    const pocion = objeto('Poción de curación', null);
    expect(prepararUso(e0, pocion.id).ok).toBe(false);
    expect(prepararUso(e0, pocion.id, 'brom').ok).toBe(true);
  });
  it('una poción con efecto lo aplica a quien la bebe', () => {
    const pocion = objeto('Poción de resistencia', 'brom');
    const r = prepararUso(e0, pocion.id);
    if (!r.ok) throw new Error(r.motivo);
    const e1 = aplicarUso(e0, r.plan);
    expect(hoja(e1, pj('brom', e1)).resistencias.map((x) => x.texto)).toContain('fuego');
    expect(e1.objetos.some((o) => o.id === pocion.id)).toBe(false);
  });
});

describe('recargas', () => {
  it('un descanso largo recupera cargas con dados y rasgos al máximo', () => {
    const varita = objeto('Varita de proyectil mágico', null);
    let e1: Estado = { ...e0, objetos: e0.objetos.map((o) => (o.id === varita.id ? { ...o, cargas: 0 } : o)) };
    e1 = usarRasgo(e1, 'aldric', 'Imposición de manos', -5);
    const plan = prepararRecarga(e1, e1.personajes.map((p) => p.id), 'largo', alto);
    const e2 = aplicarRecarga(e1, plan);
    expect(e2.objetos.find((o) => o.id === varita.id)!.cargas).toBe(7);
    expect(pj('aldric', e2).rasgos!.find((r) => r.nombre === 'Imposición de manos')!.usos).toBe(25);
  });
  it('un descanso corto solo recupera lo que dice «corto»', () => {
    let e1 = usarRasgo(e0, 'aldric', 'Juramento de devoción', -1);
    e1 = usarRasgo(e1, 'aldric', 'Imposición de manos', -1);
    const e2 = aplicarRecarga(e1, prepararRecarga(e1, ['aldric'], 'corto'));
    const r = (n: string) => pj('aldric', e2).rasgos!.find((x) => x.nombre === n)!.usos;
    expect(r('Juramento de devoción')).toBe(1);
    expect(r('Imposición de manos')).toBe(24);
  });
});

describe('efectos temporales', () => {
  const escudo = EFECTOS_COMUNES.find((x) => x.nombre === 'Escudo de la fe')!;
  it('cambian la hoja mientras duran y se acaban con el tiempo', () => {
    const ca = hoja(e0, pj('ysolde')).ca.total;
    const e1 = aplicarEfecto(e0, ['ysolde'], escudo);
    expect(hoja(e1, pj('ysolde', e1)).ca.total).toBe(ca + 2);
    const r = pasarTiempo(e1, ['ysolde'], 5 * 60);
    expect(textoDuracion(pj('ysolde', r.estado).efectos![0].duracion)).toBe('5 min');
    const fin = pasarTiempo(r.estado, ['ysolde'], 10 * RONDA * 10);
    expect(fin.terminados).toHaveLength(1);
    expect(hoja(fin.estado, pj('ysolde', fin.estado)).ca.total).toBe(ca);
  });
  it('el mismo efecto se renueva en lugar de sumarse, y se puede quitar', () => {
    const e1 = aplicarEfecto(aplicarEfecto(e0, ['brom'], escudo), ['brom'], escudo);
    expect(pj('brom', e1).efectos).toHaveLength(1);
    const e2 = quitarEfecto(e1, 'brom', pj('brom', e1).efectos![0].id);
    expect(pj('brom', e2).efectos).toHaveLength(0);
  });
  it('fijar FUE 21 sube la carga máxima', () => {
    const fuerza = EFECTOS_COMUNES.find((x) => x.nombre === 'Fuerza de gigante de colina')!;
    const e1 = aplicarEfecto(e0, ['nerys'], fuerza);
    expect(hoja(e1, pj('nerys', e1)).cargaMax).toBe(Math.round(21 * 6.8));
  });
  it('los descansos pasan horas y acaban los efectos «hasta un descanso»', () => {
    const e1 = aplicarEfecto(e0, ['nerys'], { nombre: 'Inspiración', duracion: { tipo: 'descanso', descanso: 'corto' }, modificadores: [] });
    const e2 = aplicarEfecto(e1, ['nerys'], { nombre: 'Ayuda', duracion: { tipo: 'tiempo', segundos: 8 * HORA }, modificadores: [{ objetivo: 'pvMax', valor: 5 }] });
    const r = descansarEfectos(e2, ['nerys'], 'corto');
    expect(pj('nerys', r.estado).efectos!.map((x) => x.nombre)).toEqual(['Ayuda']);
    expect(descansarEfectos(r.estado, ['nerys'], 'largo').terminados).toHaveLength(1);
  });
});

describe('personajes', () => {
  it('se crean, se validan y al borrarlos su equipo va al alijo', () => {
    const nuevo = { ...personajeVacio(e0), nombre: 'Tamsin' };
    expect(validarPersonaje(e0, { ...nuevo, nombre: 'aldric varn' })).not.toBeNull();
    const e1 = guardarPersonaje(e0, nuevo, true);
    expect(e1.personajes).toHaveLength(e0.personajes.length + 1);
    const deBrom = e0.objetos.filter((o) => o.propietario.tipo === 'personaje' && o.propietario.id === 'brom').length;
    const e2 = eliminarPersonaje(e1, 'brom');
    expect(e2.objetos.filter((o) => o.propietario.tipo === 'alijo').length).toBe(e1.objetos.filter((o) => o.propietario.tipo === 'alijo').length + deBrom);
    expect(e2.party.tesoro.po).toBeGreaterThanOrEqual(e1.party.tesoro.po);
  });
});

describe('PV', () => {
  it('el daño no baja de 0 y la curación no pasa del máximo', () => {
    const max = hoja(e0, pj('aldric')).pvMax.total;
    expect(cambiarPv(e0, 'aldric', -500).despues).toBe(0);
    expect(cambiarPv(e0, 'aldric', 500).despues).toBe(max);
    expect(cambiarPv(e0, 'aldric', -4)).toMatchObject({ antes: pj('aldric').pvActual, despues: pj('aldric').pvActual - 4 });
  });
});
