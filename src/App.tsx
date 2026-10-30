import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Destino } from './domain/reglas';
import type { Objeto } from './domain/tipos';
import { useCofre } from './store/cofre';
import { ArrastreProvider, type Objetivo } from './ui/arrastre';
import { CtxAvisar } from './ui/avisos';
import { Bestiario } from './ui/Bestiario';
import { Biblioteca } from './ui/Biblioteca';
import { BandejaDados, MesaDados } from './ui/Dados';
import { Despensa } from './ui/Despensa';
import { DetalleProvider } from './ui/DetalleObjeto';
import { DividirPila, QuienEres, SintoniaProvider } from './ui/Dialogos';
import { EditorPersonajeProvider } from './ui/EditorPersonaje';
import { DialogoParty } from './ui/Party';
import { EditorProvider } from './ui/EditorObjeto';
import { Estadisticas } from './ui/Estadisticas';
import { FiltrosProvider } from './ui/filtrosCtx';
import { AvisoActual, Grupal, PieGrupal, type Aviso } from './ui/Grupal';
import { Individual } from './ui/Individual';
import { MenuProvider } from './ui/Menu';
import { PantallaMonedas } from './ui/Monedas';
import { PESTANAS, Retratos, Topbar, type Pestana } from './ui/Marco';
import { TooltipProvider } from './ui/Tooltip';

const ANCHO = 1920, ALTO = 1080;

