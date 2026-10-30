import { describe, expect, it } from 'vitest';
import { estadoInicial } from '../data/semilla';
import { hoja } from './hoja';
import { crearObjeto, editarObjeto, migrar, VERSION_MODELO } from './objetos';
import { comer, descansar, moverObjeto, validarMovimiento } from './reglas';
import type { Estado, Objeto } from './tipos';

const e0 = estadoInicial();
const pj = (id: string, e = e0) => e.personajes.find((p) => p.id === id)!;
const objeto = (nombre: string, e = e0) => e.objetos.find((o) => o.nombre === nombre)!;
const de = (id: string) => ({ tipo: 'personaje' as const, id });

/** Da un objeto nuevo a un personaje y lo equipa en su ranura. */
function equipar(e: Estado, pjId: string, datos: Partial<Objeto>, indice = 0): Estado {
  const base: Objeto = { id: '', nombre: 'Prueba', icono: 'ring', categoria: 'Varios', rareza: 'raro', cantidad: 1, pesoKg: 0, valorPo: 0, propietario: de(pjId), equipadoEn: null, ...datos };
  const e1 = crearObjeto(e, base, 'Test');
  const nuevo = e1.objetos[e1.objetos.length - 1];
  if (!nuevo.ranuraEquipo) return e1;
  return moverObjeto(e1, nuevo.id, { propietario: de(pjId), equipar: { ranura: nuevo.ranuraEquipo, indice } }, 'Test');
}

describe('CA', () => {
  it('un casco de tipo armadura va en la cabeza y suma a la CA sin sustituirla', () => {
    const libre = e0.personajes.find((p) => !e0.objetos.some((o) => o.propietario.tipo === 'personaje' && o.propietario.id === p.id && o.equipadoEn?.ranura === 'cabeza'))!;
    const e1 = equipar(e0, libre.id, { tipo: 'armadura', icono: 'helm', ranuraEquipo: 'cabeza', armadura: { tipo: 'ligera', caBase: 11 }, bonoCa: 1, bonoMagico: 1 });
    const casco = e1.objetos[e1.objetos.length - 1];
    expect(casco.equipadoEn?.ranura).toBe('cabeza');
    expect(casco.armadura).toBeUndefined();
    expect(hoja(e1, pj(libre.id, e1)).ca.total).toBe(hoja(e0, pj(libre.id)).ca.total + 2);
  });
  it('se calcula con armadura, escudo, objetos y rasgos', () => {
    // Coraza +1 (14 + 1) + escudo 2 + anillo de protección 1 + estilo Defensa 1, DES 10
    expect(hoja(e0, pj('aldric')).ca.total).toBe(19);
    // Cota de mallas 16 (pesada, sin DES) + escudo 2
    expect(hoja(e0, pj('brom')).ca.total).toBe(18);
    // Cuero tachonado 12 + DES 4
    expect(hoja(e0, pj('ysolde')).ca.total).toBe(16);
    // Ropa: 10 + DES 2 + túnica 1
    expect(hoja(e0, pj('nerys')).ca.total).toBe(13);
  });
  it('la armadura media limita la DES a +2', () => {
    const e1 = equipar(e0, 'ysolde', { ranuraEquipo: 'armadura', tipo: 'armadura', armadura: { tipo: 'media', caBase: 14 } });
    expect(hoja(e1, pj('ysolde', e1)).ca.total).toBe(16);
  });
  it('sin sintonizar, el anillo de protección no cuenta', () => {
    const anillo = objeto('Anillo de protección');
    const e1 = { ...e0, objetos: e0.objetos.map((o) => (o.id === anillo.id ? { ...o, sintonizado: false } : o)) };
    expect(hoja(e1, pj('aldric', e1)).ca.total).toBe(18);
  });
});

