// Ficha flotante de un objeto al pasar el ratón por su ranura.

import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { DES_MAX_POR_TIPO, NOMBRE_TIPO_ARMADURA } from '../domain/catalogo';
import { describirMod, nombrePropiedad } from '../domain/describir';
import { objetoActivo } from '../domain/efectos';
import { ataqueDeObjeto } from '../domain/hoja';
import {
  capital, CLASE_RAREZA, conSigno, MAX_SINTONIZADOS, nombreDe, NOMBRE_RANURA, SACIEDAD_MAX, sintonizadosDe,
} from '../domain/reglas';
import type { Objeto } from '../domain/tipos';
import { usable } from '../domain/uso';
import { useCofre } from '../store/cofre';
import { useArrastre } from './arrastre';
import { ALTO, useLienzo } from './lienzo';
import { claseDe } from './iconos';
import { Esquinas, fmt1, fmtNum, Ranura } from './piezas';

type Pos = { objeto: Objeto; left: number; top: number };

const C = createContext<{ mostrar: (o: Objeto, el: Element) => void; ocultar: () => void }>({ mostrar: () => {}, ocultar: () => {} });
export const useTooltip = () => useContext(C);

const ANCHO = 372;

export function TooltipProvider({ lienzo, escala, children }: { lienzo: RefObject<HTMLDivElement>; escala: number; children: ReactNode }) {
  const [pos, setPos] = useState<Pos | null>(null);
  const anchoLienzo = useLienzo().ancho;
  const { arrastre } = useArrastre();

  const mostrar = useCallback((objeto: Objeto, el: Element) => {
    const base = lienzo.current?.getBoundingClientRect();
    if (!base) return;
    const r = el.getBoundingClientRect();
    const x = (r.left - base.left) / escala, y = (r.top - base.top) / escala, w = r.width / escala;
    const left = x + w + 12 + ANCHO > anchoLienzo - 20 ? x - ANCHO - 12 : x + w + 12;
    setPos({ objeto, left, top: Math.max(84, Math.min(y - 20, ALTO - 470)) });
  }, [lienzo, escala, anchoLienzo]);

  const ocultar = useCallback(() => setPos(null), []);

  return (
    <C.Provider value={{ mostrar, ocultar }}>
      {children}
      {pos && !arrastre && <FichaObjeto objeto={pos.objeto} left={pos.left} top={pos.top} />}
    </C.Provider>
  );
}


