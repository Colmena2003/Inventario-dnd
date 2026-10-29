// Efectos temporales en la ficha: lista con lo que queda de cada uno, botón para quitarlos, paso del tiempo
// de juego y un diálogo para aplicar conjuros o pociones habituales (o uno a mano) a uno o varios personajes.

import { useState } from 'react';
import { describirMod } from '../domain/describir';
import type { Duracion, Personaje, PlantillaEfecto } from '../domain/tipos';
import { EFECTOS_COMUNES, HORA, MINUTO, RONDA, textoDuracion } from '../domain/uso';
import { useCofre } from '../store/cofre';
import { useEscape } from './Dialogos';
import { CamposDuracion, Campo, EditorModificadores, Seccion } from './EditorObjeto';
import { UI } from './iconos';
import { Esquinas, Icono } from './piezas';

const PASOS: [string, number][] = [['1 ronda', RONDA], ['1 min', MINUTO], ['10 min', 10 * MINUTO], ['1 h', HORA]];

const resumen = (ef: PlantillaEfecto) =>
  [ef.modificadores.map(describirMod).join(' · '), ef.concentracion ? 'Concentración' : '', ef.origen ? `De: ${ef.origen}` : '']
    .filter(Boolean).join('\n');

export function BloqueEfectos({ p, avisar }: { p: Personaje; avisar: (texto: string, error?: boolean) => void }) {
  const { quitarEfecto, pasarTiempo } = useCofre();
  const [dialogo, setDialogo] = useState(false);
  const efectos = p.efectos ?? [];

  const pasar = (t: string, s: number) => {
    const fin = pasarTiempo(s);
    avisar(fin.length ? `Pasa ${t}: se acaba ${fin.join(', ')}` : `Pasa ${t}`);
  };

  return (
    <div className="ficha-bloque">
      <h3 className="titulo-sec">Efectos activos</h3>
      <div className="etiquetas">
        {efectos.length === 0 && <span className="vacio">Ninguno</span>}
        {efectos.map((ef) => (
          <span key={ef.id} className="cond buena efecto" title={resumen(ef)}>
            {ef.concentracion && <span className="conc" aria-label="Concentración">◆</span>}
            {ef.nombre}
            <span className="efecto-t">{textoDuracion(ef.duracion)}</span>
            <button type="button" aria-label={`Quitar ${ef.nombre}`} onClick={() => { quitarEfecto(p.id, ef.id); avisar(`${ef.nombre}: quitado`); }}>
              <Icono d={UI.cruz} size={12} />
            </button>
          </span>
        ))}
        <button type="button" className="chip chip-i efecto-anadir" onClick={() => setDialogo(true)}><Icono d={UI.mas} />Añadir</button>
      </div>
      <div className="pasa-tiempo" role="group" aria-label="Pasar el tiempo de juego">
        <span>Pasa</span>
        {PASOS.map(([t, s]) => <button key={t} type="button" className="chip" onClick={() => pasar(t, s)}>{t}</button>)}
      </div>
      {dialogo && <DialogoEfecto p={p} onCerrar={() => setDialogo(false)} avisar={avisar} />}
    </div>
  );
}

const DURACION_DEFECTO: Duracion = { tipo: 'tiempo', segundos: MINUTO };

function DialogoEfecto({ p, onCerrar, avisar }: { p: Personaje; onCerrar: () => void; avisar: (texto: string, error?: boolean) => void }) {
  const { estado, aplicarEfecto } = useCofre();
  const [ef, setEf] = useState<PlantillaEfecto>({ nombre: '', duracion: DURACION_DEFECTO, modificadores: [] });
  const [quienes, setQuienes] = useState<string[]>([p.id]);
  const [error, setError] = useState<string | null>(null);
  useEscape(onCerrar);
  const cambiar = (c: Partial<PlantillaEfecto>) => { setError(null); setEf((x) => ({ ...x, ...c })); };
  const alternar = (id: string) => setQuienes((q) => (q.includes(id) ? q.filter((x) => x !== id) : [...q, id]));

  const aplicar = () => {
    if (!ef.nombre.trim()) { setError('Ponle un nombre'); return; }
    if (!quienes.length) { setError('Elige a quién se aplica'); return; }
    aplicarEfecto(quienes, { ...ef, nombre: ef.nombre.trim() });
    const nombres = estado.personajes.filter((x) => quienes.includes(x.id)).map((x) => x.nombre.split(' ')[0]);
    avisar(`${ef.nombre.trim()} (${textoDuracion(ef.duracion)}): ${nombres.join(', ')}`);
    onCerrar();
  };

  return (
    <>
      <div className="velo" onClick={onCerrar} />
      <section role="dialog" aria-modal="true" aria-labelledby="ef-t" className="panel editor dialogo-efecto">
        <Esquinas />
        <header className="ed-cab">
          <h2 id="ef-t">Añadir efecto temporal</h2>
          <button type="button" className="ibtn" aria-label="Cerrar" onClick={onCerrar}><Icono d={UI.cruz} /></button>
        </header>
        <form className="ed-form" onSubmit={(e) => { e.preventDefault(); aplicar(); }}>
          <Seccion titulo="Habituales" nota="Elige uno para rellenar el formulario; luego puedes cambiar lo que quieras.">
            <div className="chips" style={{ gridColumn: 'span 8' }}>
              {EFECTOS_COMUNES.map((x) => (
                <button key={x.nombre} type="button" className={`chip ${ef.nombre === x.nombre ? 'on' : ''}`} title={resumen(x)} onClick={() => setEf({ ...x, modificadores: x.modificadores.map((m) => ({ ...m })) })}>
                  {x.nombre}
                </button>
              ))}
            </div>
          </Seccion>
          <Seccion titulo="Efecto">
            <Campo label="Nombre" ancho={4}><input value={ef.nombre} placeholder="Bendecir, Escudo de la fe…" onChange={(e) => cambiar({ nombre: e.target.value })} /></Campo>
            <CamposDuracion valor={ef.duracion} onCambio={(duracion) => cambiar({ duracion })} />
            <label className="check" style={{ gridColumn: 'span 8' }}>
              <input type="checkbox" checked={!!ef.concentracion} onChange={(e) => cambiar({ concentracion: e.target.checked || undefined })} />
              Requiere concentración
            </label>
            <EditorModificadores lista={ef.modificadores} onLista={(modificadores) => cambiar({ modificadores })} ayuda="Qué cambia mientras dura. Los bonos con dados (Bendecir: +1d4) van como nota." />
          </Seccion>
          <Seccion titulo="A quién">
            <div className="chips" style={{ gridColumn: 'span 8' }}>
              {estado.personajes.map((x) => (
                <button key={x.id} type="button" role="checkbox" aria-checked={quienes.includes(x.id)} className={`chip ${quienes.includes(x.id) ? 'on' : ''}`} style={{ borderColor: quienes.includes(x.id) ? x.color : undefined }} onClick={() => alternar(x.id)}>
                  {x.nombre}
                </button>
              ))}
            </div>
          </Seccion>
          <button type="submit" hidden />
        </form>
        <footer className="ed-pie">
          {error && <span className="ed-error" role="alert">{error}</span>}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn sec" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="btn pri" onClick={aplicar}>Aplicar efecto</button>
        </footer>
      </section>
    </>
  );
}
