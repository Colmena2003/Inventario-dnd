// Estadísticas de la party, en cuatro vistas que no repiten lo que ya enseñan otras pantallas:
//  · Resumen: una tarjeta por personaje, el hexágono de características y el combate comparado.
//  · ¿Quién tira?: quién tiene el mejor bono en cada habilidad, salvación y pasiva (para decidir en la mesa).
//  · Equipo y riqueza: valor del equipo, objetos mágicos, sintonización y lo que se os puede estar olvidando.
//  · Desglose: de dónde sale cada número de un personaje y qué objeto aporta cada cosa.

import { useState, type CSSProperties, type ReactNode } from 'react';
import { ABREV_CAR, CARACTERISTICAS, HABILIDADES, MOVIMIENTOS } from '../domain/catalogo';
import { describirMod } from '../domain/describir';
import { objetoActivo } from '../domain/efectos';
import { hoja, type AtaqueArma, type Hoja, type Valor } from '../domain/hoja';
import { CLASE_RAREZA, COLOR_RAREZA, conSigno, fmtKg, fmtNum, MAX_SINTONIZADOS, objetosDe, SACIEDAD_MAX, sintonizadosDe } from '../domain/reglas';
import type { Caracteristica, Objeto, Rareza } from '../domain/tipos';
import { useCofre } from '../store/cofre';
import { ClasesConIcono } from './clases';
import { useDetalle } from './DetalleObjeto';
import { claseCambio, desglose, tituloAtaque } from './desglose';
import { useEditor } from './editorCtx';
import { ICONOS, UI } from './iconos';
import { Esquinas, iniciales, Icono } from './piezas';

type Vista = 'resumen' | 'quien' | 'equipo' | 'desglose';

const VISTAS: { id: Vista; texto: string; icono: string; ayuda: string }[] = [
  { id: 'resumen', texto: 'Resumen', icono: 'M12 3l8 4.6v8.8L12 21l-8-4.6V7.6zM12 8l4 2.3v4.4L12 17l-4-2.3v-4.4z', ayuda: 'Tarjetas, características y combate comparado' },
  { id: 'quien', texto: '¿Quién tira?', icono: 'M12 3l8 5v8l-8 5-8-5V8zM12 3v18M4 8l16 8M20 8L4 16', ayuda: 'El mejor bono de la party en cada prueba' },
  { id: 'equipo', texto: 'Equipo y riqueza', icono: UI.cofre, ayuda: 'Valor del equipo, objetos mágicos y sintonización' },
  { id: 'desglose', texto: 'Desglose', icono: UI.lupa, ayuda: 'De dónde sale cada número de un personaje' },
];

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const m = (n: number) => fmtKg(n).replace(',0', '');
const corto = (nombre: string) => nombre.split(' ')[0];

export function Estadisticas() {
  const { estado } = useCofre();
  const hojas = estado.personajes.map((p) => hoja(estado, p));
  const [elegido, setElegido] = useState(hojas[0]?.p.id);
  const [vista, setVista] = useState<Vista>('resumen');
  const h = hojas.find((x) => x.p.id === elegido) ?? hojas[0];
  if (!h) {
    return (
      <main className="estadisticas">
        <div className="bib-vacia"><h2>Aún no hay personajes</h2><p>Añade uno con el botón + de la barra de retratos.</p></div>
      </main>
    );
  }
  const verDesglose = (id: string) => { setElegido(id); setVista('desglose'); };
  return (
    <main className="estadisticas">
      <nav className="est-vistas" aria-label="Vistas de estadísticas">
        {VISTAS.map((v) => (
          <button key={v.id} type="button" className={`est-vista ${vista === v.id ? 'on' : ''}`} aria-pressed={vista === v.id} title={v.ayuda} onClick={() => setVista(v.id)}>
            <Icono d={v.icono} />{v.texto}
          </button>
        ))}
        {vista === 'desglose' && (
          <div className="est-quien" role="group" aria-label="Personaje">
            {hojas.map((x) => (
              <button key={x.p.id} type="button" className={`chip ${x.p.id === h.p.id ? 'on' : ''}`} style={{ borderColor: x.p.id === h.p.id ? x.p.color : undefined }} aria-pressed={x.p.id === h.p.id} onClick={() => setElegido(x.p.id)}>
                <span className="punto" style={{ background: x.p.color }} />{x.p.nombre}
              </button>
            ))}
          </div>
        )}
      </nav>
      {vista === 'resumen' && <Resumen hojas={hojas} onElegir={verDesglose} />}
      {vista === 'quien' && <QuienTira hojas={hojas} />}
      {vista === 'equipo' && <EquipoRiqueza hojas={hojas} />}
      {vista === 'desglose' && <Detalle h={h} />}
    </main>
  );
}