function FichaObjeto({ objeto: o0, left, top }: Pos) {
  // Si con todo su contenido no cabe hasta abajo, sube lo justo
  const ref = useRef<HTMLDivElement>(null);
  const [arriba, setArriba] = useState(top);
  useLayoutEffect(() => {
    const alto = ref.current?.offsetHeight ?? 0;
    setArriba(Math.max(84, Math.min(top, 1072 - alto)));
  }, [top, o0.id]);
  const { estado } = useCofre();
  const o = estado.objetos.find((x) => x.id === o0.id) ?? o0;
  const dueno = o.propietario.tipo === 'personaje' ? estado.personajes.find((p) => p.id === (o.propietario as { id: string }).id) : undefined;
  const atq = dueno ? ataqueDeObjeto(estado, dueno, o) : null;
  const activo = objetoActivo(o);
  const arm = o.armadura;
  const props = [...(o.propiedades ?? []).map((p) => nombrePropiedad(o, p)), ...(o.otrasPropiedades ?? [])];
  if (o.tipoArma) props.unshift(o.tipoArma === 'marcial' ? 'Marcial' : 'Sencilla');
  const sint = dueno ? sintonizadosDe(estado, dueno.id).length : 0;

  const sub = [claseDe(o), capital(o.rareza)];
  if (o.equipadoEn) sub.push('Equipada');

  const [titEfecto, ...restoEfecto] = (o.efectos ?? '').split(/(?<=\.)\s/);

  return (
    <div ref={ref} role="tooltip" className={`panel tooltip ${CLASE_RAREZA[o.rareza]}`} style={{ left, top: arriba }}>
      <Esquinas solo="arriba" />
      <div className="tt-cab">
        <Ranura objeto={{ ...o, cantidad: 1 }} extra="hov" aria-hidden="true" />
        <div>
          <span className="tt-nombre">{o.nombre}{o.cantidad > 1 ? ` ×${o.cantidad}` : ''}</span>
          <span className="tt-sub">
            {sub.map((s, i) => (
              <span key={i}>{i > 0 && ' · '}<span style={i === 1 ? { color: 'var(--rc)' } : undefined}>{s}</span></span>
            ))}
          </span>
        </div>
      </div>
      <svg viewBox="0 0 330 10" width="336" height="10" aria-hidden="true"><path d="M0 5h150M180 5h150" stroke="#4d3e25" /><path d="M165 1l4 4-4 4-4-4z" fill="#b89a55" /></svg>

      {o.dado && (
        <div className="tt-dano">
          <b>{atq ? atq.dano.replace(/([+−])/, ' $1 ') : o.dado}</b>
          <span>{o.tipoDano}{atq ? ` · ${conSigno(atq.bono.total)} al ataque` : ''}{!atq && o.bonoMagico ? ` · +${o.bonoMagico} mágica` : ''}</span>
        </div>
      )}
      {atq?.bono.desv?.length ? <span className="tt-extra mal">Desventaja al atacar: {atq.bono.desv.join(', ')}</span> : null}
      {(atq?.extras ?? o.danosExtra ?? []).map((x, i) => (
        <span key={i} className="tt-extra">+{x.dado}{x.tipo ? ` ${x.tipo}` : ''}{x.condicion ? ` ${x.condicion}` : ''}</span>
      ))}
      {atq && atq.critico < 20 && <span className="tt-extra">Crítico con {atq.critico}–20</span>}
      {arm && (
        <div className="tt-dano">
          <b>{arm.tipo === 'ropa' ? '—' : arm.caBase}</b>
          <span>
            CA · {NOMBRE_TIPO_ARMADURA[arm.tipo]}
            {arm.tipo !== 'ropa' && (() => { const t = arm.desMax !== undefined ? arm.desMax : DES_MAX_POR_TIPO[arm.tipo]; return t == null ? ' + DES' : t === 0 ? '' : ` + DES (máx. ${t})`; })()}
            {o.bonoMagico ? ` · +${o.bonoMagico} mágica` : ''}
          </span>
        </div>
      )}
      {arm?.fueMin ? <span className="tt-extra">Requiere FUE {arm.fueMin}{dueno && dueno.fue < arm.fueMin ? ' · −10 pies de velocidad' : ''}</span> : null}
      {arm?.sigiloDesventaja && <span className="tt-extra mal">Desventaja en Sigilo</span>}
      {o.bonoCa ? <span className="tt-extra">+{o.bonoCa + (o.bonoMagico ?? 0)} a la CA</span> : null}
      {props.length > 0 && <div className="tt-chips">{props.map((p) => <span key={p}>{p}</span>)}</div>}
      {!!o.modificadores?.length && (
        <ul className={`tt-mods ${activo ? '' : 'inactivo'}`}>
          {o.modificadores.map((m, i) => <li key={i}>{describirMod(m)}</li>)}
          {!activo && <li className="tt-nota">{o.requiereSintonizacion && !o.sintonizado ? 'No hace efecto hasta sintonizarlo' : o.ranuraEquipo ? 'Hace efecto al equiparlo' : 'Hace efecto al llevarlo un personaje'}</li>}
        </ul>
      )}
      {o.efectos && (
        <p>{restoEfecto.length ? <><b>{titEfecto}</b> {restoEfecto.join(' ')}</> : o.efectos}</p>
      )}
      {o.descripcion && <p>{o.descripcion}</p>}
      {o.categoria === 'Comida' && (
        <div className="tt-fila"><span>Saciedad</span><span>{o.saciedad ? `+${o.saciedad} de ${SACIEDAD_MAX} por unidad` : 'No se come sola'}</span></div>
      )}
      {o.cargasMax ? (
        <div className="tt-fila">
          <span>Cargas</span>
          <span className="cargas">
            {Array.from({ length: Math.min(o.cargasMax, 10) }, (_, i) => <i key={i} className={i < (o.cargas ?? 0) ? 'llena' : ''} />)}
            <span style={{ marginLeft: 6, color: 'var(--texto)' }}>{o.cargas ?? 0}/{o.cargasMax}{o.recarga ? ` · ${o.recarga.toLowerCase()}` : ''}</span>
          </span>
        </div>
      ) : null}
      {o.requiereSintonizacion && (
        <div className="tt-sint">
          <span className="rombo" />
          Requiere sintonización · {o.sintonizado ? `Sintonizada (${sint}/${MAX_SINTONIZADOS})` : 'Sin sintonizar'}
        </div>
      )}
      {o.ranuraEquipo && !o.equipadoEn && (
        <div className="tt-fila"><span>Se equipa en</span><span>{NOMBRE_RANURA[o.ranuraEquipo]}</span></div>
      )}
      <div className="tt-usar">
        {[
          'Clic: ficha',
          o.requiereSintonizacion && (!o.sintonizado || !usable(o)) ? `Doble clic: ${o.sintonizado ? 'desintonizar' : 'sintonizar'}`
            : usable(o) ? `Doble clic: ${o.categoria === 'Comida' ? 'comer' : o.cargasMax ? 'usar (1 carga)' : 'usar (gasta 1)'}` : '',
          'Clic derecho: más opciones',
        ].filter(Boolean).join(' · ')}
      </div>
      <div className="tt-pie">
        <span>{dueno ? <>Lo tiene <b>{dueno.nombre}</b></> : <b>{nombreDe(estado, o.propietario)}</b>}</span>
        <span style={{ display: 'flex', gap: 14 }}>
          <span>{fmt1(o.pesoKg * o.cantidad)} kg</span>
          <span style={{ color: '#e8c46c' }}>{fmtNum(o.valorPo * o.cantidad)} PO</span>
        </span>
      </div>
    </div>
  );
}
