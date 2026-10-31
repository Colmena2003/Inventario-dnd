// Pantalla 4 del diseño: vista individual con ficha, equipo e inventario filtrable.

import { useRef, useState, type CSSProperties } from 'react';
import { hoja, type Hoja } from '../domain/hoja';
import {
  capital, CLASE_RAREZA, conSigno, equipadoEn, fmtKg, MAX_SINTONIZADOS, nivelTotal, objetosDe, ORDENES, primerNombre, pxNivelActual, pxSiguienteNivel, sintonizadosDe,
} from '../domain/reglas';
import type { Categoria, Caracteristica, IconoRasgo, Personaje } from '../domain/tipos';
import { useCofre } from '../store/cofre';
import { useDobleClic, useSintonia } from './Dialogos';
import { claseCambio, desglose } from './desglose';
import { ClasesConIcono } from './clases';
import { BloqueEfectos } from './Efectos';
import { EspaciosConjuro } from './Espacios';
import { BotonMenu } from './Menu';
import { useEditor } from './editorCtx';
import { useEditorPersonaje } from './EditorPersonaje';
import { ICONOS, UI, type ClaveIcono } from './iconos';
import { baseDe } from './arrastre';
import { DCHA, IZQ, RanuraEquipo, RejillaObjetos, Silueta, SILUETA_ARMA, useInteraccion } from './interaccion';
import { Esquinas, fmtNum, Icono, IconoObjeto, Moneda, MONEDAS } from './piezas';
import { TiroAtaque, TiroDano } from './TirarArma';

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
  corazon: { d: UI.corazon, c: '#9cc95e' },
  rayo: { d: UI.rayo, c: '#f0c86a' },
  ojo: { d: UI.ojo, c: '#8fc3ff' },
  espada: { d: ICONOS.sword, c: '#d8ccb3' },
  escudo: { d: ICONOS.shield, c: '#d8ccb3' },
  estrella: { d: UI.estrella, c: '#c98dff' },
  libro: { d: ICONOS.book, c: '#8fc3ff' },
  mano: { d: UI.mano, c: '#d8ccb3' },
};

const ESTRELLA = ICONO_RASGO.estrella.d;
const ALERTA = UI.alerta;
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

  return (
    <section className="panel ficha" aria-label={`Ficha de ${p.nombre}`}>
      <Esquinas />
      <button type="button" className="ibtn ficha-editar" aria-label={`Editar la ficha de ${p.nombre}`} title="Editar ficha" onClick={() => editorPj.editar(p)}>
        <Icono d={UI.lapiz} />
      </button>
      <header>
        <h1>{p.nombre}</h1>
        <span className="ficha-sub">{p.raza}{p.trasfondo ? ` · Trasfondo: ${p.trasfondo}` : ''}</span>
        <span className="ficha-nivel">Nivel {nivel} · <ClasesConIcono clases={p.clases} tam={17} /></span>
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
              <span style={{ color: v >= 12 ? '#9cc95e' : v < 10 ? '#e0883a' : 'var(--t-cfc3aa)' }}>{conSigno(m)}</span>
            </div>
          );
        })}
      </div>

      <div className="derivados">
        <div title={desglose(h.iniciativa)}><span>Iniciativa</span><b className={h.iniciativa.desv?.length ? 'desv' : ''}>{conSigno(h.iniciativa.total)}</b></div>
        <div title={desglose(h.velocidad.caminar)}><span>Velocidad</span><b className={claseVel(h)}>{fmtKg(h.velocidad.caminar.total).replace(',0', '')} pies</b></div>
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
      <EspaciosConjuro p={p} avisar={avisar} />
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
    const quien = primerNombre(p.nombre);
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
    <section className={`equipo ${p.imagenUrl ? 'con-fondo' : ''}`} aria-label="Equipo" style={{ '--tinte': p.color } as CSSProperties}>
      <div className="equipo-aura" aria-hidden="true" />
      {p.imagenUrl ? (
        <img className="fondo-pj" src={p.imagenUrl} alt={`Imagen de ${p.nombre}`} />
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
                <IconoObjeto icono={o.icono} />
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
        onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) cambiarImagen(p.id, await prepararImagen(f)); }}
      />

      <div className="equipo-izq">{IZQ.map(([r, ic]) => ranura(r, 0, ic))}</div>
      <div className="equipo-dcha">{DCHA.map(([r, i, ic]) => ranura(r, i, ic))}</div>

      <div className="equipo-armas">
        <div>
          <span className="lbl">Cuerpo a cuerpo</span>
          <div className="par">{ranura('cuerpoACuerpo', 0, 'sword', 'Mano principal')}{ranura('cuerpoACuerpo', 1, 'shield', 'Mano secundaria')}</div>
          <div className="atq">{atqM ? <><TiroAtaque p={p} a={atqM}><b className={atqM.bono.desv?.length ? 'desv' : ''}>{conSigno(atqM.bono.total)}</b></TiroAtaque><TiroDano p={p} a={atqM}><span>{`${atqM.dano} ${atqM.tipo ?? ''}`}</span></TiroDano></> : <><b>—</b><span>Sin arma</span></>}</div>
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
          <div className="atq">{atqR ? <><TiroDano p={p} a={atqR}><span>{`${atqR.dano} ${atqR.tipo ?? ''}`}</span></TiroDano><TiroAtaque p={p} a={atqR}><b className={atqR.bono.desv?.length ? 'desv' : ''}>{conSigno(atqR.bono.total)}</b></TiroAtaque></> : <><span>Sin arma</span><b>—</b></>}</div>
        </div>
      </div>
    </section>
  );
}