function Num({ v, signo, titulo }: { v: Valor; signo?: boolean; titulo?: string }) {
  return (
    <b className={`${claseCambio(v)} ${v.desv?.length ? 'desv' : ''}`} title={titulo ?? desglose(v)}>
      {signo ? conSigno(v.total) : v.total}
    </b>
  );
}

function Panel({ titulo, ayuda, className = '', children }: { titulo: string; ayuda?: string; className?: string; children: ReactNode }) {
  return (
    <section className={`panel est-panel ${className}`}>
      <Esquinas />
      <header className="est-panel-cab"><h2>{titulo}</h2>{ayuda && <span>{ayuda}</span>}</header>
      {children}
    </section>
  );
}

// ── Resumen ────────────────────────────────────────────────────────

function Resumen({ hojas, onElegir }: { hojas: Hoja[]; onElegir: (id: string) => void }) {
  return (
    <div className="est-resumen">
      <div className="est-tarjetas" style={{ gridTemplateColumns: `repeat(${Math.max(hojas.length, 2)}, minmax(0, 1fr))` }}>
        {hojas.map((x) => <Tarjeta key={x.p.id} h={x} onElegir={() => onElegir(x.p.id)} />)}
      </div>
      <div className="est-graficos">
        <Panel titulo="Características" ayuda="Pulsa un nombre para ocultarlo">
          <Hexagono hojas={hojas} />
        </Panel>
        <Panel titulo="Combate comparado" ayuda="La barra más larga es la mejor de la party">
          <Comparativa hojas={hojas} />
        </Panel>
      </div>
    </div>
  );
}

const mejorAtaque = (h: Hoja): AtaqueArma | undefined =>
  h.ataques.filter((a) => a.valido && a.indice === 0).sort((a, b) => dañoMedio(b) - dañoMedio(a))[0];

/** Daño medio de un golpe: media de los dados («2d6» → 7) más el modificador y los dados extra. */
function dañoMedio(a: AtaqueArma): number {
  const dados = (expr: string) => {
    const r = /(\d*)d(\d+)/.exec(expr);
    return r ? Number(r[1] || 1) * (Number(r[2]) + 1) / 2 : Number(expr) || 0;
  };
  return dados(a.dado) + a.danoMod.total + a.extras.reduce((s, x) => s + dados(x.dado), 0);
}

