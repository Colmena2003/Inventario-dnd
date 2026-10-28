// Pantalla 12 del diseño: tarjeta por personaje, radar de características y barras de valor y carga.

import { useState, type CSSProperties } from 'react';
import {
  ataque, cargaMaxKg, COLOR_RAREZA, CONDICION_MALA, conSigno, equipadoEn, estadoSaciedad, fmtKg, modificador, RAREZAS,
  resumenInventario, tramoCarga, type Ataque,
} from '../domain/reglas';
import type { Caracteristica, Personaje, Rareza } from '../domain/tipos';
import { useCofre } from '../store/cofre';
import { ClasesConIcono } from './clases';
import { Esquinas, fmtNum, iniciales } from './piezas';

const CARACTERISTICAS: [Caracteristica, string][] = [['fue', 'FUE'], ['des', 'DES'], ['con', 'CON'], ['int', 'INT'], ['sab', 'SAB'], ['car', 'CAR']];
const SIGLA_RAREZA: Record<Rareza, string> = { 'común': 'C', 'poco común': 'PC', 'raro': 'R', 'muy raro': 'MR', 'legendario': 'L', 'artefacto': 'A' };
/** Trazo de cada personaje en el radar, para distinguirlos sin depender solo del color. */
const TRAZOS = ['none', '8 5', '2 5', '14 4 3 4', '4 3'];

const colorCarga = (peso: number, max: number) => {
  const t = tramoCarga(peso, max);
  return t.id === 'normal' ? undefined : t.color;
};

function Retrato({ p, tam }: { p: Personaje; tam: 'g' | 'p' }) {
  return (
    <span className={`est-ini ${tam}`} style={{ borderColor: p.color, background: `linear-gradient(180deg, ${p.color}88, #0b0907)` }}>
      {p.imagenUrl ? <img src={p.imagenUrl} alt="" /> : iniciales(p.nombre)}
    </span>
  );
}

export function Estadisticas() {
  const { estado } = useCofre();
  const [ocultos, setOcultos] = useState<string[]>([]);
  const pjs = estado.personajes;
  return (
    <div className="estadisticas">
      <div className="est-tarjetas" style={{ gridTemplateColumns: `repeat(${Math.max(pjs.length, 1)}, minmax(0, 1fr))` }}>
        {pjs.map((p) => <Tarjeta key={p.id} p={p} />)}
      </div>
      <Radar ocultos={ocultos} onAlternar={(id) => setOcultos((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))} />
      <Barras />
    </div>
  );
}

// ── Tarjeta de personaje ───────────────────────────────────────────

const textoAtaque = (a: Ataque | null) => (a ? <><b>{conSigno(a.bono)}</b> · {a.dano}</> : <span className="tenue">—</span>);

