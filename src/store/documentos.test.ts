import { describe, expect, it } from 'vitest';
import { estadoInicial } from '../data/semilla';
import { completarBiblioteca } from '../domain/biblioteca';
import { eliminarObjeto } from '../domain/objetos';
import { moverObjeto } from '../domain/reglas';
import { aDocumentos, deDocumentos, demasiadoGrandes, diferencias, DOC_MOVIMIENTOS, DOC_PARTY, memoriaNueva, type Ordenes } from './documentos';

const e0 = completarBiblioteca(estadoInicial(), 1);
const cuerpos = (docs: Map<string, string>) => new Map([...docs].map(([r, j]) => [r, JSON.parse(j) as Record<string, unknown>]));
// El almacén devuelve las colecciones por id, no en el orden en que se escribieron
const barajar = <T,>(m: Map<string, T>) => new Map([...m].sort(([a], [b]) => (a < b ? 1 : -1)));

describe('estado en documentos', () => {
  it('ida y vuelta sin perder nada, con el orden original aunque el almacén los devuelva por id', () => {
    const docs = aDocumentos(e0, new Map());
    const vuelta = deDocumentos(barajar(cuerpos(docs)), new Map());
    expect(vuelta).toEqual(JSON.parse(JSON.stringify({ ...e0, registroMonedas: e0.registroMonedas ?? [] })));
  });

  it('un documento por elemento y las imágenes aparte, una sola vez', () => {
    const img = 'data:image/webp;base64,' + 'Z'.repeat(3000);
    const o = e0.objetos[0];
    const e = { ...e0, objetos: e0.objetos.map((x) => (x.fichaId === o.fichaId ? { ...x, imagenUrl: img } : x)), biblioteca: e0.biblioteca!.map((f) => (f.id === o.fichaId ? { ...f, imagenUrl: img } : f)) };
    const docs = aDocumentos(e, new Map());
    expect(docs.has(`objetos/${o.id}`)).toBe(true);
    expect([...docs.keys()].filter((r) => r.startsWith('imagenes/'))).toHaveLength(1);
    expect([...docs.values()].filter((j) => j.includes('ZZZZ'))).toHaveLength(1);
    expect(deDocumentos(cuerpos(docs), new Map())!.objetos.find((x) => x.id === o.id)!.imagenUrl).toBe(img);
  });

  it('mover un objeto escribe solo ese objeto y el historial', () => {
    const ordenes: Ordenes = new Map();
    const antes = aDocumentos(e0, ordenes);
    const o = e0.objetos.find((x) => x.propietario.tipo === 'alijo' && x.cantidad === 1)!;
    const e1 = moverObjeto(e0, o.id, { propietario: { tipo: 'personaje', id: 'nerys' } }, 'DM');
    const { escribir, borrar } = diferencias(antes, aDocumentos(e1, ordenes));
    expect(escribir.map(([r]) => r).sort()).toEqual([DOC_MOVIMIENTOS, `objetos/${o.id}`].sort());
    expect(borrar).toEqual([]);
  });

  it('borrar uno no reescribe los demás y conserva el orden del resto', () => {
    const ordenes: Ordenes = new Map();
    const antes = aDocumentos(e0, ordenes);
    const o = e0.objetos[3];
    const e1 = eliminarObjeto(e0, o.id);
    const despues = aDocumentos(e1, ordenes);
    expect(diferencias(antes, despues)).toEqual({ escribir: [], borrar: [`objetos/${o.id}`] });
    expect(deDocumentos(barajar(cuerpos(despues)), new Map())!.objetos.map((x) => x.id)).toEqual(e1.objetos.map((x) => x.id));
  });

  it('lo nuevo va al final aunque su id ordene antes', () => {
    const ordenes: Ordenes = new Map();
    aDocumentos(e0, ordenes);
    const nuevo = { ...e0.objetos[0], id: '0000-primero' };
    const e1 = { ...e0, objetos: [...e0.objetos, nuevo] };
    const vuelta = deDocumentos(barajar(cuerpos(aDocumentos(e1, ordenes))), new Map())!;
    expect(vuelta.objetos.at(-1)!.id).toBe('0000-primero');
  });

  it('con memoria, un cambio solo serializa lo cambiado y al leer se reutiliza lo que no ha cambiado', () => {
    const img = 'data:image/webp;base64,' + 'Q'.repeat(4000);
    const e = { ...e0, objetos: e0.objetos.map((o, i) => (i < 5 ? { ...o, imagenUrl: img } : o)) };
    const ord: Ordenes = new Map(), mem = memoriaNueva();
    const antes = aDocumentos(e, ord, mem);
    const e1 = { ...e, objetos: e.objetos.map((o, i) => (i === 40 ? { ...o, cantidad: o.cantidad + 1 } : o)) };
    const despues = aDocumentos(e1, ord, mem);
    expect(diferencias(antes, despues).escribir.map(([r]) => r)).toEqual([`objetos/${e.objetos[40].id}`]);
    // Leer dos veces los mismos cuerpos da los mismos objetos
    const c = cuerpos(despues);
    const r1 = deDocumentos(c, new Map(), mem)!, r2 = deDocumentos(c, new Map(), mem)!;
    expect(r2.objetos.every((o, i) => o === r1.objetos[i])).toBe(true);
    expect(r1.objetos[0].imagenUrl).toBe(img);
  });

  it('sin el documento de la party no hay partida; detecta documentos demasiado grandes', () => {
    const docs = aDocumentos(e0, new Map());
    const sin = cuerpos(docs); sin.delete(DOC_PARTY);
    expect(deDocumentos(sin, new Map())).toBeNull();
    const grande = { ...e0, personajes: e0.personajes.map((p, i) => (i ? p : { ...p, imagenUrl: 'data:image/png;base64,' + 'A'.repeat(300 * 1024) })) };
    expect(demasiadoGrandes(aDocumentos(grande, new Map()))).toHaveLength(1);
  });
});
