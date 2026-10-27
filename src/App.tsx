import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Destino } from './domain/reglas';
import type { Objeto } from './domain/tipos';
import { useCofre } from './store/cofre';
import { ArrastreProvider } from './ui/arrastre';
import { DividirPila, QuienEres, SintoniaProvider } from './ui/Dialogos';
import { AvisoActual, Grupal, PieGrupal, type Aviso } from './ui/Grupal';
import { Individual } from './ui/Individual';
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
  const { estado, actor, mover } = useCofre();
  const escala = useEscala();
  const lienzo = useRef<HTMLDivElement>(null);
  const [pestana, setPestana] = useState<Pestana>('grupal');
  const [activo, setActivo] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [dividir, setDividir] = useState<{ objeto: Objeto; destino: Destino } | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [quien, setQuien] = useState(!actor);

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

  const soltar = useCallback((objeto: Objeto, destino: Destino, conMayus: boolean) => {
    const mismoSitio =
      !destino.equipar && !objeto.equipadoEn &&
      JSON.stringify(destino.propietario) === JSON.stringify(objeto.propietario);
    if (mismoSitio) return;
    if (conMayus && objeto.cantidad > 1) {
      setDividir({ objeto, destino });
      return;
    }
    const v = mover(objeto.id, destino);
    if (!v.ok) setAviso({ id: Date.now(), tipo: 'error', texto: v.motivo });
  }, [mover]);

  const titulo = PESTANAS.find((t) => t.id === pestana)!.label;

  return (
    <div className="visor">
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
            <Topbar activa={pestana} onPestana={setPestana} busqueda={busqueda} onBusqueda={setBusqueda} />
            <Retratos activo={activo} onActivo={(id) => { setActivo(id); setPestana('individual'); }} />

            <SintoniaProvider onAviso={avisar}>
            {pestana === 'grupal' ? (
              <>
                <Grupal busqueda={busqueda} />
                <PieGrupal aviso={aviso} />
              </>
            ) : pestana === 'individual' ? (
              <>
                <Individual personajeId={activo} busqueda={busqueda} />
                <div className="avisos-flot"><AvisoActual aviso={aviso} /></div>
              </>
            ) : (
              <section className="pronto">
                <h2>{titulo}</h2>
                <p>Esta pantalla todavía no está construida. De momento solo funciona el inventario grupal.</p>
                <button type="button" className="btn sec" onClick={() => setPestana('grupal')}>Volver al inventario grupal</button>
              </section>
            )}
            </SintoniaProvider>

            {dividir && (
              <DividirPila
                objeto={dividir.objeto}
                destino={dividir.destino}
                onCancelar={() => setDividir(null)}
                onMover={(n) => {
                  const v = mover(dividir.objeto.id, dividir.destino, n);
                  if (!v.ok) setAviso({ id: Date.now(), tipo: 'error', texto: v.motivo });
                  setDividir(null);
                }}
              />
            )}
            {quien && <QuienEres onCerrar={() => setQuien(false)} />}
          </TooltipProvider>
        </div>
      </ArrastreProvider>
    </div>
  );
}
