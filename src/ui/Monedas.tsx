// Pantalla 9 del diseño: tesoro común, monedas por personaje, repartir botín y carga.

import { useState } from 'react';
import {
  aplicarMonedas, cambio, CERO, CLAVES, cuantas, escalar, NOMBRE_MONEDA, repartir, sumar, texto, vacia, VALOR_PC,
  type Cambio, type ClaveMoneda,
} from '../domain/monedas';
import { cargaMaxDe, fmtKg, pesoAlijoKg, pesoPersonajeKg, totalEnPo, tramoCarga } from '../domain/reglas';
import type { Monedas as TMonedas, Personaje } from '../domain/tipos';
import { useCofre } from '../store/cofre';
import { Capa } from './Capa';
import { useEscape } from './Dialogos';
import { UI } from './iconos';
import { Esquinas, fmtNum, Icono, iniciales, Moneda, MONEDAS } from './piezas';

type Avisar = (texto: string, error?: boolean) => void;

const MONEDA: Record<ClaveMoneda, (typeof MONEDAS)[number]> = Object.fromEntries(MONEDAS.map((m) => [m.k, m])) as never;
const EQUIVALE: Record<ClaveMoneda, string> = { ppt: '= 10 PO', po: '= 1 PO', pe: '= ½ PO', pp: '= 1/10 PO', pc: '= 1/100 PO' };
const fmtPo = (n: number) => fmtKg(n); // un decimal, con separador de miles
const solo = (k: ClaveMoneda, n: number): TMonedas => ({ ...CERO, [k]: n });

export function PantallaMonedas({ avisar }: { avisar: Avisar }) {
  const [dialogo, setDialogo] = useState<null | { tipo: 'cambiar' } | { tipo: 'historial' } | { tipo: 'ajuste'; p: Personaje; modo: 'ingresar' | 'retirar' }>(null);
  return (
    <div className="monedas">
      <Tesoro avisar={avisar} onCambiar={() => setDialogo({ tipo: 'cambiar' })} onHistorial={() => setDialogo({ tipo: 'historial' })} />
      <PorPersonaje onAjuste={(p, modo) => setDialogo({ tipo: 'ajuste', p, modo })} />
      <Botin avisar={avisar} />
      <Carga />
      {dialogo?.tipo === 'cambiar' && <CambiarMonedas avisar={avisar} onCerrar={() => setDialogo(null)} />}
      {dialogo?.tipo === 'historial' && <Historial onCerrar={() => setDialogo(null)} />}
      {dialogo?.tipo === 'ajuste' && <AjustePersonaje p={dialogo.p} modo={dialogo.modo} avisar={avisar} onCerrar={() => setDialogo(null)} />}
    </div>
  );
}

function Mini({ etiqueta, d, onClick, disabled }: { etiqueta: string; d: string; onClick: (e: React.MouseEvent) => void; disabled?: boolean }) {
  return (
    <button type="button" className="mini" aria-label={etiqueta} title={etiqueta} onClick={onClick} disabled={disabled}>
      <Icono d={d} />
    </button>
  );
}

// ── Tesoro común ───────────────────────────────────────────────────

function Tesoro({ avisar, onCambiar, onHistorial }: { avisar: Avisar; onCambiar: () => void; onHistorial: () => void }) {
  const { estado, monedas } = useCofre();
  const t = estado.party.tesoro;
  const ajustar = (k: ClaveMoneda, n: number) => {
    const r = monedas([{ bolsa: 'tesoro', delta: solo(k, n) }], `${n > 0 ? 'Ingresó' : 'Retiró'} ${Math.abs(n)} ${k.toUpperCase()} ${n > 0 ? 'en' : 'del'} el tesoro común`);
    if (!r.ok) avisar(r.motivo, true);
  };
  return (
    <section className="panel mon-tesoro" aria-label="Tesoro común">
      <Esquinas solo="arriba" />
      <header>
        <h2 className="h">Tesoro común</h2>
        <span className="s">Fondo de la party · equivale a <b style={{ color: '#e8c46c' }}>{fmtPo(totalEnPo(t))} PO</b></span>
      </header>
      <div>
        {CLAVES.map((k) => (
          <div key={k} className="mon-fila">
            <Moneda {...MONEDA[k]} tam={38} />
            <div className="mon-n"><span>{NOMBRE_MONEDA[k]}</span><span>{EQUIVALE[k]}</span></div>
            <b>{fmtNum(t[k])}</b>
            <Mini etiqueta={`Retirar ${NOMBRE_MONEDA[k].toLowerCase()} (Mayús: 10)`} d={UI.menos} disabled={t[k] === 0} onClick={(e) => ajustar(k, -Math.min(t[k], e.shiftKey ? 10 : 1))} />
            <Mini etiqueta={`Ingresar ${NOMBRE_MONEDA[k].toLowerCase()} (Mayús: 10)`} d={UI.mas} onClick={(e) => ajustar(k, e.shiftKey ? 10 : 1)} />
          </div>
        ))}
      </div>
      <div className="mon-acciones">
        <button type="button" className="btn sec" onClick={onCambiar}>Cambiar monedas</button>
        <button type="button" className="btn sec" onClick={onHistorial}>Historial</button>
      </div>
    </section>
  );
}

