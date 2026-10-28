// Estado de la conexión con la party (bajo el nombre de la app) y el diálogo para subir los datos la
// primera vez, cuando la base de datos compartida aún está vacía.

import { useState } from 'react';
import { useCofre } from '../store/cofre';
import { useEscape } from './Dialogos';
import { UI } from './iconos';
import { Esquinas, Icono } from './piezas';

/** Línea de estado bajo «Cofre de la Compañía». */
export function EstadoParty({ onSubir }: { onSubir: () => void }) {
  const { compartido: c } = useCofre();
  if (c.modo === 'local') return <span>Inventario de la party</span>;
  if (c.modo === 'conectando') return <span className="ep-estado conectando">Conectando con la party…</span>;
  if (c.modo === 'vacio') {
    return (
      <button type="button" className="ep-estado vacio" onClick={onSubir} title="Subir los datos para compartirlos con la party">
        Sin compartir · subir datos
      </button>
    );
  }
  if (c.soloLectura) return <span className="ep-estado lectura" title="Pide al dueño que te dé acceso de editor">Compartido · solo lectura</span>;
  return <span className={`ep-estado ok ${c.pendientes ? 'guardando' : ''}`}>{c.pendientes ? 'Guardando…' : 'Compartido con la party'}</span>;
}

export function SubirDatos({ onCerrar }: { onCerrar: () => void }) {
  const { estado, compartido: c } = useCofre();
  const [progreso, setProgreso] = useState<{ hechos: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEscape(() => { if (!progreso) onCerrar(); });

  const subir = async (origen: 'navegador' | 'ejemplo') => {
    setError(null);
    setProgreso({ hechos: 0, total: 0 });
    const r = await c.subir(origen, (hechos, total) => setProgreso({ hechos, total }));
    setProgreso(null);
    if (!r.ok) setError(r.motivo);
    else onCerrar();
  };

  const n = (x: unknown[] | undefined) => x?.length ?? 0;
  const puede = c.puedeEscribir !== false;
  return (
    <>
      <div className="velo arriba" onClick={() => { if (!progreso) onCerrar(); }} />
      <section role="dialog" aria-modal="true" aria-labelledby="sd-t" className="panel dialogo arriba sd">
        <Esquinas />
        <header>
          <h2 id="sd-t">Compartir con la party</h2>
        </header>
        <p>
          La base de datos de la party está vacía. Cuando alguien suba los datos, todos los que abran este enlace verán
          y cambiarán el mismo inventario, en vivo.
        </p>
        {puede ? (
          <>
            <div className="sd-opciones">
              <button type="button" className="sd-opcion" disabled={!!progreso} onClick={() => subir('navegador')}>
                <Icono d={UI.subir} />
                <b>Subir los datos de este navegador</b>
                <span>{n(estado.personajes)} personajes · {n(estado.objetos)} objetos · {n(estado.biblioteca)} en la biblioteca · {n(estado.bestiario)} criaturas</span>
              </button>
              <button type="button" className="sd-opcion" disabled={!!progreso} onClick={() => subir('ejemplo')}>
                <Icono d={UI.cofre} />
                <b>Empezar con los datos de ejemplo</b>
                <span>La party de Aldric, Nerys, Brom e Ysolde, para probar</span>
              </button>
            </div>
            <p className="sd-nota">Solo hace falta que lo haga una persona. Lo que haya en los navegadores de los demás no se mezcla: se queda como copia local.</p>
          </>
        ) : (
          <p className="sd-nota">Tu acceso es de solo lectura: pide al dueño del cofre que suba los datos o que te dé acceso de editor.</p>
        )}
        {progreso && (
          <div className="sd-progreso" role="status">
            <div><div style={{ width: progreso.total ? `${(progreso.hechos / progreso.total) * 100}%` : '4%' }} /></div>
            <span>{progreso.total ? `Subiendo ${progreso.hechos} de ${progreso.total}…` : 'Preparando las imágenes…'}</span>
          </div>
        )}
        {error && <p className="fo-error" role="alert">{error}</p>}
        <div className="acciones">
          <button type="button" className="btn sec" disabled={!!progreso} onClick={onCerrar}>Ahora no</button>
        </div>
      </section>
    </>
  );
}