describe('modificadores de objetos', () => {
  it('fijar una característica cambia el modificador, los PV y las salvaciones', () => {
    const h = hoja(e0, pj('nerys'));
    // Amuleto de la salud: CON 13 → 19, +3 de modificador × nivel 5
    expect(h.car.con.total).toBe(19);
    expect(h.pvMax.total).toBe(31 + 15);
  });
  it('+2 FUE sube ataque, daño y carga', () => {
    const e1 = equipar(e0, 'aldric', { ranuraEquipo: 'guantes', tipo: 'equipable', modificadores: [{ objetivo: 'car:fue', valor: 2 }] });
    // Antes hay que quitar los guanteletes; el nuevo los sustituye en la ranura
    const h = hoja(e1, pj('aldric', e1));
    expect(h.car.fue.total).toBe(20);
    expect(h.ataques[0].bono.total).toBe(9);
    expect(h.ataques[0].dano).toBe('1d8+6');
    expect(h.cargaMax).toBe(136);
  });
  it('bonos a ataque, daño, CD y pasivas', () => {
    const e1 = equipar(e0, 'brom', { ranuraEquipo: 'anillo', tipo: 'equipable', modificadores: [
      { objetivo: 'ataque', valor: 1 }, { objetivo: 'dano:cac', valor: 2 }, { objetivo: 'pasiva:percepcion', valor: 5 }, { objetivo: 'cdConjuros', valor: 1 },
    ] }, 1);
    const antes = hoja(e0, pj('brom'));
    const h = hoja(e1, pj('brom', e1));
    expect(h.ataques[0].bono.total).toBe(antes.ataques[0].bono.total + 1);
    expect(h.ataques[0].danoMod.total).toBe(antes.ataques[0].danoMod.total + 2);
    expect(h.pasivas.percepcion.total).toBe(antes.pasivas.percepcion.total + 5);
    expect(h.conjuros!.cd.total).toBe(antes.conjuros!.cd.total + 1);
  });
  it('fijar la velocidad (botas de zancada) antes del hambre y la carga', () => {
    const v = hoja(e0, pj('ysolde')).velocidad.caminar;
    expect(v.fuentes.find((f) => f.fijado)).toMatchObject({ origen: 'Botas de zancada', valor: 30 });
    // Famélica (mitad) y sobrecargada (−20 pies)
    expect(v.total).toBe(5);
  });
  it('resistencias de objetos', () => {
    expect(hoja(e0, pj('aldric')).resistencias.map((r) => r.texto)).toContain('necrótico');
  });
});

describe('propiedades de arma', () => {
  it('versátil a dos manos si la otra mano está libre', () => {
    const escudo = objeto('Escudo de roble y hierro');
    const e1 = moverObjeto(e0, escudo.id, { propietario: de('aldric') }, 'Test');
    expect(hoja(e1, pj('aldric', e1)).ataques[0].dano).toBe('1d10+5');
  });
  it('una arma a dos manos libera la mano secundaria', () => {
    const e1 = equipar(e0, 'aldric', { tipo: 'arma', ranuraEquipo: 'cuerpoACuerpo', dado: '2d6', tipoDano: 'cortante', propiedades: ['pesada', 'dosManos'] });
    expect(objeto('Escudo de roble y hierro', e1).equipadoEn).toBeNull();
    const v = validarMovimiento(e1, objeto('Escudo de roble y hierro', e1).id, { propietario: de('aldric'), equipar: { ranura: 'cuerpoACuerpo', indice: 1 } });
    expect(v.ok).toBe(false);
  });
  it('pesada da desventaja a una criatura Pequeña', () => {
    const e1 = equipar(e0, 'ysolde', { tipo: 'arma', ranuraEquipo: 'cuerpoACuerpo', dado: '2d6', tipoDano: 'cortante', propiedades: ['pesada', 'dosManos'] });
    expect(hoja(e1, pj('ysolde', e1)).ataques[0].bono.desv).toContain('Pesada en criatura Pequeña');
  });
  it('mano secundaria: sin modificador al daño y solo con dos armas ligeras', () => {
    const h = hoja(e0, pj('ysolde'));
    const daga = h.ataques.find((a) => a.objeto.nombre === 'Daga')!;
    expect(daga.dano).toBe('1d4');
    expect(daga.valido).toBe(false); // el estoque no es ligero
  });
  it('daño adicional y sin sintonizar no hay bonos mágicos', () => {
    const espada = objeto('Hoja del Alba Cenicienta');
    expect(hoja(e0, pj('aldric')).ataques[0].extras[0]).toMatchObject({ dado: '1d6', tipo: 'radiante' });
    const e1 = { ...e0, objetos: e0.objetos.map((o) => (o.id === espada.id ? { ...o, sintonizado: false } : o)) };
    const a = hoja(e1, pj('aldric', e1)).ataques[0];
    expect([a.bono.total, a.dano, a.extras.length]).toEqual([7, '1d8+4', 0]);
  });
});