// ── Monedas por personaje ──────────────────────────────────────────

function PorPersonaje({ onAjuste }: { onAjuste: (p: Personaje, modo: 'ingresar' | 'retirar') => void }) {
  const { estado } = useCofre();
  const total = estado.personajes.reduce((s, p) => sumar(s, p.monedas), estado.party.tesoro);
  return (
    <section className="panel mon-tabla" aria-label="Monedas por personaje">
      <Esquinas solo="arriba" />
      <h2 className="h">Monedas por personaje</h2>
      <table>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', paddingLeft: 0 }}>Personaje</th>
            {CLAVES.map((k) => <th key={k}>{k.toUpperCase()}</th>)}
            <th>Total PO</th>
            <th style={{ width: 76 }}><span className="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          {estado.personajes.map((p) => (
            <tr key={p.id}>
              <td style={{ textAlign: 'left', paddingLeft: 0 }}>
                <span className="mon-pj">
                  <span className="mon-ini" style={{ borderColor: p.color, background: `linear-gradient(180deg, ${p.color}88, var(--t-0b0907))` }}>
                    {p.imagenUrl ? <img src={p.imagenUrl} alt="" /> : iniciales(p.nombre)}
                  </span>
                  <span>{p.nombre}</span>
                </span>
              </td>
              {CLAVES.map((k) => <td key={k} style={k === 'po' ? { color: '#e8c46c' } : undefined}>{fmtNum(p.monedas[k])}</td>)}
              <td style={{ fontWeight: 700, color: 'var(--t-f2e6c8)' }}>{fmtPo(totalEnPo(p.monedas))}</td>
              <td>
                <span className="mon-btns">
                  <Mini etiqueta={`Retirar de ${p.nombre}`} d={UI.menos} disabled={vacia(p.monedas)} onClick={() => onAjuste(p, 'retirar')} />
                  <Mini etiqueta={`Ingresar a ${p.nombre}`} d={UI.mas} onClick={() => onAjuste(p, 'ingresar')} />
                </span>
              </td>
            </tr>
          ))}
          <tr className="mon-total">
            <td style={{ textAlign: 'left', paddingLeft: 0 }}>Party + tesoro</td>
            {CLAVES.map((k) => <td key={k} style={k === 'po' ? { color: '#e8c46c' } : undefined}>{fmtNum(total[k])}</td>)}
            <td style={{ fontWeight: 700, color: '#e8c46c' }}>{fmtPo(totalEnPo(total))}</td>
            <td />
          </tr>
        </tbody>
      </table>
      <p className="s nota">1 PPT = 10 PO · 1 PE = ½ PO · 10 PP = 1 PO · 100 PC = 1 PO. Cada 50 monedas pesan 0,45 kg y cuentan para la carga.</p>
    </section>
  );
}

// ── Repartir botín ─────────────────────────────────────────────────

function CamposMonedas({ valor, onChange, etiqueta }: { valor: TMonedas; onChange: (m: TMonedas) => void; etiqueta: string }) {
  return (
    <div className="mon-campos">
      {CLAVES.map((k) => (
        <label key={k}>
          <Moneda {...MONEDA[k]} tam={34} />
          <input
            className="inp" inputMode="numeric" aria-label={`${NOMBRE_MONEDA[k]} ${etiqueta}`}
            value={valor[k] || ''} placeholder="0"
            onChange={(e) => onChange({ ...valor, [k]: Math.max(0, parseInt(e.target.value.replace(/\D/g, ''), 10) || 0) })}
            onFocus={(e) => e.target.select()}
          />
        </label>
      ))}
    </div>
  );
}