function Tarjeta({ p }: { p: Personaje }) {
  const { estado } = useCofre();
  const r = resumenInventario(estado, p);
  const max = cargaMaxKg(p.fue);
  const atqM = ataque(p, equipadoEn(estado, p.id, 'cuerpoACuerpo', 0), 'cuerpoACuerpo');
  const atqR = ataque(p, equipadoEn(estado, p.id, 'distancia', 0), 'distancia');

  // Las condiciones de la ficha, más el hambre y la carga cuando tienen efecto
  const sac = estadoSaciedad(p.saciedad);
  const tramo = tramoCarga(r.pesoKg, max);
  const conds = [
    ...p.condiciones,
    ...(p.saciedad < 40 ? [sac.texto] : []),
    ...(tramo.id !== 'normal' ? [tramo.id === 'cargado' ? 'Cargado' : 'Sobrecargado'] : []),
  ];
  const colorCond = conds.length === 0 ? '#9d917b'
    : p.saciedad < 15 || tramo.id === 'sobrecargado' ? '#e0534d'
    : conds.some((c) => CONDICION_MALA.test(c)) || p.saciedad < 40 || tramo.id === 'cargado' ? '#e0883a'
    : '#b9e08a';

  return (
    <article className="panel est-tarjeta" aria-label={p.nombre}>
      <Esquinas solo="arriba" />
      <header>
        <Retrato p={p} tam="g" />
        <div className="est-nombre">
          <h2 className="h">{p.nombre}</h2>
          <span className="s">{p.raza} · <ClasesConIcono clases={p.clases} tam={14} /></span>
        </div>
        <div className="est-ca">
          <svg viewBox="0 0 76 84" width="50" height="56" aria-hidden="true"><path d="M38 3l32 10v26c0 20-14 34-32 42C20 73 6 59 6 39V13z" fill="#0f0c0a" stroke="#b89a55" strokeWidth="2" /></svg>
          <span>CA</span>
          <span>{p.ca}</span>
        </div>
      </header>

      <div className="est-pv">
        <div><span className="k">PV</span><span><b>{p.pvActual}</b> / {p.pvMax}</span></div>
        <div className="est-pv-barra"><div style={{ width: `${Math.round((p.pvActual / p.pvMax) * 100)}%` }} /></div>
      </div>

      <div className="est-car">
        {CARACTERISTICAS.map(([k, t]) => {
          const v = p[k];
          return (
            <div key={k}>
              <span className="k">{t}</span>
              <b>{v}</b>
              <span style={{ color: v >= 12 ? '#9cc95e' : v < 10 ? '#e0883a' : '#cfc3aa' }}>{conSigno(modificador(v))}</span>
            </div>
          );
        })}
      </div>

      <h3 className="est-sec">Combate</h3>
      <dl className="est-combate">
        <dt>Cuerpo a cuerpo</dt><dd>{textoAtaque(atqM)}</dd>
        <dt>A distancia</dt><dd>{textoAtaque(atqR)}</dd>
        <dt>Resistencias</dt><dd>{p.resistencias.length ? p.resistencias.map((x) => x.split(' · ')[0]).join(' · ') : '—'}</dd>
        <dt>Condiciones</dt><dd style={{ color: colorCond }}>{conds.length ? conds.map((x) => x.split(' · ')[0]).join(' · ') : 'Ninguna'}</dd>
      </dl>

      <h3 className="est-sec">Inventario</h3>
      <div className="est-inv">
        <div><span className="k">Valor</span><b style={{ color: '#e8c46c' }}>{fmtNum(Math.round(r.valorPo))} PO</b></div>
        <div><span className="k">Peso</span><b style={{ color: colorCarga(r.pesoKg, max) }}>{fmtKg(r.pesoKg)} kg</b></div>
        <div><span className="k">Objetos</span><b>{r.objetos}</b></div>
      </div>
      <div className="est-rarezas">
        <div aria-hidden="true">
          {RAREZAS.filter((x) => r.porRareza[x] > 0).map((x) => <div key={x} style={{ flex: r.porRareza[x], background: COLOR_RAREZA[x] }} />)}
        </div>
        <div>
          {RAREZAS.map((x) => (
            <span key={x} title={x[0].toUpperCase() + x.slice(1)} style={{ color: r.porRareza[x] ? COLOR_RAREZA[x] : '#5d5242' }}>
              {SIGLA_RAREZA[x]} {r.porRareza[x]}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

// ── Radar de características ───────────────────────────────────────

const CX = 320, CY = 188, R = 150;

function Radar({ ocultos, onAlternar }: { ocultos: string[]; onAlternar: (id: string) => void }) {
  const { estado } = useCofre();
  const pjs = estado.personajes;
  // La escala llega a 20, salvo que alguien lo supere (objetos como el Cinturón de fuerza de gigante)
  const tope = Math.max(20, ...pjs.flatMap((p) => CARACTERISTICAS.map(([k]) => p[k])));
  const punto = (i: number, v: number) => {
    const a = ((-90 + 60 * i) * Math.PI) / 180;
    return [CX + (Math.cos(a) * R * v) / tope, CY + (Math.sin(a) * R * v) / tope];
  };
  const puntos = (vs: number[]) => vs.map((v, i) => punto(i, v).map((n) => n.toFixed(1)).join(',')).join(' ');
  const anillos = [0.25, 0.5, 0.75, 1].map((f) => f * tope);

  return (
    <section className="panel est-radar" aria-label="Comparativa de características">
      <svg className="cn bl" viewBox="0 0 30 30" aria-hidden="true"><path d="M2 28V10L10 2h18M6 24V12l6-6h12M2 10h5M10 2v5" /><circle cx="10" cy="10" r="1.8" fill="#b89a55" /></svg>
      <div className="est-radar-g">
        <h2 className="h">Comparativa de características</h2>
        <div className="est-radar-lienzo">
          {CARACTERISTICAS.map(([k, t], i) => {
            const [x, y] = punto(i, tope * 1.16);
            return <span key={k} className="est-eje" style={{ left: (x * 623) / 640, top: (y * 623) / 640 }}>{t}</span>;
          })}
          <svg viewBox="0 0 640 370" width="623" height="360" role="img" aria-label="Gráfico radar con las seis características de cada personaje">
            {anillos.map((v) => <polygon key={v} points={puntos(Array(6).fill(v))} fill="none" stroke="#3a2f1d" strokeWidth="1" />)}
            {CARACTERISTICAS.map(([k], i) => {
              const [x, y] = punto(i, tope);
              return <line key={k} x1={CX} y1={CY} x2={x} y2={y} stroke="#3a2f1d" strokeWidth="1" />;
            })}
            <text x={CX + 6} y={CY - R - 4} fontFamily="Alegreya Sans, sans-serif" fontSize="11" fill="#8f846f">{tope}</text>
            <text x={CX + 6} y={CY - R / 2 - 4} fontFamily="Alegreya Sans, sans-serif" fontSize="11" fill="#8f846f">{tope / 2}</text>
            {pjs.map((p, j) => {
              if (ocultos.includes(p.id)) return null;
              const vs = CARACTERISTICAS.map(([k]) => p[k]);
              return (
                <g key={p.id}>
                  <title>{p.nombre}: {CARACTERISTICAS.map(([k, t]) => `${t} ${p[k]}`).join(', ')}</title>
                  <polygon points={puntos(vs)} fill={p.color} fillOpacity=".14" stroke={p.color} strokeWidth="2.4" strokeDasharray={TRAZOS[j % TRAZOS.length]} strokeLinejoin="round" />
                  {vs.map((v, i) => {
                    const [x, y] = punto(i, v);
                    return <circle key={i} cx={x} cy={y} r="3.5" fill={p.color} stroke="#0b0907" strokeWidth="1.5" />;
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      <div className="est-leyenda">
        <span className="k">Leyenda · pulsa para ocultar</span>
        {pjs.map((p, j) => {
          const oculto = ocultos.includes(p.id);
          return (
            <button key={p.id} type="button" className={`leg ${oculto ? 'off' : ''}`} aria-pressed={!oculto} onClick={() => onAlternar(p.id)}>
              <Retrato p={p} tam="p" />
              <svg viewBox="0 0 30 6" width="30" height="6" aria-hidden="true">
                <line x1="0" y1="3" x2="30" y2="3" stroke={p.color} strokeWidth="2.4" strokeDasharray={TRAZOS[j % TRAZOS.length]} />
              </svg>
              <span>{p.nombre}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── Valor del inventario y carga ───────────────────────────────────

const ALTO_BARRA = 220;

function Barras() {
  const { estado } = useCofre();
  const datos = estado.personajes.map((p) => ({ p, r: resumenInventario(estado, p), max: cargaMaxKg(p.fue) }));
  const maxValor = Math.max(1, ...datos.map((d) => d.r.valorPo));
  return (
    <section className="panel est-barras" aria-label="Valor y carga">
      <svg className="cn br" viewBox="0 0 30 30" aria-hidden="true"><path d="M2 28V10L10 2h18M6 24V12l6-6h12M2 10h5M10 2v5" /><circle cx="10" cy="10" r="1.8" fill="#b89a55" /></svg>
      <div className="est-graf">
        <h2 className="h">Valor del inventario</h2>
        <span className="s">En piezas de oro, objetos equipados incluidos</span>
        <div className="est-columnas">
          {datos.map(({ p, r }) => (
            <div key={p.id} title={`${p.nombre}: ${fmtNum(Math.round(r.valorPo))} PO`}>
              <span>{fmtNum(Math.round(r.valorPo))}</span>
              <div style={{ height: Math.round((r.valorPo / maxValor) * ALTO_BARRA), background: `linear-gradient(180deg, ${p.color}, ${p.color}55)`, border: `1px solid ${p.color}`, borderBottom: 0 } as CSSProperties} />
            </div>
          ))}
        </div>
        <div className="est-pie">{datos.map(({ p }) => <span key={p.id}>{iniciales(p.nombre)}</span>)}</div>
      </div>
      <div className="est-graf">
        <h2 className="h">Carga por personaje</h2>
        <span className="s">kg llevados sobre su máximo</span>
        <div className="est-columnas">
          {datos.map(({ p, r, max }) => {
            const color = tramoCarga(r.pesoKg, max).color;
            return (
              <div key={p.id} title={`${p.nombre}: ${fmtKg(r.pesoKg)} de ${max} kg`}>
                <span style={{ color }}>{fmtKg(r.pesoKg)} / {max}</span>
                <div className="est-tubo">
                  <div style={{ height: `${Math.min(100, (r.pesoKg / max) * 100)}%`, background: `linear-gradient(180deg, ${color}, ${color}66)` }} />
                  <span aria-hidden="true" style={{ bottom: '33.3%' }} />
                  <span aria-hidden="true" style={{ bottom: '66.6%' }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="est-pie">{datos.map(({ p }) => <span key={p.id}>{iniciales(p.nombre)}</span>)}</div>
      </div>
    </section>
  );
}
