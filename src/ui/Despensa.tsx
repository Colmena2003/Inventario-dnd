// Pantalla 10 del diseño: hambre de la party y despensa. Saciedad de 0 a 7 [casera]: baja con el tiempo y
// los descansos, sube al comer, y por debajo de 4 empieza a dar penalizaciones.

import { useState, type CSSProperties } from 'react';
import {
  EFECTOS_HAMBRE, estadoSaciedad, fmtKg, nombreDe, SACIEDAD_DESCANSO_LARGO, SACIEDAD_MAX,
} from '../domain/reglas';
import type { Objeto, Personaje } from '../domain/tipos';
import { useCofre } from '../store/cofre';
import { useArrastre } from './arrastre';
import { useEditor } from './editorCtx';
import { UI } from './iconos';
import { useInteraccion } from './interaccion';
import { Esquinas, iniciales, Icono, Ranura } from './piezas';

const GRUPOS: { id: string; titulo: string; subtipos: string[] }[] = [
  { id: 'racion', titulo: 'Raciones', subtipos: ['ración'] },
  { id: 'plato', titulo: 'Platos cocinados', subtipos: ['plato'] },
  { id: 'bebida', titulo: 'Bebidas', subtipos: ['bebida'] },
  { id: 'ingrediente', titulo: 'Ingredientes', subtipos: ['ingrediente'] },
];
const FILTROS = [{ id: 'todo', t: 'Todo' }, { id: 'racion', t: 'Raciones' }, { id: 'plato', t: 'Platos' }, { id: 'bebida', t: 'Bebidas' }, { id: 'ingrediente', t: 'Ingredientes' }];