/** El diseño es de escritorio a 1920×1080: se escala el lienzo entero para que quepa en la ventana. */
function useEscala() {
  const calc = () => Math.min(window.innerWidth / ANCHO, window.innerHeight / ALTO);
  const [k, setK] = useState(calc);
  useLayoutEffect(() => {
    const f = () => setK(calc());
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return k;
}

export default function App() {
  const { estado, actor, mover, comer, sync } = useCofre();
  const escala = useEscala();
  const lienzo = useRef<HTMLDivElement>(null);
  const [pestana, setPestana] = useState<Pestana>('grupal');
  const [activo, setActivo] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [dividir, setDividir] = useState<{ objeto: Objeto; destino: Destino } | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [quien, setQuien] = useState(!actor);
  const [party, setParty] = useState(false);

  // Cada movimiento nuevo se anuncia en el pie
  const ultimo = estado.movimientos[0]?.id;
  const visto = useRef(ultimo);
  useEffect(() => {
    if (ultimo && ultimo !== visto.current) setAviso({ id: Date.now(), tipo: 'mov', movId: ultimo });
    visto.current = ultimo;
  }, [ultimo]);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  const avisar = useCallback((texto: string, error?: boolean) => {
    setAviso({ id: Date.now(), tipo: error ? 'error' : 'info', texto });
  }, []);

  // Otro jugador guardó antes algo que choca con un cambio de este: se avisa de que no se ha aplicado
  useEffect(() => {
    if (sync.descartes) avisar('Otro jugador ha cambiado eso antes que tú: tu último cambio no se ha aplicado', true);
  }, [sync.descartes, avisar]);

  const soltar = useCallback((objeto: Objeto, objetivo: Objetivo, conMayus: boolean) => {
    // En la despensa, soltar comida sobre un personaje es dársela de comer
    if (objetivo.comer) {
      const p = estado.personajes.find((x) => x.id === objetivo.comer);
      if (objeto.categoria !== 'Comida' || !p) { avisar(`${objeto.nombre} no se come`, true); return; }
      const r = comer(p.id, objeto.id);
      avisar(r.ok ? r.texto : r.motivo, !r.ok);
      return;
    }
    const destino = objetivo.destino!;
    const mismoSitio =
      !destino.equipar && !objeto.equipadoEn && destino.posicion === undefined &&
      JSON.stringify(destino.propietario) === JSON.stringify(objeto.propietario);
    if (mismoSitio) return;
    if (conMayus && objeto.cantidad > 1) {
      setDividir({ objeto, destino });
      return;
    }
    const v = mover(objeto.id, destino, undefined, objeto.propietario);
    if (!v.ok) setAviso({ id: Date.now(), tipo: 'error', texto: v.motivo });
  }, [estado.personajes, mover, comer, avisar]);

  const titulo = PESTANAS.find((t) => t.id === pestana)?.label ?? '';
  const flotante = (clase = 'abajo') => <div className={`avisos-flot ${clase}`}><AvisoActual aviso={aviso} /></div>;

  return (
    <div className="visor">
      <CtxAvisar.Provider value={avisar}>
      <FiltrosProvider>
      <ArrastreProvider escala={escala} onSoltar={soltar}>
        <div ref={lienzo} className="lienzo" style={{ transform: `scale(${escala})`, left: (window.innerWidth - ANCHO * escala) / 2 }}>
          <svg className="grano" aria-hidden="true" width={ANCHO} height={ALTO}>
            <filter id="grain">
              <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves={3} stitchTiles="stitch" />
              <feColorMatrix values="0 0 0 0 .55  0 0 0 0 .45  0 0 0 0 .32  0 0 0 .09 0" />
            </filter>
            <rect width={ANCHO} height={ALTO} filter="url(#grain)" />
          </svg>
          <div className="vineta" aria-hidden="true" />

          <TooltipProvider lienzo={lienzo} escala={escala}>
          <MenuProvider lienzo={lienzo} escala={escala}>
            <Topbar activa={pestana} onPestana={setPestana} busqueda={busqueda} onBusqueda={setBusqueda} onParty={() => setParty(true)} />
            <EditorPersonajeProvider onAviso={avisar}>
            <EditorProvider onAviso={avisar}>
            <SintoniaProvider onAviso={avisar}>
            <DetalleProvider onAviso={avisar}>
            <Retratos activo={activo} onActivo={(id) => { setActivo(id); setPestana('individual'); }} />
            {pestana === 'grupal' ? (
              <>
                <Grupal busqueda={busqueda} onVerFicha={(id) => { setActivo(id); setPestana('individual'); }} />
                <PieGrupal aviso={aviso} />
              </>
            ) : pestana === 'individual' ? (
              <>
                <Individual personajeId={activo} busqueda={busqueda} avisar={avisar} />
                {flotante('')}
              </>
            ) : pestana === 'monedas' ? (
              <>
                <PantallaMonedas avisar={avisar} />
                {flotante()}
              </>
            ) : pestana === 'despensa' ? (
              <>
                <Despensa avisar={avisar} busqueda={busqueda} />
                {flotante()}
              </>
            ) : pestana === 'estadisticas' ? (
              <>
                <Estadisticas />
                {flotante()}
              </>
            ) : pestana === 'biblioteca' ? (
              <>
                <Biblioteca busqueda={busqueda} />
                {flotante()}
              </>
            ) : pestana === 'bestiario' ? (
              <>
                <Bestiario busqueda={busqueda} />
                {flotante()}
              </>
            ) : (
              <section className="pronto">
                <h2>{titulo}</h2>
                <p>Esta pantalla todavía no está construida.</p>
                <button type="button" className="btn sec" onClick={() => setPestana('grupal')}>Volver al inventario grupal</button>
              </section>
            )}
            </DetalleProvider>
            </SintoniaProvider>
            </EditorProvider>
            </EditorPersonajeProvider>

            {dividir && (
              <DividirPila
                objeto={dividir.objeto}
                destino={dividir.destino}
                onCancelar={() => setDividir(null)}
                onMover={(n) => {
                  const v = mover(dividir.objeto.id, dividir.destino, n, dividir.objeto.propietario);
                  if (!v.ok) setAviso({ id: Date.now(), tipo: 'error', texto: v.motivo });
                  setDividir(null);
                }}
              />
            )}
            <BandejaDados />
            {quien && <QuienEres onCerrar={() => setQuien(false)} />}
            {party && <DialogoParty onCerrar={() => setParty(false)} avisar={avisar} />}
          </MenuProvider>
          </TooltipProvider>
        </div>
        <MesaDados escala={escala} />
      </ArrastreProvider>
      </FiltrosProvider>
      </CtxAvisar.Provider>
    </div>
  );
}
