// Pantalla 10 del diseño: hambre de la party y despensa agrupada en raciones, platos e ingredientes.

import { useState } from 'react';
import { claveComida, despensa, diasDeComida, SACIEDAD_POR_DIA, type Comida, type TipoComida } from '../domain/despensa';
import { CLASE_RAREZA, COLOR_RAREZA, estadoSaciedad } from '../domain/reglas';
import type { Personaje } from '../domain/tipos';
import { useCofre } from '../store/cofre';
import { useArrastreApi, useArrastreSel } from './arrastre';
import { ICONOS, UI } from './iconos';
import { Esquinas, Icono, iniciales } from './piezas';

type Avisar = (texto: string, error?: boolean) => void;

const GRUPOS: { tipo: TipoComida; titulo: string; chip: string }[] = [
  { tipo: 'ración', titulo: 'Raciones', chip: 'Raciones' },
  { tipo: 'plato', titulo: 'Platos cocinados', chip: 'Platos' },
  { tipo: 'ingrediente', titulo: 'Ingredientes', chip: 'Ingredientes' },
];

const ICONO_ESTADO = (v: number) =>
  v >= 75 ? UI.check : v >= 15 ? UI.cuenco : 'M12 3l10 18H2zM12 10v5M12 18v.01';

const fmtPeso = (kg: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(kg);

export function Despensa({ busqueda, avisar }: { busqueda: string; avisar: Avisar }) {
  const { estado, comer, pasarDia } = useCofre();
  const comidas = despensa(estado);
  const comestibles = comidas.filter((c) => c.saciedad > 0);
  const [elegida, setElegida] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<TipoComida | null>(null);
  // Si la comida elegida se acaba, pasa a la primera que quede
  const sel = comestibles.find((c) => c.clave === elegida) ?? comestibles[0];
  const dias = diasDeComida(estado);

  const darDeComer = (p: Personaje) => {
    if (!sel) return avisar('No queda nada que comer en la despensa', true);
    const r = comer(p.id, sel.clave);
    avisar(r.ok ? r.texto : r.motivo, !r.ok);
  };

  return (
    <div className="despensa">
      <section className="panel des-hambre" aria-label="Hambre de la party">
        <Esquinas />
        <header>
          <h2 className="h">Hambre de la party</h2>
          <span className="s">
            Arrastra comida sobre un personaje o pulsa Comer · {sel ? <>usa <b>{sel.nombre}</b></> : 'no queda comida'}
          </span>
        </header>
        {estado.personajes.map((p) => <FilaHambre key={p.id} p={p} onComer={() => darDeComer(p)} puede={!!sel} />)}
        <div className="des-reservas">
          <span className="k">Reservas</span>
          <span className="des-dias">
            Comida para <span style={{ color: dias >= 3 ? '#9cc95e' : dias >= 1 ? '#e0883a' : '#e0534d' }}>{dias} {dias === 1 ? 'día' : 'días'}</span> de la party
          </span>
          <div className="des-reservas-pie">
            <span className="s">La saciedad baja {SACIEDAD_POR_DIA} puntos por día de viaje.</span>
            <button
              type="button" className="btn sec"
              onClick={() => { pasarDia(); avisar(`Un día de viaje: toda la party pierde ${SACIEDAD_POR_DIA} de saciedad`); }}
            >
              Pasar un día
            </button>
          </div>
        </div>
      </section>

      <section className="panel des-lista" aria-label="Despensa">
        <Esquinas />
        <header>
          <h2 className="h">Despensa</h2>
          <div role="group" aria-label="Filtrar despensa" className="des-chips">
            <button type="button" className={`chip ${filtro === null ? 'on' : ''}`} aria-pressed={filtro === null} onClick={() => setFiltro(null)}>Todo</button>
            {GRUPOS.map((g) => (
              <button key={g.tipo} type="button" className={`chip ${filtro === g.tipo ? 'on' : ''}`} aria-pressed={filtro === g.tipo} onClick={() => setFiltro(g.tipo)}>{g.chip}</button>
            ))}
          </div>
        </header>
        {comidas.length === 0 && <p className="s des-vacia">La despensa está vacía. Cualquier objeto de la categoría Comida aparece aquí, lo lleve quien lo lleve.</p>}
        {GRUPOS.filter((g) => filtro === null || filtro === g.tipo).map((g) => {
          const items = comidas.filter((c) => c.tipo === g.tipo);
          if (items.length === 0) return null;
          return (
            <div key={g.tipo} className="des-grupo">
              <h3 className="est-sec">{g.titulo}</h3>
              <div className="des-rejilla">
                {items.map((c) => (
                  <TarjetaComida key={c.clave} c={c} elegida={c.clave === sel?.clave} busqueda={busqueda} onElegir={() => setElegida(c.clave)} />
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function FilaHambre({ p, onComer, puede }: { p: Personaje; onComer: () => void; puede: boolean }) {
  const sac = estadoSaciedad(p.saciedad);
  const clave = `comer:${p.id}`;
  // Mientras se arrastra comida, la fila indica si el personaje puede comérsela
  const marca = useArrastreSel((a) => {
    if (a?.objeto.categoria !== 'Comida') return '';
    const vale = (a.objeto.saciedad ?? 0) > 0 && p.saciedad < 100;
    return a.objetivo?.clave === clave ? (vale ? 'drop-ok' : 'drop-no') : vale ? 'acepta' : '';
  });
  return (
    <div className={`des-fila ${p.saciedad < 15 ? 'famelico' : ''} ${marca}`} data-drop={clave}>
      <span className="des-ini" style={{ borderColor: p.color, background: `linear-gradient(180deg, ${p.color}88, #0b0907)` }}>
        {p.imagenUrl ? <img src={p.imagenUrl} alt="" /> : iniciales(p.nombre)}
      </span>
      <div className="des-info">
        <div className="des-cab">
          <span className="des-nombre">{p.nombre}</span>
          <span className="des-estado" style={{ color: sac.color }}><Icono d={ICONO_ESTADO(p.saciedad)} size={16} />{sac.texto}</span>
        </div>
        <div className="des-barra" title={`${p.saciedad} / 100`} role="meter" aria-label={`Saciedad de ${p.nombre}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.saciedad}>
          <div style={{ width: `${p.saciedad}%`, background: `linear-gradient(90deg, ${sac.color}88, ${sac.color})`, boxShadow: `0 0 10px ${sac.color}66` }} />
          {[15, 40, 75].map((x) => <span key={x} aria-hidden="true" style={{ left: `${x}%` }} />)}
        </div>
        <span className="des-efecto">{sac.efecto}</span>
      </div>
      <button type="button" className="des-comer" onClick={onComer} disabled={!puede || p.saciedad >= 100} aria-label={`Comer: ${p.nombre}`}>
        <Icono d={UI.cuenco} />Comer
      </button>
    </div>
  );
}

function TarjetaComida({ c, elegida, busqueda, onElegir }: { c: Comida; elegida: boolean; busqueda: string; onElegir: () => void }) {
  const { empezar } = useArrastreApi();
  const arrastrando = useArrastreSel((a) => !!a && claveComida(a.objeto) === c.clave);
  const q = busqueda.trim().toLocaleLowerCase('es');
  const atenuada = q && !c.nombre.toLocaleLowerCase('es').includes(q);
  const color = c.rareza === 'común' ? '#ece4d2' : COLOR_RAREZA[c.rareza];
  const donde = c.pilas.length === 1 && c.pilas[0].propietario.tipo === 'alijo' ? 'En el alijo' : null;
  return (
    <button
      type="button" className={`des-comida ${elegida ? 'on' : ''} ${atenuada ? 'no' : ''}`} aria-pressed={elegida}
      onClick={onElegir} onPointerDown={(e) => c.saciedad > 0 && empezar(e, c.pilas[0])}
      title={c.saciedad > 0 ? 'Pulsa para elegirla o arrástrala sobre un personaje' : undefined}
    >
      <span className={`slot has ${CLASE_RAREZA[c.rareza]} ${arrastrando ? 'origin' : ''}`}>
        <Icono d={ICONOS[c.icono]} />
        <span className="qty">{c.cantidad}</span>
      </span>
      <span className="des-datos">
        <span style={{ color }}>{c.nombre}</span>
        <span>
          <b style={{ color: c.saciedad > 0 ? '#9cc95e' : '#9d917b' }}>{c.saciedad > 0 ? `+${c.saciedad} saciedad` : 'No se come solo'}</b>
          <span className="tenue">·</span>
          <span>{fmtPeso(c.pesoKg)} kg{c.cantidad > 1 ? ' c/u' : ''}</span>
        </span>
        <span className="des-nota">{c.nota ?? donde ?? ' '}</span>
      </span>
    </button>
  );
}