// ── Inventario ─────────────────────────────────────────────────────

const CATEGORIAS: { t: string; cat: Categoria | null; ic: ClaveIcono | null }[] = [
  { t: 'Todo', cat: null, ic: null },
  { t: 'Armas', cat: 'Armas', ic: 'sword' },
  { t: 'Armaduras', cat: 'Armaduras', ic: 'armor' },
  { t: 'Pociones', cat: 'Pociones', ic: 'potion' },
  { t: 'Pergaminos', cat: 'Pergaminos', ic: 'scroll' },
  { t: 'Materiales', cat: 'Materiales', ic: 'ore' },
  { t: 'Comida', cat: 'Comida', ic: 'bread' },
  { t: 'Llaves/misión', cat: 'Llaves/misión', ic: 'key' },
  { t: 'Varios', cat: 'Varios', ic: 'bag' },
];

function Inventario({ p, h, busqueda }: { p: Personaje; h: Hoja; busqueda: string }) {
  const { estado, validar } = useCofre();
  const editor = useEditor();
  const { ordenar } = useCofre();
  const doble = useDobleClic();
  const { arrastre } = useInteraccion(busqueda, doble);
  const [cat, setCat] = useState(0);
  const dueno = { tipo: 'personaje' as const, id: p.id };

  const inventario = objetosDe(estado, { tipo: 'personaje', id: p.id }).filter((o) => !o.equipadoEn);
  const filtro = CATEGORIAS[cat].cat;
  const visibles = filtro ? inventario.filter((o) => o.categoria === filtro) : inventario;

  const peso = h.carga, max = h.cargaMax, tramo = h.tramo;

  const esOrigen = arrastre?.objeto.propietario.tipo === 'personaje' && arrastre.objeto.propietario.id === p.id;
  // Apunta al inventario (no a una ranura de equipo) desde fuera: si no cabe, se dice por qué
  const apunta = !!arrastre?.objetivo && baseDe(arrastre.objetivo.clave) === `pj:${p.id}` && !esOrigen;
  const v = arrastre ? validar(arrastre.objeto.id, { propietario: dueno }) : null;

  return (
    <section className="panel inventario" aria-label={`Inventario de ${p.nombre}`}>
      <Esquinas />
      <header>
        <h2>Inventario <span>· {inventario.length} objetos</span></h2>
        <BotonMenu className="chip chip-i" etiqueta="Ordenar inventario" lado="dcha" opciones={[{ titulo: 'Ordenar por' }, ...ORDENES.map((o) => ({ texto: o.texto, icono: UI.ordenar, onClick: () => ordenar(dueno, o.id) }))]}>
          <Icono d={UI.ordenar} />Ordenar
        </BotonMenu>
        <button type="button" className="chip on chip-i" onClick={() => editor.nuevo({ propietario: { tipo: 'personaje', id: p.id }, tipo: CATEGORIAS[cat].cat === 'Comida' ? 'comida' : undefined })}>
          <Icono d={UI.mas} />Añadir objeto
        </button>
      </header>
      <div className="categorias" role="group" aria-label="Filtrar por categoría">
        {CATEGORIAS.map((c, i) => (
          <button key={c.t} type="button" className={`chip chip-i ${i === cat ? 'on' : ''}`} aria-pressed={i === cat} onClick={() => setCat(i)}>
            {c.ic ? <IconoObjeto icono={c.ic} /> : <Icono d={UI.todo} />}{c.t}
          </button>
        ))}
      </div>
      <RejillaObjetos
        className="rejilla ind" aria-label={`Objetos de ${p.nombre}`} objetos={visibles} dueno={dueno} minimo={168} porFila={12}
        busqueda={busqueda} onDoble={doble} porCelda={cat === 0} valido={!!v?.ok}
      />
      {apunta && v && !v.ok && <div className="aviso error inv-aviso" role="alert">{v.motivo}</div>}

      <footer>
        <div className="carga-tramos">
          <Icono d={UI.peso} />
          <div>
            <div className="tramos">
              <div style={{ background: 'rgb(from var(--t-c9a65a) r g b / .14)', borderColor: 'var(--t-4d3e25)' }} />
              <div style={{ background: 'rgba(224,136,58,.12)', borderColor: '#5a3a1f' }} />
              <div style={{ background: 'rgba(224,83,77,.12)', borderColor: '#5a2321' }} />
              <div className="relleno" style={{ width: `${Math.min(100, (peso / max) * 100)}%`, background: `linear-gradient(90deg, ${tramo.color}aa, ${tramo.color})`, boxShadow: `0 0 8px ${tramo.color}80` }} />
            </div>
            <div className="tramos-t">
              <span style={{ color: 'var(--t-c9a65a)' }}>Normal hasta {fmtKg(max / 3)}</span>
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
