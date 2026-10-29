// Pantalla 4 del diseño: vista individual con ficha, equipo e inventario filtrable.

import { useRef, useState, type CSSProperties } from 'react';
import { hoja, type Hoja } from '../domain/hoja';
import {
  CLASE_RAREZA, conSigno, equipadoEn, fmtKg, MAX_SINTONIZADOS, nivelTotal, objetosDe,
  pxNivelActual, pxSiguienteNivel, sintonizadosDe,
} from '../domain/reglas';
import type { Categoria, Caracteristica, IconoRasgo, Objeto, Personaje, Rareza } from '../domain/tipos';
import { useCofre } from '../store/cofre';
import { useDobleClic, useSintonia } from './Dialogos';
import { claseCambio, desglose, tituloAtaque } from './desglose';
import { BloqueEfectos } from './Efectos';
import { useEditor } from './editorCtx';
import { useEditorPersonaje } from './EditorPersonaje';
import { ICONOS, UI, type ClaveIcono } from './iconos';
import { celdas, DCHA, IZQ, RanuraEquipo, Silueta, SILUETA_ARMA, useInteraccion } from './interaccion';
import { Esquinas, fmtNum, Icono, Moneda, MONEDAS, Ranura } from './piezas';

type Avisar = (texto: string, error?: boolean) => void;

export function Individual({ personajeId, busqueda, avisar }: { personajeId: string | null; busqueda: string; avisar: Avisar }) {
  const { estado } = useCofre();
  const p = estado.personajes.find((x) => x.id === personajeId) ?? estado.personajes[0];
  if (!p) return null;
  const h = hoja(estado, p);
  return (
    <>
      <Ficha p={p} h={h} avisar={avisar} />
      <Equipo p={p} h={h} busqueda={busqueda} />
      <Inventario p={p} h={h} busqueda={busqueda} />
    </>
  );
}

// ── Ficha ──────────────────────────────────────────────────────────

const CARACTERISTICAS: [Caracteristica, string][] = [['fue', 'FUE'], ['des', 'DES'], ['con', 'CON'], ['int', 'INT'], ['sab', 'SAB'], ['car', 'CAR']];

