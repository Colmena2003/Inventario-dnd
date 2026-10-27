// Edición rápida de un personaje: identidad, PV, CA, características, estado y color.

import { useState } from 'react';
import { modificador, conSigno } from '../domain/reglas';
import type { Caracteristica, Personaje } from '../domain/tipos';
import { useCofre } from '../store/cofre';
import { useEscape } from './Dialogos';
import { UI } from './iconos';
import { Esquinas, Icono } from './piezas';

const CARS: [Caracteristica, string][] = [['fue', 'FUE'], ['des', 'DES'], ['con', 'CON'], ['int', 'INT'], ['sab', 'SAB'], ['car', 'CAR']];

const lista = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
/** «Paladín 5 / Mago 2» → [{clase: 'Paladín', nivel: 5}, {clase: 'Mago', nivel: 2}] */
const clasesDe = (s: string) =>
  s.split('/').map((x) => x.trim()).filter(Boolean).map((x) => {
    const m = x.match(/^(.*?)\s+(\d+)$/);
    return m ? { clase: m[1].trim(), nivel: Math.max(1, Math.min(20, Number(m[2]))) } : { clase: x, nivel: 1 };
  });

const COLORES = ['#6F8FB8', '#9A78D0', '#C08E4F', '#4FA07F', '#B85C5C', '#C9B458'];

/** Un personaje en blanco para el alta. */
function enBlanco(n: number): Omit<Personaje, 'id'> {
  return {
    nombre: '', raza: '', clases: [{ clase: 'Guerrero', nivel: 1 }], px: 0, pvActual: 10, pvMax: 10, ca: 10,
    fue: 10, des: 10, con: 10, int: 10, sab: 10, car: 10, condiciones: [], resistencias: [],
    monedas: { ppt: 0, po: 0, pe: 0, pp: 0, pc: 0 }, saciedad: 75, color: COLORES[n % COLORES.length],
  };
}