function Tarjeta({ h, onElegir }: { h: Hoja; onElegir: () => void }) {
  const p = h.p;
  const atq = (r: 'cuerpoACuerpo' | 'distancia') => h.ataques.find((a) => a.ranura === r && a.indice === 0);
  const fila = (t: string, r: 'cuerpoACuerpo' | 'distancia') => {
    const a = atq(r);
    return (
      <div className="est-fila" title={a ? tituloAtaque(a) : undefined}>
        <span>{t}</span>
        <span>{a ? <><b className={a.bono.desv?.length ? 'desv' : ''}>{conSigno(a.bono.total)}</b> · {a.dano}{a.extras.length ? ` +${a.extras.map((x) => x.dado).join('+')}` : ''}</> : '—'}</span>
      </div>
    );
  };
  return (
    <button type="button" className="panel est-tarjeta" style={{ '--pj': p.color } as CSSProperties} onClick={onElegir} title="Ver el desglose completo">
      <Esquinas />
      <header>
        <span className="est-ini">{p.imagenUrl ? <img src={p.imagenUrl} alt="" /> : iniciales(p.nombre)}</span>
        <span className="est-nombre"><b>{p.nombre}</b><span>{p.raza} · <ClasesConIcono clases={p.clases} tam={14} /></span></span>
        <span className="est-ca" title={desglose(h.ca)}><span>CA</span><Num v={h.ca} titulo={desglose(h.ca)} /></span>
      </header>
      <div className="est-pv" title={desglose(h.pvMax)}>
        <span className="k">PV</span>
        <span><b>{h.pvActual}</b> / <Num v={h.pvMax} /></span>
        <div><div style={{ width: `${Math.min(100, (h.pvActual / h.pvMax.total) * 100)}%` }} /></div>
      </div>
      <div className="est-cars">
        {CARACTERISTICAS.map(([k, a]) => (
          <div key={k} title={desglose(h.car[k])}>
            <span>{a}</span>
            <b className={claseCambio(h.car[k])}>{h.car[k].total}</b>
            <span>{conSigno(h.mod[k])}</span>
          </div>
        ))}
      </div>
      {fila('Cuerpo a cuerpo', 'cuerpoACuerpo')}
      {fila('A distancia', 'distancia')}
      <div className="est-fila"><span>Iniciativa · Velocidad</span><span><Num v={h.iniciativa} signo /> · <b title={desglose(h.velocidad.caminar)} className={claseCambio(h.velocidad.caminar)}>{m(h.velocidad.caminar.total)} pies</b></span></div>
      {h.conjuros && <div className="est-fila"><span>Conjuros · CD / ataque</span><span><Num v={h.conjuros.cd} /> / <Num v={h.conjuros.ataque} signo /></span></div>}
      <div className="est-fila">
        <span>Estado</span>
        <span className="txt" style={{ color: h.saciedad.efectos.length || h.tramo.id !== 'normal' ? '#f0b07a' : undefined }}>
          {[`${h.saciedad.texto} ${p.saciedad}/${SACIEDAD_MAX}`, h.tramo.id !== 'normal' ? h.tramo.texto.split(' ·')[0] : '', p.efectos?.length ? `${p.efectos.length} efecto${p.efectos.length > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')}
        </span>
      </div>
    </button>
  );
}

/** Hexágono de las seis características: un polígono por personaje. */
function Hexagono({ hojas }: { hojas: Hoja[] }) {
  const [ocultos, setOcultos] = useState<string[]>([]);
  const visibles = hojas.filter((h) => !ocultos.includes(h.p.id));
  const tope = Math.max(20, ...hojas.flatMap((h) => CARACTERISTICAS.map(([k]) => h.car[k].total)));
  const C = 210, R = 160;
  const punto = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    const r = (Math.max(0, v) / tope) * R;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  };
  const anillo = (v: number) => CARACTERISTICAS.map((_, i) => punto(i, v).join(',')).join(' ');
  return (
    <div className="est-hex">
      <svg viewBox="0 0 420 420" role="img" aria-label="Hexágono de características de la party">
        {[5, 10, 15, 20, 25, 30].filter((v) => v <= tope).map((v) => (
          <polygon key={v} points={anillo(v)} fill="none" stroke={v === 10 ? '#5e4c2c' : '#2c2419'} strokeDasharray={v === 10 ? '4 4' : undefined} />
        ))}
        {CARACTERISTICAS.map((_, i) => { const [x, y] = punto(i, tope); return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke="#2c2419" />; })}
        {visibles.map((h) => (
          <g key={h.p.id}>
            <polygon points={CARACTERISTICAS.map(([k], i) => punto(i, h.car[k].total).join(',')).join(' ')} fill={h.p.color} fillOpacity=".16" stroke={h.p.color} strokeWidth="2.2" strokeLinejoin="round" />
            {CARACTERISTICAS.map(([k, a], i) => {
              const [x, y] = punto(i, h.car[k].total);
              return <circle key={k} cx={x} cy={y} r="4.5" fill={h.p.color} stroke="#0d0b09" strokeWidth="1.5"><title>{`${h.p.nombre} · ${a} ${h.car[k].total} (${conSigno(h.mod[k])})`}</title></circle>;
            })}
          </g>
        ))}
        {CARACTERISTICAS.map(([k, a], i) => {
          const [x, y] = punto(i, tope * 1.17);
          const mejor = visibles.length ? Math.max(...visibles.map((h) => h.car[k].total)) : 0;
          return (
            <g key={k}>
              <text x={x} y={y - 4} textAnchor="middle" className="hex-eje">{a}</text>
              {visibles.length > 0 && <text x={x} y={y + 14} textAnchor="middle" className="hex-max">máx. {mejor}</text>}
            </g>
          );
        })}
        <text x={C + 4} y={C - (10 / tope) * R - 4} className="hex-ref">10</text>
      </svg>
      <ul className="est-leyenda-hex">
        {hojas.map((h) => {
          const off = ocultos.includes(h.p.id);
          const fuerte = CARACTERISTICAS.reduce((a, [k]) => (h.car[k].total > h.car[a].total ? k : a), 'fue' as Caracteristica);
          return (
            <li key={h.p.id}>
              <button type="button" className={`leg ${off ? 'off' : ''}`} aria-pressed={!off} onClick={() => setOcultos((o) => (off ? o.filter((x) => x !== h.p.id) : [...o, h.p.id]))}>
                <span className="punto" style={{ background: h.p.color }} />
                <span><b>{h.p.nombre}</b><small>Mejor: {ABREV_CAR[fuerte]} {h.car[fuerte].total}</small></span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Barras por estadística de combate, una por personaje; la mejor, resaltada. */
function Comparativa({ hojas }: { hojas: Hoja[] }) {
  const filas: { t: string; v: (h: Hoja) => number | null; fmt?: (n: number) => string; titulo?: (h: Hoja) => string }[] = [
    { t: 'Clase de armadura', v: (h) => h.ca.total, titulo: (h) => desglose(h.ca) },
    { t: 'PV máximos', v: (h) => h.pvMax.total, titulo: (h) => desglose(h.pvMax) },
    { t: 'Mejor ataque (bono)', v: (h) => mejorAtaque(h)?.bono.total ?? null, fmt: conSigno, titulo: (h) => { const a = mejorAtaque(h); return a ? `${a.objeto.nombre}: ${tituloAtaque(a)}` : 'Sin arma'; } },
    { t: 'Daño medio por golpe', v: (h) => { const a = mejorAtaque(h); return a ? Math.round(dañoMedio(a) * 10) / 10 : null; }, fmt: (n) => fmtNum(n), titulo: (h) => { const a = mejorAtaque(h); return a ? `${a.objeto.nombre}: ${a.dano}` : 'Sin arma'; } },
    { t: 'Iniciativa', v: (h) => h.iniciativa.total, fmt: conSigno, titulo: (h) => desglose(h.iniciativa) },
    { t: 'Percepción pasiva', v: (h) => h.pasivas.percepcion.total, titulo: (h) => desglose(h.pasivas.percepcion) },
    { t: 'Velocidad', v: (h) => h.velocidad.caminar.total, fmt: (n) => `${m(n)} pies`, titulo: (h) => desglose(h.velocidad.caminar) },
    { t: 'CD de conjuros', v: (h) => h.conjuros?.cd.total ?? null, titulo: (h) => (h.conjuros ? desglose(h.conjuros.cd) : 'No lanza conjuros') },
  ];
  return (
    <div className="est-comparativa">
      {filas.map((f) => {
        const valores = hojas.map((h) => f.v(h));
        const numeros = valores.filter((x): x is number => x !== null);
        if (!numeros.length) return null;
        const max = Math.max(...numeros), min = Math.min(0, ...numeros);
        return (
          <div key={f.t} className="cmp-fila">
            <span className="cmp-t">{f.t}</span>
            <div className="cmp-barras">
              {hojas.map((h, i) => {
                const v = valores[i];
                const ancho = v === null ? 0 : max === min ? 100 : ((v - min) / (max - min)) * 88 + 12;
                return (
                  <div key={h.p.id} className={`cmp-barra ${v !== null && v === max ? 'mejor' : ''}`} title={`${h.p.nombre}: ${f.titulo?.(h) ?? ''}`}>
                    <span className="cmp-quien">{corto(h.p.nombre)}</span>
                    <span className="cmp-pista"><span style={{ width: `${ancho}%`, background: h.p.color }} /></span>
                    <b>{v === null ? '—' : f.fmt ? f.fmt(v) : v}</b>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ¿Quién tira? ───────────────────────────────────────────────────

function TablaBonos({ hojas, filas }: { hojas: Hoja[]; filas: { k: string; t: ReactNode; v: (h: Hoja) => Valor; comp?: (h: Hoja) => 0 | 1 | 2 }[] }) {
  return (
    <table className="est-tabla">
      <thead>
        <tr><th />{hojas.map((h) => <th key={h.p.id} style={{ color: h.p.color }}>{corto(h.p.nombre)}</th>)}</tr>
      </thead>
      <tbody>
        {filas.map((f) => {
          const vs = hojas.map((h) => f.v(h));
          const mejor = Math.max(...vs.map((v) => v.total));
          return (
            <tr key={f.k}>
              <th scope="row">{f.t}</th>
              {hojas.map((h, i) => {
                const v = vs[i], c = f.comp?.(h) ?? 0;
                return (
                  <td key={h.p.id} className={v.total === mejor ? 'mejor' : ''} title={desglose(v)}>
                    {c > 0 && <i className={`comp ${c === 2 ? 'doble' : 'on'}`} />}
                    <b className={`${claseCambio(v)} ${v.desv?.length ? 'desv' : ''}`}>{conSigno(v.total)}</b>
                    {v.vent?.length ? <small className="vent" title={v.vent.join(', ')}>V</small> : null}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function QuienTira({ hojas }: { hojas: Hoja[] }) {
  const habilidades = HABILIDADES.map(([k, n, c]) => ({
    k, t: <>{n} <small>{ABREV_CAR[c]}</small></>, v: (h: Hoja) => h.habilidades[k],
    comp: (h: Hoja) => (h.habilidades[k].pericia ? 2 : h.habilidades[k].competente ? 1 : 0) as 0 | 1 | 2,
  }));
  const salvaciones = CARACTERISTICAS.map(([k, , n]) => ({ k, t: n, v: (h: Hoja) => h.salvaciones[k], comp: (h: Hoja) => (h.salvaciones[k].competente ? 1 : 0) as 0 | 1 }));
  const pasivas = (['percepcion', 'investigacion', 'perspicacia'] as const).map((k) => ({ k, t: `${capital(k === 'percepcion' ? 'percepción' : k === 'investigacion' ? 'investigación' : k)} pasiva`, v: (h: Hoja) => h.pasivas[k] }));
  return (
    <div className="est-quien-tira">
      <Panel titulo="Habilidades" ayuda="En dorado, el mejor bono de la party · ● competente · ●● pericia · V ventaja · ondulado: desventaja" className="ancho">
        <div className="est-tabla-scroll"><TablaBonos hojas={hojas} filas={habilidades} /></div>
      </Panel>
      <div className="est-col">
        <Panel titulo="Salvaciones" ayuda="Quién aguanta mejor cada salvación">
          <TablaBonos hojas={hojas} filas={salvaciones} />
        </Panel>
        <Panel titulo="Pasivas e iniciativa" ayuda="Lo que el DM mira sin preguntar">
          <TablaBonos hojas={hojas} filas={[...pasivas, { k: 'ini', t: 'Iniciativa', v: (h) => h.iniciativa }]} />
        </Panel>
      </div>
    </div>
  );
}

// ── Equipo y riqueza ──────────────────────────────────────────────

const ORDEN_RAREZA: Rareza[] = ['común', 'poco común', 'raro', 'muy raro', 'legendario', 'artefacto'];
const esMagico = (o: Objeto) => o.rareza !== 'común' || !!o.bonoMagico || !!o.modificadores?.length || !!o.requiereSintonizacion;

/** Motivo por el que un objeto mágico de alguien no le está haciendo efecto, o null si funciona. */
function olvido(o: Objeto): string | null {
  if (o.propietario.tipo !== 'personaje' || objetoActivo(o) || !(o.modificadores?.length || o.bonoMagico)) return null;
  if (o.requiereSintonizacion && !o.sintonizado) return 'sin sintonizar';
  if (o.ranuraEquipo && !o.equipadoEn) return 'sin equipar';
  return null;
}

function EquipoRiqueza({ hojas }: { hojas: Hoja[] }) {
  const { estado } = useCofre();
  const detalle = useDetalle();
  const duenos = [...hojas.map((h) => ({ id: h.p.id, nombre: h.p.nombre, color: h.p.color, objetos: objetosDe(estado, { tipo: 'personaje', id: h.p.id }), sint: sintonizadosDe(estado, h.p.id) })),
    { id: 'alijo', nombre: 'Alijo', color: '#b89a55', objetos: objetosDe(estado, { tipo: 'alijo' }), sint: [] as Objeto[] }];
  const valor = (l: Objeto[]) => l.reduce((s, o) => s + o.valorPo * o.cantidad, 0);
  const maxValor = Math.max(1, ...duenos.map((d) => valor(d.objetos)));
  const todos = estado.objetos;
  const valiosos = [...todos].sort((a, b) => b.valorPo - a.valorPo).slice(0, 8);
  const olvidos = todos.map((o) => ({ o, motivo: olvido(o) })).filter((x) => x.motivo);
  const cargas = todos.filter((o) => o.cargasMax && (o.cargas ?? 0) < o.cargasMax);
  const ver = (o: Objeto) => detalle.verObjeto(o);
  const linea = (o: Objeto, extra: ReactNode) => (
    <li key={o.id}>
      <button type="button" className={`enlace-obj ${CLASE_RAREZA[o.rareza]}`} onClick={() => ver(o)}>
        <span className="mini-ic">{o.imagenUrl ? <img src={o.imagenUrl} alt="" /> : <Icono d={ICONOS[o.icono]} />}</span>
        <b>{o.nombre}</b>
      </button>
      <span>{extra}</span>
    </li>
  );

  return (
    <div className="est-equipo">
      <Panel titulo="Valor del equipo" ayuda="En piezas de oro, lo equipado incluido · no cuenta las monedas" className="ancho">
        <div className="eq-filas">
          {duenos.map((d) => {
            const v = valor(d.objetos);
            const rarezas = ORDEN_RAREZA.map((r) => ({ r, n: d.objetos.filter((o) => o.rareza === r).reduce((s, o) => s + o.cantidad, 0) })).filter((x) => x.n);
            const total = rarezas.reduce((s, x) => s + x.n, 0);
            return (
              <div key={d.id} className="eq-fila">
                <span className="eq-quien"><span className="punto" style={{ background: d.color }} />{d.nombre}</span>
                <span className="cmp-pista grande"><span style={{ width: `${(v / maxValor) * 100}%`, background: d.color }} /></span>
                <b className="eq-valor">{fmtNum(Math.round(v))} PO</b>
                <span className="eq-rarezas" title={rarezas.map((x) => `${x.n} ${x.r}`).join(' · ')}>
                  {rarezas.map((x) => <span key={x.r} style={{ flex: x.n / total, background: COLOR_RAREZA[x.r] }} />)}
                </span>
                <span className="eq-datos">
                  {d.objetos.length} objetos · {d.objetos.filter(esMagico).length} mágicos
                  {d.id !== 'alijo' && <> · sintonía <b>{d.sint.length}/{MAX_SINTONIZADOS}</b></>}
                </span>
              </div>
            );
          })}
        </div>
        <div className="eq-leyenda" aria-label="Colores de rareza">
          <span>Barra fina: objetos por rareza</span>
          {ORDEN_RAREZA.map((r) => <span key={r}><i style={{ background: COLOR_RAREZA[r] }} />{capital(r)}</span>)}
        </div>
      </Panel>
      <div className="est-col">
        <Panel titulo="Lo más valioso" ayuda="Pulsa uno para ver su ficha">
          <ul className="influyen">
            {valiosos.map((o) => linea(o, <>{fmtNum(o.valorPo)} PO · {o.propietario.tipo === 'alijo' ? 'Alijo' : corto(estado.personajes.find((p) => p.id === (o.propietario as { id: string }).id)?.nombre ?? '')}</>))}
            {!valiosos.length && <li className="vacio">No hay objetos.</li>}
          </ul>
        </Panel>
        <Panel titulo="¿Se os olvida algo?" ayuda="Magia que no está haciendo efecto y cargas gastadas">
          <ul className="influyen">
            {olvidos.map(({ o, motivo }) => linea(o, <span className="aviso-olvido">{corto(estado.personajes.find((p) => p.id === (o.propietario as { id: string }).id)?.nombre ?? '')} lo tiene {motivo}</span>))}
            {cargas.map((o) => linea(o, <>{o.cargas ?? 0}/{o.cargasMax} cargas{o.recarga ? ` · ${o.recarga.toLowerCase()}` : ''}</>))}
            {!olvidos.length && !cargas.length && <li className="vacio">Todo en orden: la magia hace efecto y las cargas están llenas.</li>}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

// ── Desglose del personaje elegido ────────────────────────────────

function Detalle({ h }: { h: Hoja }) {
  const { estado } = useCofre();
  const editor = useEditor();
  const conMods = objetosDe(estado, { tipo: 'personaje', id: h.p.id }).filter((o) => o.modificadores?.length || o.armadura || o.bonoCa || (o.dado && o.equipadoEn));
  const activos = conMods.filter(objetoActivo);
  const inactivos = conMods.filter((o) => !objetoActivo(o));
  const efectos = [
    ...h.inmunidades.map((x) => ({ ...x, t: 'Inmune' })), ...h.vulnerabilidades.map((x) => ({ ...x, t: 'Vulnerable' })),
    ...h.inmuneCondiciones.map((x) => ({ ...x, t: 'Inmune a' })), ...h.ventajas.map((x) => ({ ...x, t: 'Ventaja' })),
    ...h.desventajas.map((x) => ({ ...x, t: 'Desventaja' })), ...h.notas.map((x) => ({ ...x, t: 'Efecto' })),
  ];

  return (
    <section className="panel est-detalle" aria-label={`Desglose de ${h.p.nombre}`}>
      <Esquinas />
      <div className="col">
        <h3 className="sec">Salvaciones</h3>
        {CARACTERISTICAS.map(([k, , n]) => (
          <div key={k} className="est-fila">
            <span><i className={h.salvaciones[k].competente ? 'comp on' : 'comp'} />{n}</span><Num v={h.salvaciones[k]} signo />
          </div>
        ))}
        <h3 className="sec">Pasivas y más</h3>
        <div className="est-fila"><span>Percepción pasiva</span><Num v={h.pasivas.percepcion} /></div>
        <div className="est-fila"><span>Investigación pasiva</span><Num v={h.pasivas.investigacion} /></div>
        <div className="est-fila"><span>Perspicacia pasiva</span><Num v={h.pasivas.perspicacia} /></div>
        <div className="est-fila"><span>Competencia</span><Num v={h.competencia} signo /></div>
        <div className="est-fila"><span>Carga máxima</span><b>{h.cargaMax} kg</b></div>
      </div>

      <div className="col ancha">
        <h3 className="sec">Habilidades</h3>
        <div className="habs">
          {HABILIDADES.map(([k, n, c]) => {
            const v = h.habilidades[k];
            return (
              <div key={k} className="est-fila">
                <span><i className={v.pericia ? 'comp doble' : v.competente ? 'comp on' : 'comp'} />{n} <small>{ABREV_CAR[c]}</small></span>
                <span>{v.vent?.length ? <small className="vent" title={v.vent.join(', ')}>V</small> : null}<Num v={v} signo /></span>
              </div>
            );
          })}
        </div>
        <span className="leyenda-comp"><i className="comp on" />Competente <i className="comp doble" />Pericia · <span className="sube">verde</span>: lo suben los objetos · <span className="desv">ondulado</span>: con desventaja</span>
      </div>

      <div className="col">
        <h3 className="sec">Defensa y movimiento</h3>
        <div className="est-fila"><span>CA</span><Num v={h.ca} /></div>
        <p className="desglose">{desglose(h.ca)}</p>
        <div className="est-fila"><span>PV máximos</span><Num v={h.pvMax} /></div>
        {MOVIMIENTOS.filter(([k]) => h.velocidad[k].total > 0).map(([k, n]) => (
          <div key={k} className="est-fila"><span>Velocidad · {n.toLowerCase()}</span><b className={claseCambio(h.velocidad[k])} title={desglose(h.velocidad[k])}>{m(h.velocidad[k].total)} pies</b></div>
        ))}
        {h.sentidos.map((s) => <div key={s.nombre} className="est-fila" title={s.origen}><span>{s.nombre}</span><b>{m(s.metros)} m</b></div>)}
        <div className="est-fila"><span>Resistencias</span><span className="txt">{h.resistencias.map((r) => r.texto).join(', ') || '—'}</span></div>
        {efectos.length > 0 && (
          <ul className="efectos">
            {efectos.map((x, i) => <li key={i} title={x.origen}><b>{x.t}:</b> {x.texto} <small>· {x.origen}</small></li>)}
          </ul>
        )}
        {h.avisos.map((a) => <p key={a} className="aviso-hoja">{a}</p>)}
      </div>

      <div className="col">
        <h3 className="sec">Objetos que influyen</h3>
        <ul className="influyen">
          {activos.map((o) => <ObjetoInfluye key={o.id} o={o} onEditar={() => editor.editar(o)} />)}
          {inactivos.map((o) => <ObjetoInfluye key={o.id} o={o} inactivo onEditar={() => editor.editar(o)} />)}
          {!conMods.length && <li className="vacio">Ningún objeto cambia sus estadísticas.</li>}
        </ul>
      </div>
    </section>
  );
}

function ObjetoInfluye({ o, inactivo, onEditar }: { o: Objeto; inactivo?: boolean; onEditar: () => void }) {
  const lineas = [
    o.armadura && o.armadura.tipo !== 'ropa' ? `Armadura ${o.armadura.tipo} · CA ${o.armadura.caBase}` : '',
    o.bonoCa ? `+${o.bonoCa} CA (escudo)` : '',
    o.bonoMagico ? `+${o.bonoMagico} mágico` : '',
    ...(o.modificadores ?? []).map(describirMod),
  ].filter(Boolean);
  const motivo = o.requiereSintonizacion && !o.sintonizado ? 'sin sintonizar' : o.ranuraEquipo && !o.equipadoEn ? 'sin equipar' : 'no hace efecto así';
  return (
    <li className={`${CLASE_RAREZA[o.rareza]} ${inactivo ? 'inactivo' : ''}`}>
      <button type="button" className="enlace-obj" onClick={onEditar} title="Editar objeto">
        <span className="mini-ic">{o.imagenUrl ? <img src={o.imagenUrl} alt="" /> : <Icono d={ICONOS[o.icono]} />}</span>
        <b>{o.nombre}</b>{inactivo && <small> · {motivo}</small>}
      </button>
      {lineas.length > 0 && <span>{lineas.map(capital).join(' · ')}</span>}
    </li>
  );
}
