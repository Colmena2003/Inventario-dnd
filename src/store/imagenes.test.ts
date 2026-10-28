import { describe, expect, it } from 'vitest';
import { estadoInicial } from '../data/semilla';
import { completarBiblioteca } from '../domain/biblioteca';
import { aGuardar, deGuardado } from './imagenes';

describe('imágenes al guardar', () => {
  it('guarda una sola vez la imagen repetida y la restituye igual', () => {
    const img = 'data:image/webp;base64,' + 'Q'.repeat(5000);
    const e0 = completarBiblioteca(estadoInicial(), 1);
    const o = e0.objetos[0];
    const e = {
      ...e0,
      objetos: e0.objetos.map((x) => (x.fichaId === o.fichaId ? { ...x, imagenUrl: img } : x)),
      biblioteca: e0.biblioteca!.map((f) => (f.id === o.fichaId ? { ...f, imagenUrl: img } : f)),
    };
    const texto = JSON.stringify(aGuardar(e));
    expect(texto.split('Q'.repeat(5000)).length - 1).toBe(1);
    expect(deGuardado(JSON.parse(texto))).toEqual(e);
  });

  it('lee partidas guardadas sin tabla de imágenes', () => {
    const e = estadoInicial();
    expect(deGuardado(JSON.parse(JSON.stringify(e)))).toEqual(e);
  });
});