describe('hambre', () => {
  it('comer suma saciedad hasta 7 y gasta una unidad', () => {
    const raciones = objeto('Raciones de viaje');
    const r = comer(e0, 'ysolde', raciones.id);
    expect(r.ok && r.despues).toBe(3);
    if (r.ok) expect(objeto('Raciones de viaje', r.estado).cantidad).toBe(raciones.cantidad - 1);
    expect(comer(e0, 'ysolde', objeto('Carne de jabalí cruda').id).ok).toBe(false);
  });
  it('el descanso largo pide 4 o más', () => {
    const r = descansar(e0, ['aldric', 'ysolde'], 'largo');
    expect(r.bloqueados).toEqual(['ysolde']);
    expect(pj('aldric', r.estado).saciedad).toBe(2);
  });
  it('los efectos se aplican a la hoja', () => {
    const e1 = { ...e0, personajes: e0.personajes.map((p) => (p.id === 'aldric' ? { ...p, saciedad: 0 } : p)) };
    const h = hoja(e1, pj('aldric', e1));
    expect(h.velocidad.caminar.total).toBe(15);
    expect(h.pvMax.total).toBe(26);
    expect(h.ataques[0].bono.desv).toContain('Hambre');
    expect(h.pasivas.percepcion.total).toBe(hoja(e0, pj('aldric')).pasivas.percepcion.total - 5);
  });
});

describe('objetos', () => {
  it('editar el dueño desequipa, quita la sintonía y anota el movimiento', () => {
    const anillo = objeto('Anillo de protección');
    const e1 = editarObjeto(e0, { ...anillo, propietario: { tipo: 'alijo' } }, 'Test');
    expect(objeto('Anillo de protección', e1)).toMatchObject({ equipadoEn: null, sintonizado: false });
    expect(e1.movimientos[0].objetoNombre).toBe('Anillo de protección');
  });
  it('migra la saciedad antigua de 0–100 sin tocar nada más', () => {
    const viejo = { ...e0, version: 2, personajes: e0.personajes.map((p) => ({ ...p, saciedad: 58 })) } as Estado;
    const m = migrar(viejo);
    expect(m.version).toBe(VERSION_MODELO);
    expect(pj('nerys', m).saciedad).toBe(4);
    expect(m.objetos.map((o) => [o.id, o.propietario, o.cantidad])).toEqual(e0.objetos.map((o) => [o.id, o.propietario, o.cantidad]));
  });
  it('un objeto propio con el nombre de uno de ejemplo no se pisa al migrar', () => {
    const daga = { ...objeto('Daga'), id: 'o-propia', descripcion: 'La de mi abuela', dado: '1d6' };
    const m = migrar({ ...e0, version: 4, objetos: [daga] } as Estado);
    expect(m.objetos[0]).toMatchObject({ descripcion: 'La de mi abuela', dado: '1d6' });
  });
  it('pasa la velocidad guardada en metros a pies', () => {
    const viejo = {
      ...e0, version: 4,
      personajes: e0.personajes.map((p) => (p.id === 'brom' ? { ...p, velocidad: 7.5 } : p)),
      objetos: [{ ...objeto('Anillo de protección'), id: 'propio', nombre: 'Anillo veloz', modificadores: [{ objetivo: 'vel:caminar', valor: 3 }] }],
    } as Estado;
    const m = migrar(viejo);
    expect(pj('brom', m).velocidad).toBe(25);
    expect(m.objetos[0].modificadores).toEqual([{ objetivo: 'vel:caminar', valor: 10 }]);
  });
});
