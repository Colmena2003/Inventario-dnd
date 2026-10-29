// Pantalla 12 del diseño, centrada en la hoja derivada: cada tarjeta enseña los valores con los objetos
// aplicados, y el panel de abajo desglosa los del personaje elegido y qué objeto aporta cada cosa.

import { useState, type CSSProperties } from 'react';
import { ABREV_CAR, CARACTERISTICAS, HABILIDADES, MOVIMIENTOS } from '../domain/catalogo';
import { describirMod } from '../domain/describir';
import { objetoActivo } from '../domain/efectos';
import { hoja, type Hoja, type Valor } from '../domain/hoja';
import { CLASE_RAREZA, conSigno, fmtKg, objetosDe, SACIEDAD_MAX } from '../domain/reglas';
import type { Objeto } from '../domain/tipos';
import { useCofre } from '../store/cofre';
import { claseCambio, desglose, tituloAtaque } from './desglose';
import { useEditor } from './editorCtx';
import { ICONOS } from './iconos';
import { Esquinas, iniciales, Icono } from './piezas';

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const m = (n: number) => fmtKg(n).replace(',0', '');

export function Estadisticas() {
  const { estado } = useCofre();
  const hojas = estado.personajes.map((p) => hoja(estado, p));
  const [elegido, setElegido] = useState(hojas[0]?.p.id);
  const h = hojas.find((x) => x.p.id === elegido) ?? hojas[0];
  if (!h) return null;
  return (
    <main className="estadisticas">
      <div className="est-tarjetas" style={{ gridTemplateColumns: `repeat(${hojas.length}, 1fr)` }}>
        {hojas.map((x) => <Tarjeta key={x.p.id} h={x} activa={x.p.id === h.p.id} onElegir={() => setElegido(x.p.id)} />)}
      </div>
      <Detalle h={h} />
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

function Tarjeta({ h, activa, onElegir }: { h: Hoja; activa: boolean; onElegir: () => void }) {
  const p = h.p;
  const clases = p.clases.map((c) => `${c.clase} ${c.nivel}`).join(' / ');
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
    <button type="button" className={`panel est-tarjeta ${activa ? 'on' : ''}`} style={{ '--pj': p.color } as CSSProperties} aria-pressed={activa} onClick={onElegir}>
      <Esquinas />
      <header>
        <span className="est-ini">{p.imagenUrl ? <img src={p.imagenUrl} alt="" /> : iniciales(p.nombre)}</span>
        <span className="est-nombre"><b>{p.nombre}</b><span>{p.raza} · {clases}</span></span>
        <span className="est-ca" title={desglose(h.ca)}><span>CA</span><Num v={h.ca} titulo={desglose(h.ca)} /></span>
      </header>
      <div className="est-pv" title={desglose(h.pvMax)}>
        <span className="k">PV</span>
        <span><b>{h.pvActual}</b> / <Num v={h.pvMax} /></span>
        <div><div style={{ width: `${(h.pvActual / h.pvMax.total) * 100}%` }} /></div>
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
      <h3 className="sec">Combate</h3>
      {fila('Cuerpo a cuerpo', 'cuerpoACuerpo')}
      {fila('A distancia', 'distancia')}
      <div className="est-fila"><span>Iniciativa · Velocidad</span><span><Num v={h.iniciativa} signo /> · <b title={desglose(h.velocidad.caminar)} className={claseCambio(h.velocidad.caminar)}>{m(h.velocidad.caminar.total)} m</b></span></div>
      <div className="est-fila"><span>Percepción pasiva</span><span><Num v={h.pasivas.percepcion} /></span></div>
      {h.conjuros && <div className="est-fila"><span>Conjuros · CD / ataque</span><span><Num v={h.conjuros.cd} /> / <Num v={h.conjuros.ataque} signo /></span></div>}
      <div className="est-fila"><span>Resistencias</span><span className="txt">{h.resistencias.map((r) => r.texto).join(', ') || '—'}</span></div>
      <div className="est-fila">
        <span>Saciedad</span>
        <span className="txt" style={{ color: h.saciedad.color }}>{h.saciedad.texto} {p.saciedad}/{SACIEDAD_MAX}{h.tramo.id !== 'normal' ? ` · ${h.tramo.texto.split(' ·')[0]}` : ''}</span>
      </div>
    </button>
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
          <div key={k} className="est-fila"><span>Velocidad · {n.toLowerCase()}</span><b className={claseCambio(h.velocidad[k])} title={desglose(h.velocidad[k])}>{m(h.velocidad[k].total)} m</b></div>
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