/** Sin `p`, da de alta un personaje nuevo. */
export function EditarPersonaje({ p: p0, onCerrar, onAviso }: { p?: Personaje; onCerrar: () => void; onAviso: (t: string, error?: boolean) => void }) {
  const { estado, editarPersonaje, crearPersonaje, eliminarPersonaje } = useCofre();
  const p = p0 ?? { ...enBlanco(estado.personajes.length), id: '' };
  const [confirmar, setConfirmar] = useState(false);
  const [f, setF] = useState({
    nombre: p.nombre, raza: p.raza, trasfondo: p.trasfondo ?? '', clases: p.clases.map((c) => `${c.clase} ${c.nivel}`).join(' / '),
    px: String(p.px ?? 0), pvActual: String(p.pvActual), pvMax: String(p.pvMax), ca: String(p.ca), saciedad: String(p.saciedad),
    fue: String(p.fue), des: String(p.des), con: String(p.con), int: String(p.int), sab: String(p.sab), car: String(p.car),
    condiciones: p.condiciones.join(', '), resistencias: p.resistencias.join(', '), color: p.color,
  });
  const [error, setError] = useState<string | null>(null);
  useEscape(onCerrar);
  const set = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); setError(null); };
  const n = (k: keyof typeof f) => Number(f[k]);

  const guardar = () => {
    if (!f.nombre.trim()) return setError('El personaje necesita un nombre');
    const enteros: (keyof typeof f)[] = ['px', 'pvActual', 'pvMax', 'ca', 'saciedad', 'fue', 'des', 'con', 'int', 'sab', 'car'];
    if (enteros.some((k) => !Number.isInteger(n(k)) || n(k) < 0)) return setError('PX, PV, CA, saciedad y características tienen que ser números enteros sin signo');
    if (n('pvMax') < 1) return setError('Los PV máximos tienen que ser al menos 1');
    if (CARS.some(([k]) => n(k) < 1 || n(k) > 30)) return setError('Las características van de 1 a 30');
    const clases = clasesDe(f.clases);
    if (!clases.length) return setError('Indica al menos una clase, por ejemplo «Paladín 5»');
    const cambios = {
      nombre: f.nombre.trim(), raza: f.raza.trim(), trasfondo: f.trasfondo.trim() || undefined, clases, px: n('px'),
      pvMax: n('pvMax'), pvActual: Math.min(n('pvActual'), n('pvMax')), ca: n('ca'), saciedad: Math.min(100, n('saciedad')),
      fue: n('fue'), des: n('des'), con: n('con'), int: n('int'), sab: n('sab'), car: n('car'),
      condiciones: lista(f.condiciones), resistencias: lista(f.resistencias), color: f.color,
    };
    if (p0) editarPersonaje(p.id, cambios);
    else crearPersonaje({ ...p, ...cambios, id: undefined } as Omit<Personaje, 'id'>);
    onAviso(p0 ? `${f.nombre.trim()} actualizado` : `${f.nombre.trim()} se une a la party`);
    onCerrar();
  };

  const campo = (k: keyof typeof f, t: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="fo-c"><span className="k">{t}</span><input id={`ep-${k}`} className="fo-in" value={f[k]} onChange={(e) => set(k, e.target.value)} {...extra} /></label>
  );

  return (
    <>
      <div className="velo" onClick={onCerrar} />
      <section role="dialog" aria-modal="true" aria-labelledby="ep-t" className="panel dialogo ep">
        <Esquinas />
        <header className="fo-cab">
          <h2 id="ep-t">{p0 ? 'Editar personaje' : 'Nuevo personaje'}</h2>
          <button type="button" className="ibtn" aria-label="Cerrar" onClick={onCerrar}><Icono d={UI.cruz} /></button>
        </header>
        <form className="ep-cuerpo" onSubmit={(e) => { e.preventDefault(); guardar(); }}>
          <div className="fo-fila" style={{ gridTemplateColumns: '1.4fr 1fr 1fr' }}>
            {campo('nombre', 'Nombre', { autoFocus: true })}
            {campo('raza', 'Raza')}
            {campo('trasfondo', 'Trasfondo')}
          </div>
          <div className="fo-fila" style={{ gridTemplateColumns: '2fr 1fr 64px' }}>
            {campo('clases', 'Clases y niveles (separa con /)', { placeholder: 'Paladín 5 / Brujo 1' })}
            {campo('px', 'PX', { inputMode: 'numeric' })}
            <label className="fo-c"><span className="k">Color</span><input id="ep-color" type="color" className="ep-color" value={f.color} onChange={(e) => set('color', e.target.value)} /></label>
          </div>
          <div className="fo-fila" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {campo('pvActual', 'PV actuales', { inputMode: 'numeric' })}
            {campo('pvMax', 'PV máximos', { inputMode: 'numeric' })}
            {campo('ca', 'CA', { inputMode: 'numeric' })}
            {campo('saciedad', 'Saciedad (0–100)', { inputMode: 'numeric' })}
          </div>
          <div className="ep-cars">
            {CARS.map(([k, t]) => (
              <label key={k}><span className="k">{t}</span>
                <input id={`ep-${k}`} className="fo-in" inputMode="numeric" value={f[k]} onChange={(e) => set(k, e.target.value)} />
                <span className="ep-mod">{Number.isFinite(n(k)) ? conSigno(modificador(n(k))) : ''}</span>
              </label>
            ))}
          </div>
          {campo('condiciones', 'Condiciones (separadas por comas)', { placeholder: 'Bendecido, Agotamiento 1' })}
          {campo('resistencias', 'Resistencias (separadas por comas)', { placeholder: 'Necrótico, Veneno' })}
          <button type="submit" hidden />
        </form>
        <footer className="fo-pie">
          {p0 && (
            <button
              type="button" className={`btn ${confirmar ? 'peligro' : 'peligro-sec'}`}
              onClick={() => {
                if (!confirmar) return setConfirmar(true);
                eliminarPersonaje(p.id);
                onAviso(`${p.nombre} ha dejado la party; lo que llevaba está en el alijo`);
                onCerrar();
              }}
            >
              {confirmar ? 'Confirmar: eliminar' : 'Eliminar personaje'}
            </button>
          )}
          {confirmar && <span className="fo-error">Lo que lleva pasará al alijo.</span>}
          {error && <span className="fo-error" role="alert">{error}</span>}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn sec" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="btn pri" onClick={guardar}>{p0 ? 'Guardar cambios' : 'Añadir a la party'}</button>
        </footer>
      </section>
    </>
  );
}
