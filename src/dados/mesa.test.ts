import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { _pruebas } from './mesa';

const { plantilla, forzar, deArriba, piezas } = _pruebas;
const FORMAS = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'decenas'] as const;
const CARAS = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, decenas: 10 };

describe('mesa de dados', () => {
  it('cada dado tiene sus caras y sus números', () => {
    for (const f of FORMAS) {
      const p = plantilla(f);
      expect(p.normales.length).toBe(f === 'd4' ? 4 : CARAS[f]);
      expect([...p.numeros].sort((a, b) => a - b)).toEqual(
        Array.from({ length: CARAS[f] }, (_, i) => (f === 'd10' || f === 'decenas' ? i : i + 1)),
      );
    }
    expect(plantilla('d10').caras.every((c) => c.ind.length === 4)).toBe(true);
    expect(plantilla('d12').caras.every((c) => c.ind.length === 5)).toBe(true);
  });

  it('la cara de arriba muestra el valor tirado y las opuestas siguen sumando lo mismo', () => {
    for (const f of FORMAS) {
      const p = plantilla(f);
      for (let n = 0; n < 40; n++) {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 7, Math.random() * 7, Math.random() * 7));
        const arriba = deArriba(p, q);
        const valor = p.numeros[Math.floor(Math.random() * p.numeros.length)];
        const nums = forzar(p, p.numeros, arriba, valor);
        expect(nums[arriba]).toBe(valor);
        expect([...nums].sort()).toEqual([...p.numeros].sort());
        if (f !== 'd4') {
          const suma = f === 'd10' || f === 'decenas' ? 9 : CARAS[f] + 1;
          p.normales.forEach((nrm, i) => {
            const op = p.normales.findIndex((o) => o.dot(nrm) < -0.999);
            expect(nums[i] + nums[op]).toBe(suma);
          });
        }
      }
    }
  });

  it('el d100 son decenas y unidades, y el 10 del d10 es el 0', () => {
    expect(piezas([{ tipo: 'd100', valor: 47 }]).map((x) => x.arriba)).toEqual([4, 7]);
    expect(piezas([{ tipo: 'd100', valor: 100 }]).map((x) => x.arriba)).toEqual([0, 0]);
    expect(piezas([{ tipo: 'd100', valor: 5 }]).map((x) => x.arriba)).toEqual([0, 5]);
    expect(piezas([{ tipo: 'd10', valor: 10 }])[0].arriba).toBe(0);
  });
});
