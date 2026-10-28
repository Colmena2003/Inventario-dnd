// Pantalla 4 del diseño: vista individual con ficha, equipo e inventario filtrable.

import { useRef, useState, type CSSProperties } from 'react';
import {
  ataque, CLASE_RAREZA, colocar, CONDICION_MALA, conSigno, equipadoEn, fmtKg, MAX_SINTONIZADOS, modificador, nivelTotal, objetosDe,
  pesoPersonajeKg, cargaMaxKg, pxNivelActual, pxSiguienteNivel, sintonizadosDe, tramoCarga,
} from '../domain/reglas';
import type { Categoria, Caracteristica, IconoRasgo, Personaje, Propietario } from '../domain/tipos';
import { guardarImagen } from '../store/archivos';
import { useCofre } from '../store/cofre';
import { claveBase, useArrastreSel } from './arrastre';
import { useSintonia } from './Dialogos';
import { useObjetos } from './EditarObjeto';
import { opcionesOrden } from './Grupal';
import { MenuBoton } from './Menus';
import { ICONOS, UI, type ClaveIcono } from './iconos';
import { DCHA, IZQ, RanuraEquipo, RejillaObjetos, Silueta, SILUETA_ARMA, useInteraccion } from './interaccion';
import { Esquinas, fmtNum, Icono, Moneda, MONEDAS } from './piezas';

