// Party compartida: crearla con los datos de este navegador, entrar con un código o salir.

import { useState } from 'react';
import { useCofre } from '../store/cofre';
import { useEscape } from './Dialogos';
import { UI } from './iconos';
import { Esquinas, Icono } from './piezas';

export function DialogoParty({ onCerrar, avisar }: { onCerrar: () => void; avisar: (texto: string, error?: boolean) => void }) {
  const { sync } = useCofre();
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  useEscape(onCerrar);

  const enlace = sync.codigo ? `${window.location.origin}${window.location.pathname}?party=${sync.codigo}` : '';
  const hacer = async (f: () => Promise<void>) => { setOcupado(true); await f(); setOcupado(false); };

  return (
    <>
      <div className="velo" onClick={onCerrar} />
      <section role="dialog" aria-modal="true" aria-labelledby="pt-t" className="panel dialogo party-dialogo">
        <Esquinas />
        <header><h2 id="pt-t">Party compartida</h2></header>

        {!sync.disponible ? (
          <p>
            La sincronización no está configurada. Hay que crear el archivo <code>.env</code> con
            <code> VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> y ejecutar
            <code> supabase/esquema.sql</code> (lo explica el README). Mientras tanto, los datos se guardan solo en este navegador.
          </p>
        ) : sync.codigo ? (
          <>
            <p>Estáis jugando con la misma party. Cada cambio se guarda y les llega al resto al momento.</p>
            <div className="party-codigo" aria-label={`Código ${sync.codigo}`}>{sync.codigo}</div>
            <div className="party-enlace">
              <input readOnly value={enlace} aria-label="Enlace para invitar" onFocus={(e) => e.target.select()} />
              <button
                type="button" className="btn sec"
                onClick={() => { void navigator.clipboard?.writeText(enlace).then(() => avisar('Enlace copiado')).catch(() => avisar('No se pudo copiar el enlace', true)); }}
              >
                <Icono d={UI.enlace} size={16} /> Copiar enlace
              </button>
            </div>
            <div className="acciones">
              <button type="button" className="btn peligro-sec" onClick={() => { sync.salir(); avisar('Has salido de la party compartida'); onCerrar(); }}>Salir de la party</button>
              <button type="button" className="btn pri" onClick={onCerrar}>Hecho</button>
            </div>
          </>
        ) : (
          <>
            <p>Ahora los datos solo están en este navegador. Comparte la party para que todos veáis y mováis lo mismo.</p>
            <div className="party-opciones">
              <div>
                <span className="k">Crear</span>
                <p>Sube la party de este navegador y te da un código para el resto.</p>
                <button type="button" className="btn pri" disabled={ocupado} onClick={() => void hacer(sync.crear)}>Crear party compartida</button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); void hacer(() => sync.unirse(codigo)); }}>
                <span className="k">Unirse</span>
                <p>Escribe el código que te ha pasado otro jugador.</p>
                <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={12} aria-label="Código de la party" />
                <button type="submit" className="btn sec" disabled={ocupado || !codigo.trim()}>Entrar</button>
              </form>
            </div>
          </>
        )}
        {sync.error && <span className="ed-error" role="alert">{sync.error}</span>}
        {(!sync.disponible || !sync.codigo) && <div className="acciones"><button type="button" className="btn sec" onClick={onCerrar}>Cerrar</button></div>}
      </section>
    </>
  );
}