const ICONO_RASGO: Record<IconoRasgo, { d: string; c: string }> = {
  corazon: { d: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z', c: '#9cc95e' },
  rayo: { d: 'M13 2L4 14h7l-1 8 9-12h-7z', c: '#f0c86a' },
  ojo: { d: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', c: '#8fc3ff' },
  espada: { d: ICONOS.sword, c: '#d8ccb3' },
  escudo: { d: ICONOS.shield, c: '#d8ccb3' },
  estrella: { d: 'M12 2.5l2.4 6.1 6.1 2.4-6.1 2.4L12 19.5l-2.4-6.1L3.5 11l6.1-2.4z', c: '#c98dff' },
  libro: { d: ICONOS.book, c: '#8fc3ff' },
  mano: { d: ICONOS.gloves, c: '#d8ccb3' },
};

const ESTRELLA = ICONO_RASGO.estrella.d;
const ALERTA = 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v6M12 16v.01';
/** [5e] Condiciones que perjudican; el resto se muestran como efectos favorables. */
const CONDICION_MALA = /agotamiento|envenenad|asustad|cegad|aturdid|paralizad|derribad|apresad|incapacitad|petrificad|ensordecid|hechizad|inconsciente|restringid|maldit/i;

function Ficha({ p, h, avisar }: { p: Personaje; h: Hoja; avisar: Avisar }) {
  const { usarRasgo } = useCofre();
  const editorPj = useEditorPersonaje();
  const nivel = nivelTotal(p);
  const pxSig = pxSiguienteNivel(nivel);
  const pxIni = pxNivelActual(nivel);
  const px = p.px ?? pxIni;
  const progreso = pxSig ? Math.max(0, Math.min(1, (px - pxIni) / (pxSig - pxIni))) : 1;
  const clases = p.clases.map((c) => `${c.clase} ${c.nivel}`).join(' / ');

  return (
    <section className="panel ficha" aria-label={`Ficha de ${p.nombre}`}>
      <Esquinas />
      <button type="button" className="ibtn ficha-editar" aria-label={`Editar la ficha de ${p.nombre}`} title="Editar ficha" onClick={() => editorPj.editar(p)}>
        <Icono d={UI.lapiz} />
      </button>
      <header>
        <h1>{p.nombre}</h1>
        <span className="ficha-sub">{p.raza}{p.trasfondo ? ` · Trasfondo: ${p.trasfondo}` : ''}</span>
        <span className="ficha-nivel">Nivel {nivel} · {clases}</span>
        <div className="ficha-px" title={pxSig ? `Siguiente nivel con ${fmtNum(pxSig)} PX` : 'Nivel máximo'}>
          <span>PX</span>
          <div><div style={{ width: `${progreso * 100}%` }} /></div>
          <span>{fmtNum(px)}{pxSig ? ` / ${fmtNum(pxSig)}` : ''}</span>
        </div>
      </header>

      <PuntosDeGolpe p={p} h={h} avisar={avisar} />

      <div className="stats">
        {CARACTERISTICAS.map(([k, t]) => {
          const v = h.car[k].total, m = h.mod[k];
          return (
            <div key={k} aria-label={`${t} ${v}, modificador ${conSigno(m)}`} title={desglose(h.car[k])}>
              <span>{t}</span>
              <b className={claseCambio(h.car[k])}>{v}</b>
              <span style={{ color: v >= 12 ? '#9cc95e' : v < 10 ? '#e0883a' : '#cfc3aa' }}>{conSigno(m)}</span>
            </div>
          );
        })}
      </div>

      <div className="derivados">
        <div title={desglose(h.iniciativa)}><span>Iniciativa</span><b className={h.iniciativa.desv?.length ? 'desv' : ''}>{conSigno(h.iniciativa.total)}</b></div>
        <div title={desglose(h.velocidad.caminar)}><span>Velocidad</span><b className={claseVel(h)}>{fmtKg(h.velocidad.caminar.total).replace(',0', '')} m</b></div>
        <div title={desglose(h.pasivas.percepcion)}><span>Percepción pas.</span><b>{h.pasivas.percepcion.total}</b></div>
        <div title={h.conjuros ? desglose(h.conjuros.cd) : 'No lanza conjuros'}><span>CD conjuros</span><b>{h.conjuros?.cd.total ?? '—'}</b></div>
        <div title={desglose(h.competencia)}><span>Competencia</span><b>{conSigno(h.competencia.total)}</b></div>
      </div>

      <div className="ficha-bloque">
        <h3 className="titulo-sec">Condiciones</h3>
        <div className="etiquetas">
          {p.condiciones.length === 0 && !h.saciedad.efectos.length && <span className="vacio">Ninguna</span>}
          {h.saciedad.efectos.length > 0 && (
            <span className="cond mala" title={h.saciedad.efectos.join(' · ')}><Icono d={ALERTA} size={14} />{h.saciedad.texto} ({p.saciedad}/7)</span>
          )}
          {p.condiciones.map((c) => {
            const mala = CONDICION_MALA.test(c);
            return (
              <span key={c} className={`cond ${mala ? 'mala' : 'buena'}`}>
                <Icono d={mala ? ALERTA : ESTRELLA} size={14} />{c}
              </span>
            );
          })}
        </div>
      </div>
      <BloqueEfectos p={p} avisar={avisar} />
      <div className="ficha-bloque">
        <h3 className="titulo-sec">Resistencias</h3>
        <div className="etiquetas">
          {h.resistencias.length === 0 && !h.inmunidades.length && <span className="vacio">Ninguna</span>}
          {h.resistencias.map((r) => <span key={r.texto} className="cond" title={r.origen}>{capital(r.texto)}</span>)}
          {h.inmunidades.map((r) => <span key={r.texto} className="cond buena" title={r.origen}>Inmune: {r.texto}</span>)}
          {h.vulnerabilidades.map((r) => <span key={r.texto} className="cond mala" title={r.origen}>Vulnerable: {r.texto}</span>)}
        </div>
      </div>
      <div className="ficha-bloque">
        <h3 className="titulo-sec">Rasgos destacados</h3>
        <ul className="rasgos">
          {(p.rasgos ?? []).map((r) => {
            const ic = ICONO_RASGO[r.icono ?? 'estrella'];
            const quedan = r.usos ?? r.usosMax;
            return (
              <li key={r.nombre} title={r.recarga ? `Se recupera: ${r.recarga}` : undefined}>
                <span className="rasgo-ic" style={{ color: ic.c }}><Icono d={ic.d} size={14} /></span>
                <span className="rasgo-n">{r.nombre}</span>
                <span className="rasgo-u">{r.detalle}</span>
                {r.usosMax != null && (
                  <button
                    type="button" className={`rasgo-usos ${quedan === 0 ? 'agotado' : ''}`}
                    aria-label={`${r.nombre}: ${quedan} de ${r.usosMax} usos. Clic para gastar uno, clic derecho para devolverlo`}
                    title="Clic: gasta un uso · clic derecho: lo devuelve"
                    onClick={() => {
                      if (!quedan) { avisar(`${r.nombre}: sin usos${r.recarga ? ` (se recupera: ${r.recarga.toLowerCase()})` : ''}`, true); return; }
                      usarRasgo(p.id, r.nombre, -1);
                    }}
                    onContextMenu={(e) => { e.preventDefault(); usarRasgo(p.id, r.nombre, 1); }}
                  >
                    {quedan} / {r.usosMax}
                  </button>
                )}
              </li>
            );
          })}
          {!p.rasgos?.length && <li className="vacio">Sin rasgos anotados</li>}
        </ul>
      </div>
    </section>
  );
}

/** PV con barra y daño o curación rápidos: se escribe la cantidad y se pulsa Daño o Curar (Intro = daño). */
function PuntosDeGolpe({ p, h, avisar }: { p: Personaje; h: Hoja; avisar: Avisar }) {
  const { cambiarPv } = useCofre();
  const [cantidad, setCantidad] = useState('');
  const max = h.pvMax.total;
  const n = Math.max(0, Math.floor(Number(cantidad) || 0));
  const aplicar = (signo: 1 | -1, valor = n) => {
    if (!valor) return;
    const r = cambiarPv(p.id, signo * valor);
    if (!r) return;
    const quien = p.nombre.split(' ')[0];
    avisar(signo < 0 ? `${quien} recibe ${valor} de daño: PV ${r.antes} → ${r.despues}${r.despues === 0 ? ' · ¡inconsciente!' : ''}` : `${quien} se cura ${r.despues - r.antes}: PV ${r.antes} → ${r.despues}`, signo < 0 && r.despues === 0);
    setCantidad('');
  };
  const pct = Math.max(0, Math.min(100, (h.pvActual / max) * 100));
  return (
    <div className="pv-ficha" title={desglose(h.pvMax)}>
      <div className="pv-cab">
        <span>Puntos de golpe</span>
        <b className={h.pvActual === 0 ? 'cero' : pct <= 25 ? 'bajo' : ''}>{h.pvActual}<small> / {max}</small></b>
      </div>
      <div className="pv-barra" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={h.pvActual} aria-label={`PV de ${p.nombre}`}>
        <div style={{ width: `${pct}%` }} />
      </div>
      <form className="pv-acciones" onSubmit={(e) => { e.preventDefault(); aplicar(-1); }}>
        <button type="button" className="ibtn" aria-label="Quitar 1 PV" onClick={() => aplicar(-1, 1)}><Icono d={UI.menos} /></button>
        <input type="number" min={0} inputMode="numeric" placeholder="Cantidad" aria-label="Cantidad de daño o curación" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
        <button type="button" className="btn pv-dano" disabled={!n} onClick={() => aplicar(-1)}>Daño</button>
        <button type="button" className="btn pv-cura" disabled={!n} onClick={() => aplicar(1)}>Curar</button>
        <button type="button" className="ibtn" aria-label="Sumar 1 PV" onClick={() => aplicar(1, 1)}><Icono d={UI.mas} /></button>
      </form>
    </div>
  );
}

// ── Equipo ─────────────────────────────────────────────────────────

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const claseVel = (h: Hoja) => (h.velocidad.caminar.total < h.velocidad.caminar.base ? 'baja' : h.velocidad.caminar.total > h.velocidad.caminar.base ? 'sube' : '');

function Equipo({ p, h, busqueda }: { p: Personaje; h: Hoja; busqueda: string }) {
  const { estado, cambiarImagen, prepararImagen } = useCofre();
  const sintonia = useSintonia();
  const doble = useDobleClic();
  const { props } = useInteraccion(busqueda, sintonia);
  const fichero = useRef<HTMLInputElement>(null);
  const eq = (r: 'cuerpoACuerpo' | 'distancia') => equipadoEn(estado, p.id, r, 0);
  const armaCaC = eq('cuerpoACuerpo'), armaDist = eq('distancia');
  const atqM = h.ataques.find((a) => a.ranura === 'cuerpoACuerpo' && a.indice === 0);
  const atqR = h.ataques.find((a) => a.ranura === 'distancia' && a.indice === 0);
  const sint = sintonizadosDe(estado, p.id);
  const silueta = SILUETA_ARMA[(armaCaC ?? armaDist)?.icono as ClaveIcono];

  const ranura = (r: Parameters<typeof RanuraEquipo>[0]['ranura'], i: number, ic: ClaveIcono, etiqueta?: string) => (
    <RanuraEquipo key={r + i} p={p} ranura={r} indice={i} fantasma={ic} etiqueta={etiqueta} busqueda={busqueda} extra="big" onDoble={doble} />
  );

  return (
    <section className="equipo" aria-label="Equipo" style={{ '--tinte': p.color } as CSSProperties}>
      <div className="equipo-aura" aria-hidden="true" />
      {p.imagenUrl ? (
        <img className="equipo-img" src={p.imagenUrl} alt={`Imagen de ${p.nombre}`} />
      ) : (
        <Silueta className="equipo-fig" tinte={p.color} id={`ind-${p.id}`} arma={silueta} aura={false} />
      )}

      <div className="sintonia">
        <span>Sintonización <b>{sint.length} / {MAX_SINTONIZADOS}</b></span>
        <div>
          {Array.from({ length: MAX_SINTONIZADOS }, (_, i) => {
            const o = sint[i];
            return o ? (
              <div key={o.id} className={`slot has rombo-s ${CLASE_RAREZA[o.rareza]}`} aria-label={`Sintonizado: ${o.nombre}. Doble clic para desintonizar`} {...props(o)} onPointerDown={undefined}>
                <Icono d={ICONOS[o.icono]} />
              </div>
            ) : (
              <div key={`l${i}`} className="slot ghost rombo-s" aria-label="Ranura de sintonización libre"><Icono d={ESTRELLA} /></div>
            );
          })}
        </div>
      </div>

      <button type="button" className="pbtn equipo-cam" onClick={() => fichero.current?.click()}>
        <Icono d={UI.camara} />Cambiar imagen del personaje
      </button>
      <input
        ref={fichero} type="file" accept="image/*" hidden
        onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) cambiarImagen(p.id, await prepararImagen(f, 900)); }}
      />

      <div className="equipo-izq">{IZQ.map(([r, ic]) => ranura(r, 0, ic))}</div>
      <div className="equipo-dcha">{DCHA.map(([r, i, ic]) => ranura(r, i, ic))}</div>

      <div className="equipo-armas">
        <div>
          <span className="lbl">Cuerpo a cuerpo</span>
          <div className="par">{ranura('cuerpoACuerpo', 0, 'sword', 'Mano principal')}{ranura('cuerpoACuerpo', 1, 'shield', 'Mano secundaria')}</div>
          <div className="atq" title={atqM ? tituloAtaque(atqM) : undefined}><b className={atqM?.bono.desv?.length ? 'desv' : ''}>{atqM ? conSigno(atqM.bono.total) : '—'}</b><span>{atqM ? `${atqM.dano} ${atqM.tipo ?? ''}` : 'Sin arma'}</span></div>
        </div>
        <div className="ca grande" aria-label={`Clase de armadura ${h.ca.total}`} title={desglose(h.ca)}>
          <svg viewBox="0 0 76 84" width="96" height="106" aria-hidden="true">
            <path d="M38 3l32 10v26c0 20-14 34-32 42C20 73 6 59 6 39V13z" fill="#0f0c0a" stroke="#b89a55" strokeWidth="1.4" />
            <path d="M38 9l26 8v22c0 16-11 28-26 35C23 67 12 55 12 39V17z" fill="none" stroke="#4d3e25" />
            <path d="M30 6l8-5 8 5" fill="none" stroke="#e2c27a" strokeWidth="1.2" />
          </svg>
          <span>CA</span>
          <span>{h.ca.total}</span>
        </div>
        <div>
          <span className="lbl">A distancia</span>
          <div className="par">{ranura('distancia', 0, 'bow')}{ranura('distancia', 1, 'dagger', 'Mano secundaria')}</div>
          <div className="atq" title={atqR ? tituloAtaque(atqR) : undefined}><span>{atqR ? `${atqR.dano} ${atqR.tipo ?? ''}` : 'Sin arma'}</span><b className={atqR?.bono.desv?.length ? 'desv' : ''}>{atqR ? conSigno(atqR.bono.total) : '—'}</b></div>
        </div>
      </div>
    </section>
  );
}