export function Individual({ personajeId, busqueda }: { personajeId: string | null; busqueda: string }) {
  const { estado } = useCofre();
  const p = estado.personajes.find((x) => x.id === personajeId) ?? estado.personajes[0];
  if (!p) return null;
  return (
    <>
      <Ficha p={p} />
      <Equipo p={p} busqueda={busqueda} />
      <Inventario p={p} busqueda={busqueda} />
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

function Ficha({ p }: { p: Personaje }) {
  const { editarPersonaje } = useObjetos();
  const nivel = nivelTotal(p);
  const pxSig = pxSiguienteNivel(nivel);
  const pxIni = pxNivelActual(nivel);
  const px = p.px ?? pxIni;
  const progreso = pxSig ? Math.max(0, Math.min(1, (px - pxIni) / (pxSig - pxIni))) : 1;
  const clases = p.clases.map((c) => `${c.clase} ${c.nivel}`).join(' / ');

  return (
    <section className="panel ficha" aria-label={`Ficha de ${p.nombre}`}>
      <Esquinas />
      <header>
        <button type="button" className="ibtn ficha-editar" aria-label={`Editar a ${p.nombre}`} title="Editar personaje" onClick={() => editarPersonaje(p)}>
          <Icono d={UI.lapiz} />
        </button>
        <h1>{p.nombre}</h1>
        <span className="ficha-sub">{p.raza}{p.trasfondo ? ` · Trasfondo: ${p.trasfondo}` : ''}</span>
        <svg viewBox="0 0 90 90" width="84" height="84" aria-hidden="true">
          <path d="M45 6l10 18 20-4-6 20 15 10-17 8 4 20-19-8-7 16-7-16-19 8 4-20-17-8 15-10-6-20 20 4z" fill="#120f0b" stroke="#a88a4c" strokeWidth="1.2" />
          <path d="M45 24l13 7v14c0 9-6 15-13 19-7-4-13-10-13-19V31z" fill={`color-mix(in srgb, ${p.color} 22%, #0c0a08)`} stroke="#e2c27a" strokeWidth="1.4" />
          <path d="M45 32v22M38 40h14" stroke="#e2c27a" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className="ficha-nivel">Nivel {nivel} · {clases}</span>
        <div className="ficha-px" title={pxSig ? `Siguiente nivel con ${fmtNum(pxSig)} PX` : 'Nivel máximo'}>
          <span>PX</span>
          <div><div style={{ width: `${progreso * 100}%` }} /></div>
          <span>{fmtNum(px)}{pxSig ? ` / ${fmtNum(pxSig)}` : ''}</span>
        </div>
      </header>

      <div className="stats">
        {CARACTERISTICAS.map(([k, t]) => {
          const v = p[k];
          return (
            <div key={k} aria-label={`${t} ${v}, modificador ${conSigno(modificador(v))}`}>
              <span>{t}</span>
              <b>{v}</b>
              <span style={{ color: v >= 12 ? '#9cc95e' : v < 10 ? '#e0883a' : '#cfc3aa' }}>{conSigno(modificador(v))}</span>
            </div>
          );
        })}
      </div>

      <div className="ficha-bloque">
        <h3 className="titulo-sec">Condiciones</h3>
        <div className="etiquetas">
          {p.condiciones.length === 0 && <span className="vacio">Ninguna</span>}
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
      <div className="ficha-bloque">
        <h3 className="titulo-sec">Resistencias</h3>
        <div className="etiquetas">
          {p.resistencias.length === 0 && <span className="vacio">Ninguna</span>}
          {p.resistencias.map((r) => <span key={r} className="cond">{r}</span>)}
        </div>
      </div>
      <div className="ficha-bloque">
        <h3 className="titulo-sec">Rasgos destacados</h3>
        <ul className="rasgos">
          {(p.rasgos ?? []).map((r) => {
            const ic = ICONO_RASGO[r.icono ?? 'estrella'];
            const usos = r.usosMax != null ? `${r.usos ?? r.usosMax} / ${r.usosMax}` : '';
            return (
              <li key={r.nombre} title={r.recarga ? `Se recupera: ${r.recarga}` : undefined}>
                <span className="rasgo-ic" style={{ color: ic.c }}><Icono d={ic.d} size={14} /></span>
                <span className="rasgo-n">{r.nombre}</span>
                <span className="rasgo-u">{[r.detalle, usos].filter(Boolean).join(' ')}</span>
              </li>
            );
          })}
          {!p.rasgos?.length && <li className="vacio">Sin rasgos anotados</li>}
        </ul>
      </div>
    </section>
  );
}

// ── Equipo ─────────────────────────────────────────────────────────

function Equipo({ p, busqueda }: { p: Personaje; busqueda: string }) {
  const { estado, cambiarImagen } = useCofre();
  const sintonia = useSintonia();
  const { props } = useInteraccion(busqueda, sintonia);
  const fichero = useRef<HTMLInputElement>(null);
  const eq = (r: 'cuerpoACuerpo' | 'distancia') => equipadoEn(estado, p.id, r, 0);
  const armaCaC = eq('cuerpoACuerpo'), armaDist = eq('distancia');
  const atqM = ataque(p, armaCaC, 'cuerpoACuerpo');
  const atqR = ataque(p, armaDist, 'distancia');
  const sint = sintonizadosDe(estado, p.id);
  const silueta = SILUETA_ARMA[(armaCaC ?? armaDist)?.icono as ClaveIcono];

  const ranura = (r: Parameters<typeof RanuraEquipo>[0]['ranura'], i: number, ic: ClaveIcono, etiqueta?: string) => (
    <RanuraEquipo key={r + i} p={p} ranura={r} indice={i} fantasma={ic} etiqueta={etiqueta} busqueda={busqueda} extra="big" onDoble={sintonia} />
  );

  return (
    <section className={`equipo ${p.imagenUrl ? 'con-fondo' : ''}`} aria-label="Equipo" style={{ '--tinte': p.color } as CSSProperties}>
      {p.imagenUrl && <img className="fondo-pj" src={p.imagenUrl} alt={`Imagen de ${p.nombre}`} />}
      <div className="equipo-aura" aria-hidden="true" />
      {p.imagenUrl ? null : (
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
        onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) cambiarImagen(p.id, await guardarImagen(f, 'personaje')); }}
      />

      <div className="equipo-izq">{IZQ.map(([r, ic]) => ranura(r, 0, ic))}</div>
      <div className="equipo-dcha">{DCHA.map(([r, i, ic]) => ranura(r, i, ic))}</div>

      <div className="equipo-armas">
        <div>
          <span className="lbl">Cuerpo a cuerpo</span>
          <div className="par">{ranura('cuerpoACuerpo', 0, 'sword', 'Mano principal')}{ranura('cuerpoACuerpo', 1, 'shield', 'Mano secundaria')}</div>
          <div className="atq"><b>{atqM ? conSigno(atqM.bono) : '—'}</b><span>{atqM ? `${atqM.dano} ${atqM.tipo ?? ''}` : 'Sin arma'}</span></div>
        </div>
        <div className="ca grande" aria-label={`Clase de armadura ${p.ca}`}>
          <svg viewBox="0 0 76 84" width="96" height="106" aria-hidden="true">
            <path d="M38 3l32 10v26c0 20-14 34-32 42C20 73 6 59 6 39V13z" fill="#0f0c0a" stroke="#b89a55" strokeWidth="1.4" />
            <path d="M38 9l26 8v22c0 16-11 28-26 35C23 67 12 55 12 39V17z" fill="none" stroke="#4d3e25" />
            <path d="M30 6l8-5 8 5" fill="none" stroke="#e2c27a" strokeWidth="1.2" />
          </svg>
          <span>CA</span>
          <span>{p.ca}</span>
        </div>
        <div>
          <span className="lbl">A distancia</span>
          <div className="par">{ranura('distancia', 0, 'bow')}{ranura('distancia', 1, 'dagger', 'Mano secundaria')}</div>
          <div className="atq"><span>{atqR ? `${atqR.dano} ${atqR.tipo ?? ''}` : 'Sin arma'}</span><b>{atqR ? conSigno(atqR.bono) : '—'}</b></div>
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

/** Por qué no cabe lo que se arrastra sobre el inventario. */
function AvisoNoCabe({ p }: { p: Personaje }) {
  const { validar } = useCofre();
  const clave = `pj:${p.id}`;
  const id = useArrastreSel((a) => {
    if (!a || claveBase(a.objetivo?.clave ?? '') !== clave) return '';
    return a.objeto.propietario.tipo === 'personaje' && a.objeto.propietario.id === p.id ? '' : a.objeto.id;
  });
  const v = id ? validar(id, { propietario: { tipo: 'personaje', id: p.id } }) : null;
  return v && !v.ok ? <div className="aviso error inv-aviso" role="alert">{v.motivo}</div> : null;
}

function Inventario({ p, busqueda }: { p: Personaje; busqueda: string }) {
  const { estado, validar, ordenar } = useCofre();
  const acciones = useObjetos();
  const sintonia = useSintonia();
  const [cat, setCat] = useState(0);
  const dueno: Propietario = { tipo: 'personaje', id: p.id };

  const inventario = objetosDe(estado, { tipo: 'personaje', id: p.id }).filter((o) => !o.equipadoEn);
  const filtro = CATEGORIAS[cat].cat;
  // Con «Todo», cada objeto en su celda (se ordena a mano arrastrando); con un filtro, solo los que coinciden
  const celdasInv = filtro
    ? [...colocar(inventario, 0, 1).filter((o) => o?.categoria === filtro), ...Array(168)].slice(0, Math.max(168, inventario.length))
    : colocar(inventario, 168, 12);

  const peso = pesoPersonajeKg(estado, p);
  const max = cargaMaxKg(p.fue);
  const tramo = tramoCarga(peso, max);

  const clave = `pj:${p.id}`;

  return (
    <section className="panel inventario" aria-label={`Inventario de ${p.nombre}`}>
      <Esquinas />
      <header>
        <h2>Inventario <span>· {inventario.length} objetos</span></h2>
        <MenuBoton className="chip chip-i" etiqueta="Ordenar inventario" lado="dcha" opciones={[{ titulo: 'Ordenar por' }, ...opcionesOrden(ordenar, dueno)]}>
          <Icono d={UI.ordenar} />Ordenar
        </MenuBoton>
        <button type="button" className="chip on chip-i" onClick={() => acciones.nuevo(dueno)}>
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
      <RejillaObjetos
        className="rejilla ind" data-drop={clave} aria-label={`Objetos de ${p.nombre}`}
        celdas={celdasInv} dueno={dueno} porCelda={!filtro} busqueda={busqueda} onDoble={sintonia}
        puedeSoltar={(o) => validar(o.id, { propietario: dueno }).ok}
      />
      <AvisoNoCabe p={p} />

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