function Botin({ avisar }: { avisar: Avisar }) {
  const { estado, actor, monedas } = useCofre();
  const [botin, setBotin] = useState<TMonedas>({ ...CERO });
  const [sel, setSel] = useState<string[]>(() => estado.personajes.map((p) => p.id));
  const [convertir, setConvertir] = useState(false);
  const elegidos = estado.personajes.filter((p) => sel.includes(p.id));
  const n = elegidos.length;
  const { cada, resto } = repartir(botin, n, convertir);
  const kgCada = (cuantas(cada) / 50) * 0.45;

  const cambiosReparto: Cambio[] = [
    ...elegidos.map((p) => ({ bolsa: { personajeId: p.id }, delta: cada })),
    { bolsa: 'tesoro' as const, delta: resto },
  ];
  // Comprobación sin aplicar, para avisar antes de pulsar
  const prueba = !vacia(botin) && n > 0 ? aplicarMonedas(estado, cambiosReparto, actor, '') : null;

  const hecho = (r: { ok: true } | { ok: false; motivo: string }, msg: string) => {
    if (!r.ok) return avisar(r.motivo, true);
    avisar(msg);
    setBotin({ ...CERO });
  };
  const repartirYa = () =>
    hecho(monedas(cambiosReparto, `Repartió ${texto(botin)} entre ${elegidos.map((p) => p.nombre.split(' ')[0]).join(', ')}; resto al tesoro: ${texto(resto)}`),
      `Botín repartido: ${texto(cada)} para cada uno`);
  const alTesoro = () => hecho(monedas([{ bolsa: 'tesoro', delta: botin }], `Guardó ${texto(botin)} en el tesoro común`), `${texto(botin)} al tesoro común`);
  const alternar = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <section className="panel mon-botin" aria-label="Repartir botín">
      <Esquinas />
      <header>
        <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M4 8c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 8v4c0 1.7 3.6 3 8 3s8-1.3 8-3V8M4 12v4c0 1.7 3.6 3 8 3s8-1.3 8-3v-4" /></svg>
        <div>
          <h2 className="h">Repartir botín</h2>
          <span className="s">Divide a partes iguales entre quien elijas</span>
        </div>
      </header>
      <div className="mon-bloque">
        <span className="k">Botín encontrado</span>
        <CamposMonedas valor={botin} onChange={setBotin} etiqueta="a repartir" />
      </div>
      <div className="mon-bloque">
        <span className="k">Entre</span>
        <div className="mon-quien">
          {estado.personajes.map((p) => {
            const on = sel.includes(p.id);
            return (
              <button key={p.id} type="button" role="checkbox" aria-checked={on} className={`pick ${on ? 'on' : ''}`} onClick={() => alternar(p.id)}>
                <span className="caja">{on && <Icono d={UI.check} size={14} />}</span>
                <span className="punto" style={{ background: p.color }} />{p.nombre.split(' ')[0]}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mon-recibe">
        <span className="k">Cada uno recibe</span>
        {n === 0 ? (
          <span className="s">Elige al menos a un personaje.</span>
        ) : (
          <>
            <div className="mon-cifras">
              {(['ppt', 'po', 'pp', 'pc', 'pe'] as const).filter((k) => k === 'po' || cada[k] || (k === 'pe' && !convertir)).map((k) => (
                <span key={k} className={`c-${k}`}>{fmtNum(cada[k])} <small>{k.toUpperCase()}</small></span>
              ))}
            </div>
            <span className="s">Resto al tesoro común: <b style={{ color: 'var(--t-ece4d2)' }}>{texto(resto)}</b></span>
            <span className="s" style={{ fontSize: 13, color: 'var(--t-8f846f)' }}>+{fmtKg(kgCada)} kg por persona en monedas</span>
          </>
        )}
        {prueba && !prueba.ok && <span className="mon-error" role="alert">{prueba.motivo}</span>}
      </div>
      <label className="mon-convertir">
        <input type="checkbox" checked={convertir} onChange={(e) => setConvertir(e.target.checked)} />
        <span>Convertir a la moneda más alta posible</span>
      </label>
      <div className="mon-acciones">
        <button type="button" className="btn sec" disabled={vacia(botin)} onClick={alTesoro}>Al tesoro común</button>
        <button type="button" className="btn pri" style={{ flex: 1.4 }} disabled={vacia(botin) || n === 0 || (prueba !== null && !prueba.ok)} onClick={repartirYa}>
          Repartir entre {n}
        </button>
      </div>
    </section>
  );
}

// ── Carga ──────────────────────────────────────────────────────────

function Carga() {
  const { estado } = useCofre();
  const filas = estado.personajes.map((p) => ({ p, peso: pesoPersonajeKg(estado, p), max: cargaMaxDe(estado, p) }));
  const peso = filas.reduce((s, f) => s + f.peso, 0);
  const max = filas.reduce((s, f) => s + f.max, 0);
  return (
    <section className="panel mon-carga" aria-label="Carga">
      <Esquinas />
      <header>
        <h2 className="h">Carga</h2>
        <span className="s">Party <b>{fmtKg(peso)} / {max} kg</b> · Alijo <b>{fmtKg(pesoAlijoKg(estado))} kg</b> (en el carro)</span>
      </header>
      {filas.map(({ p, peso: w, max: m }) => {
        const t = tramoCarga(w, m);
        return (
          <div key={p.id} className="mon-cfila">
            <span className="mon-cn"><span className="punto" style={{ background: p.color }} />{p.nombre}</span>
            <div className="mon-barra">
              <div /><div /><div />
              <div className="relleno" style={{ width: `${Math.min(100, (w / m) * 100)}%`, background: `linear-gradient(90deg, ${t.color}88, ${t.color})`, boxShadow: `0 0 10px ${t.color}66` }} />
            </div>
            <span className="mon-cv"><span style={{ color: t.color }}>{t.texto.split(' · ')[0].replace('Carga normal', 'Normal')}</span><span><b>{fmtKg(w)}</b> / {m} kg</span></span>
          </div>
        );
      })}
      <div className="mon-cfila mon-ctotal">
        <span className="mon-cn">Total party</span>
        <div className="mon-reparto">
          {filas.map(({ p, peso: w }) => <div key={p.id} title={`${p.nombre}: ${fmtKg(w)} kg`} style={{ width: `${(w / max) * 100}%`, background: p.color }} />)}
          <div style={{ flex: 1, background: 'var(--t-1a1611)', border: '1px solid var(--t-3a2f1d)' }} />
        </div>
        <span className="mon-cv" style={{ justifyContent: 'flex-end' }}><span><b>{fmtKg(peso)}</b> / {max} kg · {Math.round((peso / max) * 100)} %</span></span>
      </div>
    </section>
  );
}

// ── Diálogos ───────────────────────────────────────────────────────

function Dialogo({ titulo, onCerrar, children, ancho = 580 }: { titulo: string; onCerrar: () => void; children: React.ReactNode; ancho?: number }) {
  useEscape(onCerrar);
  return (
    <Capa>
      <div className="velo" onClick={onCerrar} />
      <section role="dialog" aria-modal="true" aria-label={titulo} className="panel dialogo" style={{ width: ancho }}>
        <Esquinas />
        <header>
          <h2>{titulo}</h2>
          <svg viewBox="0 0 330 10" width="300" height="10" aria-hidden="true"><path d="M0 5h150M180 5h150" stroke="#4d3e25" /><path d="M165 1l4 4-4 4-4-4z" fill="#b89a55" /></svg>
        </header>
        {children}
      </section>
    </Capa>
  );
}

function AjustePersonaje({ p, modo, avisar, onCerrar }: { p: Personaje; modo: 'ingresar' | 'retirar'; avisar: Avisar; onCerrar: () => void }) {
  const { monedas } = useCofre();
  const [m, setM] = useState<TMonedas>({ ...CERO });
  const [conTesoro, setConTesoro] = useState(true);
  const signo = modo === 'ingresar' ? 1 : -1;
  const nombre = p.nombre.split(' ')[0];
  const cambios: Cambio[] = [{ bolsa: { personajeId: p.id }, delta: escalar(m, signo) }];
  if (conTesoro) cambios.push({ bolsa: 'tesoro', delta: escalar(m, -signo) });
  const aceptar = () => {
    const desc = modo === 'ingresar'
      ? `Dio ${texto(m)} a ${p.nombre}${conTesoro ? ' desde el tesoro común' : ''}`
      : `Quitó ${texto(m)} a ${p.nombre}${conTesoro ? ' y lo guardó en el tesoro común' : ''}`;
    const r = monedas(cambios, desc);
    if (!r.ok) return avisar(r.motivo, true);
    avisar(desc);
    onCerrar();
  };
  return (
    <Dialogo titulo={modo === 'ingresar' ? `Ingresar a ${nombre}` : `Retirar de ${nombre}`} onCerrar={onCerrar}>
      <CamposMonedas valor={m} onChange={setM} etiqueta={modo === 'ingresar' ? 'a ingresar' : 'a retirar'} />
      <label className="mon-convertir">
        <input type="checkbox" checked={conTesoro} onChange={(e) => setConTesoro(e.target.checked)} />
        <span>{modo === 'ingresar' ? 'Sacarlo del tesoro común' : 'Guardarlo en el tesoro común'}</span>
      </label>
      <p>{conTesoro ? 'Las monedas pasan entre el tesoro y el personaje.' : modo === 'ingresar' ? 'Monedas nuevas (botín, pago, venta).' : 'Monedas gastadas: desaparecen.'}</p>
      <div className="acciones">
        <button type="button" className="btn sec" onClick={onCerrar}>Cancelar</button>
        <button type="button" className="btn pri" disabled={vacia(m)} onClick={aceptar}>{modo === 'ingresar' ? 'Ingresar' : 'Retirar'}</button>
      </div>
    </Dialogo>
  );
}

function CambiarMonedas({ avisar, onCerrar }: { avisar: Avisar; onCerrar: () => void }) {
  const { estado, monedas } = useCofre();
  const [de, setDe] = useState<ClaveMoneda>('pc');
  const [a, setA] = useState<ClaveMoneda>('po');
  const [n, setN] = useState(100);
  const recibe = cambio(n, de, a);
  const tiene = estado.party.tesoro[de];
  const motivo = n > tiene ? `El tesoro solo tiene ${fmtNum(tiene)} ${de.toUpperCase()}`
    : de === a ? 'Elige dos monedas distintas'
    : recibe === null ? `${n} ${de.toUpperCase()} no da un número exacto de ${a.toUpperCase()} (múltiplos de ${VALOR_PC[a] / gcd(VALOR_PC[a], VALOR_PC[de])})`
    : '';
  const aceptar = () => {
    const r = monedas([{ bolsa: 'tesoro', delta: sumar(solo(de, -n), solo(a, recibe!)) }], `Cambió ${n} ${de.toUpperCase()} por ${recibe} ${a.toUpperCase()} en el tesoro común`);
    if (!r.ok) return avisar(r.motivo, true);
    avisar(`Cambio hecho: ${n} ${de.toUpperCase()} → ${recibe} ${a.toUpperCase()}`);
    onCerrar();
  };
  const selector = (v: ClaveMoneda, f: (k: ClaveMoneda) => void, etiqueta: string) => (
    <select aria-label={etiqueta} value={v} onChange={(e) => f(e.target.value as ClaveMoneda)}>
      {CLAVES.map((k) => <option key={k} value={k}>{NOMBRE_MONEDA[k]} ({k.toUpperCase()})</option>)}
    </select>
  );
  return (
    <Dialogo titulo="Cambiar monedas" onCerrar={onCerrar}>
      <p>Cambia monedas del tesoro común sin perder valor.</p>
      <div className="mon-cambio">
        <input className="inp" inputMode="numeric" aria-label="Cantidad" value={n || ''} onChange={(e) => setN(parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)} />
        {selector(de, setDe, 'Moneda que entregas')}
        <svg viewBox="0 0 40 20" width="40" height="20" aria-hidden="true"><path d={UI.flecha} fill="none" stroke="#b89a55" strokeWidth="1.6" /></svg>
        <b>{recibe ?? '—'}</b>
        {selector(a, setA, 'Moneda que recibes')}
      </div>
      {motivo && <span className="mon-error" role="alert">{motivo}</span>}
      <div className="acciones">
        <button type="button" className="btn sec" onClick={onCerrar}>Cancelar</button>
        <button type="button" className="btn pri" disabled={!!motivo || !n} onClick={aceptar}>Cambiar</button>
      </div>
    </Dialogo>
  );
}

const gcd = (x: number, y: number): number => (y ? gcd(y, x % y) : x);

function Historial({ onCerrar }: { onCerrar: () => void }) {
  const { estado } = useCofre();
  const registro = estado.registroMonedas ?? [];
  const hora = (t: number) => new Date(t).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <Dialogo titulo="Historial de monedas" onCerrar={onCerrar} ancho={720}>
      {registro.length === 0 ? (
        <p>Todavía no se ha movido ninguna moneda.</p>
      ) : (
        <ul className="mon-historial">
          {registro.map((r) => (
            <li key={r.id}><b>{r.actor}</b> {r.texto.charAt(0).toLowerCase() + r.texto.slice(1)}<span>{hora(r.fecha)}</span></li>
          ))}
        </ul>
      )}
      <div className="acciones"><button type="button" className="btn sec" onClick={onCerrar}>Cerrar</button></div>
    </Dialogo>
  );
}
