// Ficha flotante de un objeto al pasar el ratón por su ranura.

import { createContext, useCallback, useContext, useState, type ReactNode, type RefObject } from 'react';
import {
  ataque, CLASE_RAREZA, MAX_SINTONIZADOS, nombreDe, NOMBRE_RANURA, sintonizadosDe,
} from '../domain/reglas';
import type { Objeto } from '../domain/tipos';
import { useCofre } from '../store/cofre';
import { useArrastre } from './arrastre';
import { Esquinas, fmt1, fmtNum, Ranura } from './piezas';

type Pos = { objeto: Objeto; left: number; top: number };

const C = createContext<{ mostrar: (o: Objeto, el: Element) => void; ocultar: () => void }>({ mostrar: () => {}, ocultar: () => {} });
export const useTooltip = () => useContext(C);

const ANCHO = 372;

export function TooltipProvider({ lienzo, escala, children }: { lienzo: RefObject<HTMLDivElement>; escala: number; children: ReactNode }) {
  const [pos, setPos] = useState<Pos | null>(null);
  const { arrastre } = useArrastre();

  const mostrar = useCallback((objeto: Objeto, el: Element) => {
    const base = lienzo.current?.getBoundingClientRect();
    if (!base) return;
    const r = el.getBoundingClientRect();
    const x = (r.left - base.left) / escala, y = (r.top - base.top) / escala, w = r.width / escala;
    const left = x + w + 12 + ANCHO > 1900 ? x - ANCHO - 12 : x + w + 12;
    setPos({ objeto, left, top: Math.max(84, Math.min(y - 20, 1080 - 470)) });
  }, [lienzo, escala]);

  const ocultar = useCallback(() => setPos(null), []);

  return (
    <C.Provider value={{ mostrar, ocultar }}>
      {children}
      {pos && !arrastre && <FichaObjeto objeto={pos.objeto} left={pos.left} top={pos.top} />}
    </C.Provider>
  );
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function FichaObjeto({ objeto: o0, left, top }: Pos) {
  const { estado } = useCofre();
  const o = estado.objetos.find((x) => x.id === o0.id) ?? o0;
  const dueno = o.propietario.tipo === 'personaje' ? estado.personajes.find((p) => p.id === (o.propietario as { id: string }).id) : undefined;
  const ranuraArma = o.ranuraEquipo === 'distancia' ? 'distancia' : 'cuerpoACuerpo';
  const atq = o.dado && dueno ? ataque(dueno, o, ranuraArma) : null;
  const sint = dueno ? sintonizadosDe(estado, dueno.id).length : 0;

  const sub = [o.subtipo ? capital(o.subtipo) : o.categoria, capital(o.rareza)];
  if (o.equipadoEn) sub.push('Equipada');

  const [titEfecto, ...restoEfecto] = (o.efectos ?? '').split(/(?<=\.)\s/);

  return (
    <div role="tooltip" className={`panel tooltip ${CLASE_RAREZA[o.rareza]}`} style={{ left, top }}>
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
          <span>{o.tipoDano}{atq ? ` · ${atq.bono >= 0 ? '+' : '−'}${Math.abs(atq.bono)} al ataque` : ''}</span>
        </div>
      )}
      {o.extraDano && <span className="tt-extra">{o.extraDano}</span>}
      {o.bonoCa ? <span className="tt-extra">+{o.bonoCa} a la CA</span> : null}
      {!!o.propiedades?.length && (
        <div className="tt-chips">{o.propiedades.map((p) => <span key={p}>{p}</span>)}</div>
      )}
      {o.efectos && (
        <p>{restoEfecto.length ? <><b>{titEfecto}</b> {restoEfecto.join(' ')}</> : o.efectos}</p>
      )}
      {o.descripcion && <p>{o.descripcion}</p>}
      {o.saciedad ? <div className="tt-fila"><span>Saciedad</span><span>+{o.saciedad} por unidad</span></div> : null}
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
