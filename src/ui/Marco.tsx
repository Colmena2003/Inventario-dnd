// Piezas compartidas por todas las pantallas: barra superior y barra lateral de retratos.

import { cargaMaxKg, estadoSaciedad, pesoPersonajeKg } from '../domain/reglas';
import { useCofre } from '../store/cofre';
import { useArrastre } from './arrastre';
import { UI } from './iconos';
import { fmt1, fmtNum, iniciales, Icono, Moneda, MONEDAS } from './piezas';

export type Pestana = 'grupal' | 'individual' | 'estadisticas' | 'crafteo' | 'despensa';

export const PESTANAS: { id: Pestana; label: string; d: string }[] = [
  { id: 'grupal', label: 'Inventario grupal', d: 'M3 11h18v9H3zM3 11a9 6 0 0 1 18 0M10.5 13h3v3.5h-3z' },
  { id: 'individual', label: 'Inventarios individuales', d: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5' },
  { id: 'estadisticas', label: 'Estadísticas', d: 'M12 3l8 4.6v8.8L12 21l-8-4.6V7.6zM12 8l4 2.3v4.4L12 17l-4-2.3v-4.4z' },
  { id: 'crafteo', label: 'Crafteo', d: 'M13 4l7 7-2.5 2.5-7-7zM10.5 9.5L3 17l3 3 7.5-7.5' },
  { id: 'despensa', label: 'Despensa', d: 'M3 11h18a9 9 0 0 1-18 0zM8.5 8c0-1 1-1.2 1-2.2S8.5 4.5 8.5 3.5M12 8c0-1 1-1.2 1-2.2S12 4.5 12 3.5M15.5 8c0-1 1-1.2 1-2.2s-1-1.3-1-2.3' },
];

export function Topbar({ activa, onPestana, busqueda, onBusqueda }: {
  activa: Pestana;
  onPestana: (p: Pestana) => void;
  busqueda: string;
  onBusqueda: (s: string) => void;
}) {
  const { estado } = useCofre();
  return (
    <header className="topbar">
      <div className="marca">
        <svg viewBox="0 0 40 40" width="38" height="38" aria-hidden="true" style={{ flex: 'none' }}>
          <path d="M20 2l16 9v18l-16 9-16-9V11z" fill="#120f0b" stroke="#a88a4c" strokeWidth="1.2" />
          <path d="M20 7l11 6.3v13.4L20 33 9 26.7V13.3z" fill="none" stroke="#5e4c2b" strokeWidth="1" />
          <path d="M12 21h16v7H12zM12 21a8 5 0 0 1 16 0M18.6 22.5h2.8v3h-2.8z" fill="none" stroke="#e2c27a" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
        <div className="marca-t">
          <b>Cofre de la Compañía</b>
          <span>Inventario de la party</span>
        </div>
      </div>
      <nav className="tabs" aria-label="Secciones">
        {PESTANAS.map((t) => (
          <button key={t.id} type="button" className="tab" aria-current={t.id === activa ? 'page' : undefined} onClick={() => onPestana(t.id)}>
            <span className="dot"><Icono d={t.d} /></span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      <div className="top-dcha">
        <div className="tesoro" aria-label="Tesoro común de la party">
          <span>Tesoro</span>
          {MONEDAS.map((m) => (
            <span key={m.k} className="moneda-v"><Moneda {...m} />{fmtNum(estado.party.tesoro[m.k])}</span>
          ))}
        </div>
        <label className="buscar">
          <span className="sr-only">Buscar objetos</span>
          <Icono d={UI.lupa} />
          <input type="search" placeholder="Buscar objetos…" value={busqueda} onChange={(e) => onBusqueda(e.target.value)} />
        </label>
        <button type="button" className="rbtn" aria-label="Filtros de búsqueda" aria-disabled="true" title="Próximamente">
          <Icono d={UI.filtro} />
        </button>
      </div>
      <svg className="topbar-orla" viewBox="0 0 600 14" width="600" height="14" aria-hidden="true">
        <path d="M0 7h270M330 7h270" stroke="#6b5631" strokeWidth="1" />
        <path d="M300 1l7 6-7 6-7-6z" fill="#0a0807" stroke="#b89a55" strokeWidth="1" />
        <path d="M276 7l6-4M276 7l6 4M324 7l-6-4M324 7l-6 4" stroke="#b89a55" strokeWidth="1" fill="none" />
      </svg>
    </header>
  );
}

export function Retratos({ activo, onActivo }: { activo: string | null; onActivo: (id: string) => void }) {
  const { estado, validar } = useCofre();
  const { arrastre } = useArrastre();
  const peso = estado.personajes.reduce((s, p) => s + pesoPersonajeKg(estado, p), 0);
  // Soltar un objeto sobre un retrato se lo da a ese personaje
  const marca = (id: string) => {
    if (arrastre?.objetivo?.clave !== `pj:${id}` || !arrastre.celda?.closest('.retratos')) return '';
    return validar(arrastre.objeto.id, { propietario: { tipo: 'personaje', id } }).ok ? 'drop-ok' : 'drop-no';
  };
  const max = estado.personajes.reduce((s, p) => s + cargaMaxKg(p.fue), 0);
  return (
    <nav className="retratos" aria-label="Personajes">
      {estado.personajes.map((p, i) => {
        const sac = estadoSaciedad(p.saciedad);
        return (
          <div key={p.id} className="retrato">
            <button
              type="button" className={`retrato-btn ${marca(p.id)}`} aria-pressed={p.id === activo} data-drop={`pj:${p.id}`}
              aria-label={`${p.nombre}, ${p.pvActual} de ${p.pvMax} PV, ${sac.texto}`} onClick={() => onActivo(p.id)}
            >
              <svg viewBox="0 0 80 92" width="76" height="88" aria-hidden="true" style={{ display: 'block' }}>
                <defs>
                  <linearGradient id={`pt${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={p.color} stopOpacity=".55" />
                    <stop offset="1" stopColor="#0b0907" />
                  </linearGradient>
                </defs>
                <rect width="80" height="92" fill="#0d0b09" />
                <rect width="80" height="92" fill={`url(#pt${i})`} />
                <path d="M40 18a15 15 0 1 1 0 30 15 15 0 0 1 0-30zM10 92c0-22 13-36 30-36s30 14 30 36z" fill="#0a0806" opacity=".85" />
                <path d="M40 18a15 15 0 1 1 0 30 15 15 0 0 1 0-30zM10 92c0-22 13-36 30-36s30 14 30 36z" fill="none" stroke={p.color} strokeOpacity=".7" strokeWidth="1" />
                <text x="40" y="40" textAnchor="middle" fontFamily="Cinzel, serif" fontSize="14" fontWeight="700" fill="#e9d6a8">{iniciales(p.nombre)}</text>
              </svg>
              {p.imagenUrl && <img src={p.imagenUrl} alt="" />}
              <span className="retrato-pv">{p.pvActual}/{p.pvMax}</span>
            </button>
            <div className="barra-pv" aria-hidden="true">
              <div style={{ height: 4, width: `${Math.round((p.pvActual / p.pvMax) * 100)}%`, background: 'linear-gradient(90deg,#8e2420,#c8403a)' }} />
            </div>
            <div className="mini-sac" title={`Saciedad: ${sac.texto}`}>
              <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" style={{ flex: 'none', fill: 'none', stroke: sac.color, strokeWidth: 2, strokeLinecap: 'round' }}><path d={UI.cuenco} /></svg>
              <div><div style={{ height: 4, width: `${p.saciedad}%`, background: sac.color }} /></div>
            </div>
          </div>
        );
      })}
      <button type="button" className="anadir" aria-label="Añadir personaje" aria-disabled="true" title="Próximamente">
        <Icono d={UI.mas} />
      </button>
      <div className="carga-lat">
        <span>Carga</span>
        <span>{fmt1(peso)}</span>
        <span>/ {max} kg</span>
      </div>
    </nav>
  );
}
