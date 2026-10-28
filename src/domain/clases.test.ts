import { describe, expect, it } from 'vitest';
import { CLASES, claseDe, clasePrincipal } from './clases';

describe('clases', () => {
  it('son las 12 del Manual del Jugador de 2014', () => {
    expect(CLASES).toHaveLength(12);
    expect(CLASES).not.toContain('Artífice');
  });
  it('reconoce formas femeninas, sin tildes y en inglés', () => {
    expect(claseDe('Maga')).toBe('Mago');
    expect(claseDe('pícara')).toBe('Pícaro');
    expect(claseDe('PALADIN')).toBe('Paladín');
    expect(claseDe('Druida')).toBe('Druida');
    expect(claseDe('Warlock')).toBe('Brujo');
    expect(claseDe('Artífice')).toBeNull();
  });
  it('la principal es la de más niveles', () => {
    expect(clasePrincipal([{ clase: 'Pícara', nivel: 2 }, { clase: 'Guerrero', nivel: 5 }])).toBe('Guerrero');
    expect(clasePrincipal([{ clase: 'Artífice', nivel: 9 }, { clase: 'Mago', nivel: 1 }])).toBe('Mago');
    expect(clasePrincipal([])).toBeNull();
  });
});