// ── Inventario ─────────────────────────────────────────────────────

const CATEGORIAS: { t: string; cat: Categoria | null; ic: string }[] = [
  { t: 'Todo', cat: null, ic: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
  { t: 'Armas', cat: 'Armas', ic: ICONOS.sword },
  { t: 'Armaduras', cat: 'Armaduras', ic: ICONOS.armor },
  { t: 'Pociones', cat: 'Pociones', ic: ICONOS.potion },
  { t: 'Pergaminos', cat: 'Pergaminos', ic: ICONOS.scroll },
  { t: 'Materiales', cat: 'Materiales', ic: ICONOS.ore },
  { t: 'Comida', cat: 'Comida', ic: ICONOS.bread },
  { t: 'Llaves/misión', cat: 'Llaves/misión', ic: ICONOS.key },
  { t: 'Varios', cat: 'Varios', ic: ICONOS.bag },
];

type Orden = 'rareza' | 'peso' | 'valor' | 'reciente';

const ORDEN_RAREZA: Rareza[] = ['artefacto', 'legendario', 'muy raro', 'raro', 'poco común', 'común'];

function ordenar(objetos: Objeto[], orden: Orden, recientes: Map<string, number>) {
  const indice = new Map(objetos.map((o, i) => [o.id, i]));
  const por: Record<Orden, (a: Objeto, b: Objeto) => number> = {
    rareza: (a, b) => ORDEN_RAREZA.indexOf(a.rareza) - ORDEN_RAREZA.indexOf(b.rareza) || a.nombre.localeCompare(b.nombre, 'es'),
    peso: (a, b) => b.pesoKg * b.cantidad - a.pesoKg * a.cantidad,
    valor: (a, b) => b.valorPo * b.cantidad - a.valorPo * a.cantidad,
    // Lo último que llegó primero; sin movimientos, el orden de alta
    reciente: (a, b) => (recientes.get(b.id) ?? 0) - (recientes.get(a.id) ?? 0) || indice.get(b.id)! - indice.get(a.id)!,
  };
  return objetos.slice().sort(por[orden]);
}

function Inventario({ p, h, busqueda }: { p: Personaje; h: Hoja; busqueda: string }) {
  const { estado, validar } = useCofre();
  const editor = useEditor();
  const doble = useDobleClic();
  const { arrastre, props, clase } = useInteraccion(busqueda, doble);
  const [cat, setCat] = useState(0);
  const [orden, setOrden] = useState<Orden>('rareza');

  const inventario = objetosDe(estado, { tipo: 'personaje', id: p.id }).filter((o) => !o.equipadoEn);
  const filtro = CATEGORIAS[cat].cat;
  const recientes = new Map<string, number>();
  for (const m of estado.movimientos) if (!recientes.has(m.objetoId)) recientes.set(m.objetoId, m.fecha);
  const visibles = ordenar(filtro ? inventario.filter((o) => o.categoria === filtro) : inventario, orden, recientes);

  const peso = h.carga, max = h.cargaMax, tramo = h.tramo;

  const clave = `pj:${p.id}`;
  const esOrigen = arrastre?.objeto.propietario.tipo === 'personaje' && arrastre.objeto.propietario.id === p.id;
  const apunta = !!arrastre && arrastre.objetivo?.clave === clave && !(esOrigen && !arrastre.objeto.equipadoEn);
  const v = apunta ? validar(arrastre!.objeto.id, { propietario: { tipo: 'personaje', id: p.id } }) : null;
  const marca = v?.ok ? 'drop-ok' : 'drop-no';

  return (
    <section className="panel inventario" aria-label={`Inventario de ${p.nombre}`}>
      <Esquinas />
      <header>
        <h2>Inventario <span>· {inventario.length} objetos</span></h2>
        <label className="orden">
          Ordenar por
          <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
            <option value="rareza">Rareza</option>
            <option value="peso">Peso</option>
            <option value="valor">Valor</option>
            <option value="reciente">Reciente</option>
          </select>
        </label>
        <button type="button" className="chip on chip-i" onClick={() => editor.nuevo({ propietario: { tipo: 'personaje', id: p.id }, tipo: CATEGORIAS[cat].cat === 'Comida' ? 'comida' : undefined })}>
          <Icono d={UI.mas} />Añadir objeto
        </button>
      </header>
      <div className="categorias" role="group" aria-label="Filtrar por categoría">
        {CATEGORIAS.map((c, i) => (
          <button key={c.t} type="button" className={`chip chip-i ${i === cat ? 'on' : ''}`} aria-pressed={i === cat} onClick={() => setCat(i)}>
            <Icono d={c.ic} />{c.t}
          </button>
        ))}
      </div>
      <div className="rejilla ind" data-drop={clave} role="list" aria-label={`Objetos de ${p.nombre}`}>
        {celdas(visibles, 168, 12).map((o, i) =>
          o ? (
            <Ranura key={o.id} role="listitem" objeto={o} extra={clase(o)} {...props(o)} />
          ) : (
            <Ranura key={`v${i}`} role="listitem" extra={apunta && i === visibles.length ? marca : ''} />
          ),
        )}
      </div>
      {apunta && v && !v.ok && <div className="aviso error inv-aviso" role="alert">{v.motivo}</div>}

      <footer>
        <div className="carga-tramos">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={UI.peso} /></svg>
          <div>
            <div className="tramos">
              <div style={{ background: 'rgba(201,166,90,.14)', borderColor: '#4d3e25' }} />
              <div style={{ background: 'rgba(224,136,58,.12)', borderColor: '#5a3a1f' }} />
              <div style={{ background: 'rgba(224,83,77,.12)', borderColor: '#5a2321' }} />
              <div className="relleno" style={{ width: `${Math.min(100, (peso / max) * 100)}%`, background: `linear-gradient(90deg, ${tramo.color}aa, ${tramo.color})`, boxShadow: `0 0 8px ${tramo.color}80` }} />
            </div>
            <div className="tramos-t">
              <span style={{ color: '#c9a65a' }}>Normal hasta {fmtKg(max / 3)}</span>
              <span style={{ color: '#e0883a' }}>Cargado hasta {fmtKg((max * 2) / 3)}</span>
              <span style={{ color: '#e0534d' }}>Sobrecargado hasta {max}</span>
            </div>
          </div>
          <span className="carga-total"><b>{fmtKg(peso)}</b> / {max} kg</span>
        </div>
        <div className="monedas-p">
          <span>Monedas personales</span>
          <div>
            {MONEDAS.map((m) => (
              <span key={m.k} className="moneda-v"><Moneda {...m} />{fmtNum(p.monedas[m.k])}</span>
            ))}
          </div>
        </div>
      </footer>
    </section>
  );
}