export function Despensa({ avisar, busqueda }: { avisar: (texto: string, error?: boolean) => void; busqueda: string }) {
  const { estado, comer, cambiarSaciedad, descansar } = useCofre();
  const editor = useEditor();
  const comida = estado.objetos.filter((o) => o.categoria === 'Comida');
  const comestibles = comida.filter((o) => (o.saciedad ?? 0) > 0);
  const [elegida, setElegida] = useState<string | null>(null);
  // Un clic elige la comida; arrastrarla sobre un personaje se la da de comer
  const { props, clase } = useInteraccion(busqueda, undefined, (o) => { if ((o.saciedad ?? 0) > 0) setElegida(o.id); });
  const [filtro, setFiltro] = useState('todo');
  const sel = comestibles.find((o) => o.id === elegida) ?? comestibles[0];
  const todos = estado.personajes.map((p) => p.id);

  const grupoDe = (o: Objeto) => GRUPOS.find((g) => g.subtipos.includes(o.subtipo ?? ''))?.id ?? 'otros';
  const grupos = [...GRUPOS, { id: 'otros', titulo: 'Otros', subtipos: [] }]
    .filter((g) => filtro === 'todo' || g.id === filtro)
    .map((g) => ({ ...g, objetos: comida.filter((o) => grupoDe(o) === g.id) }))
    .filter((g) => g.objetos.length);

  const puntos = comestibles.reduce((s, o) => s + (o.saciedad ?? 0) * o.cantidad, 0);
  // Un día de mazmorra: un descanso largo (−4) y, como poco, unas horas de marcha
  const porDia = Math.max(1, estado.personajes.length) * (SACIEDAD_DESCANSO_LARGO + 4);

  const hacerComer = (p: Personaje) => {
    if (!sel) { avisar('No queda comida que se pueda comer', true); return; }
    const r = comer(p.id, sel.id);
    if (!r.ok) avisar(r.motivo, true);
    else avisar(`${p.nombre.split(' ')[0]} come ${sel.nombre.toLowerCase()}: saciedad ${r.antes} → ${r.despues}`);
  };

  const descanso = (tipo: 'corto' | 'largo') => {
    const r = descansar(todos, tipo);
    const nombres = (ids: string[]) => ids.map((id) => estado.personajes.find((p) => p.id === id)?.nombre.split(' ')[0]).join(', ');
    const extra = [
      r.recargas.length ? `Recuperan: ${r.recargas.join(', ')}` : '',
      r.terminados.length ? `Se acaba: ${r.terminados.join(', ')}` : '',
    ].filter(Boolean).join('. ');
    if (r.bloqueados.length) avisar(`Sin saciedad para un descanso largo (necesitan ${SACIEDAD_DESCANSO_LARGO}): ${nombres(r.bloqueados)}. Que coman antes.${r.hechos.length && extra ? ` ${extra}.` : ''}`, true);
    else avisar(`${tipo === 'largo' ? `Descanso largo: −${SACIEDAD_DESCANSO_LARGO} de saciedad` : 'Descanso corto: −1 de saciedad'}${extra ? `. ${extra}` : ''}`);
  };

  return (
    <main className="despensa-pant">
      <section className="panel hambre" aria-label="Hambre de la party">
        <Esquinas />
        <header>
          <h2>Hambre de la party</h2>
          <p>Arrastra comida sobre un personaje o pulsa Comer para usar <b>{sel ? sel.nombre : 'la comida elegida'}</b>{sel ? ` (+${sel.saciedad})` : ''}.</p>
        </header>
        <ul className="hambre-lista">
          {estado.personajes.map((p) => <FilaHambre key={p.id} p={p} onComer={() => hacerComer(p)} puedeComer={!!sel} onAjustar={(d) => cambiarSaciedad([p.id], d)} />)}
        </ul>

        <div className="tiempo">
          <span className="k">Paso del tiempo · a toda la party</span>
          <div>
            <button type="button" className="btn sec" onClick={() => { cambiarSaciedad(todos, -1); avisar('Pasa el tiempo: −1 de saciedad a todos'); }} title="En la mazmorra la saciedad baja 1 cada 30–90 minutos (lo decide el DM)">
              Pasa el tiempo · −1
            </button>
            <button type="button" className="btn sec" onClick={() => descanso('corto')}>Descanso corto · −1</button>
            <button type="button" className="btn sec" onClick={() => descanso('largo')} title={`Hace falta empezar con ${SACIEDAD_DESCANSO_LARGO} o más`}>Descanso largo · −{SACIEDAD_DESCANSO_LARGO}</button>
          </div>
        </div>

        <div className="reglas-hambre">
          <span className="k">Hambre de mazmorra</span>
          <p>
            Un hambre antinatural cae sobre quien entra en la mazmorra. La saciedad va de 0 a {SACIEDAD_MAX} y baja 1 cada 30–90 min,
            1 con un descanso corto y {SACIEDAD_DESCANSO_LARGO} con uno largo, que solo se puede empezar con {SACIEDAD_DESCANSO_LARGO} o más.
          </p>
          <ul>{EFECTOS_HAMBRE.map(([n, t]) => <li key={n}><b style={{ color: estadoSaciedad(n).color }}>{n}/{SACIEDAD_MAX}</b> {t}</li>)}</ul>
          <span className="reservas">Reservas: <b>{puntos}</b> puntos de saciedad · unos <b>{Math.floor(puntos / porDia)}</b> días de la party</span>
        </div>
      </section>

      <section className="panel despensa" aria-label="Despensa">
        <Esquinas />
        <header>
          <h2>Despensa</h2>
          <div className="filtros" role="group" aria-label="Filtrar comida">
            {FILTROS.map((f) => (
              <button key={f.id} type="button" className={`chip ${filtro === f.id ? 'on' : ''}`} aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>{f.t}</button>
            ))}
            <button type="button" className="chip on chip-i" onClick={() => editor.nuevo({ tipo: 'comida', propietario: { tipo: 'alijo' } })}>
              <Icono d={UI.mas} />Añadir comida
            </button>
          </div>
        </header>
        <div className="despensa-cuerpo">
          {grupos.length === 0 && <p className="vacio">No hay comida. Añade raciones con «Añadir comida».</p>}
          {grupos.map((g) => (
            <section key={g.id}>
              <h3 className="sec-despensa">{g.titulo}</h3>
              <div className="comidas">
                {g.objetos.map((o) => {
                  const come = (o.saciedad ?? 0) > 0;
                  return (
                    <button
                      key={o.id} type="button" className={`comida ${sel?.id === o.id ? 'on' : ''} ${come ? '' : 'nocome'}`}
                      aria-pressed={sel?.id === o.id} aria-disabled={!come} onClick={() => come && setElegida(o.id)}
                      onContextMenu={(e) => { e.preventDefault(); editor.editar(o); }}
                    >
                      <Ranura objeto={o} extra={clase(o)} {...props(o)} style={{ '--slot': '64px' } as CSSProperties} />
                      <span className="comida-t">
                        <b className={`r-${o.rareza === 'común' ? 'c' : 'u'}`}>{o.nombre}</b>
                        <span>
                          <b className={come ? 'mas' : 'cero'}>{come ? `+${o.saciedad} saciedad` : 'No se come sola'}</b>
                          {' · '}{fmtKg(o.pesoKg)} kg
                        </span>
                        <span className="de">{nombreDe(estado, o.propietario)}{o.efectos ? ` · ${o.efectos}` : ''}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <footer className="despensa-pie">Clic para elegir qué se come · arrastra sobre un personaje para que se la coma · a un retrato para dársela · clic derecho para más opciones</footer>
      </section>
    </main>
  );
}

function FilaHambre({ p, onComer, puedeComer, onAjustar }: { p: Personaje; onComer: () => void; puedeComer: boolean; onAjustar: (d: number) => void }) {
  const s = estadoSaciedad(p.saciedad);
  const { arrastre } = useArrastre();
  const apuntada = arrastre?.objetivo?.clave === `comer:${p.id}`;
  const marca = apuntada ? (arrastre!.objeto.categoria === 'Comida' && (arrastre!.objeto.saciedad ?? 0) > 0 && p.saciedad < SACIEDAD_MAX ? 'drop-ok' : 'drop-no') : '';
  return (
    <li className={`fila-hambre ${s.nivel <= 1 ? 'grave' : ''} ${marca}`} style={{ '--c': s.color, '--pj': p.color } as CSSProperties} data-drop={`comer:${p.id}`}>
      <div className="fh-retrato">{p.imagenUrl ? <img src={p.imagenUrl} alt="" /> : iniciales(p.nombre)}</div>
      <div className="fh-centro">
        <div className="fh-cab">
          <b>{p.nombre}</b>
          <span style={{ color: s.color }}>{s.texto} · {p.saciedad}/{SACIEDAD_MAX}</span>
        </div>
        <div className="segmentos" role="meter" aria-valuemin={0} aria-valuemax={SACIEDAD_MAX} aria-valuenow={p.saciedad} aria-label={`Saciedad de ${p.nombre}`}>
          {Array.from({ length: SACIEDAD_MAX }, (_, i) => <i key={i} className={i < p.saciedad ? 'lleno' : ''} />)}
        </div>
        <span className="fh-efecto">{s.efectos.length ? `${s.efectos.join(' · ')} · sin descanso largo` : 'Sin efectos'}</span>
      </div>
      <div className="fh-ajuste">
        <button type="button" className="ibtn" aria-label={`Subir la saciedad de ${p.nombre}`} onClick={() => onAjustar(1)}><Icono d={UI.mas} /></button>
        <button type="button" className="ibtn" aria-label={`Bajar la saciedad de ${p.nombre}`} onClick={() => onAjustar(-1)}><Icono d={UI.menos} /></button>
      </div>
      <button type="button" className="btn pri comer" disabled={!puedeComer || p.saciedad >= SACIEDAD_MAX} onClick={onComer}>
        <Icono d={UI.cuenco} size={18} />Comer
      </button>
    </li>
  );
}
