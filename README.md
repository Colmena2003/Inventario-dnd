# Cofre de la Compañía

Inventario compartido para una party de D&D 5e. El diseño y el modelo están en [HANDOFF.md](HANDOFF.md); las decisiones tomadas, en [DECISIONES.md](DECISIONES.md).

## Arrancar

Hace falta Node 20 o superior.

```bash
npm install
npm run dev
```

Se abre en http://localhost:5173. Otros comandos: `npm test` (reglas de negocio) y `npm run build`.

## Estado

Hecho:

- Sistema visual del diseño (`src/styles/sistema.css`) e iconos (`src/ui/iconos.ts`).
- Vista grupal: columnas de 3 a 5 personajes, equipo, CA, ataque y daño calculados, inventario, carga y alijo con filtros.
- Arrastrar y soltar entre personajes, alijo y ranuras de equipo, con validación de carga y de ranura. Mayús al soltar abre «Dividir pila».
- Tooltip de objeto, avisos de movimiento, búsqueda que atenúa lo que no coincide e imagen de personaje subida desde el botón de la cámara.

Pendiente: las demás pestañas, añadir personajes, sintonizar, monedas, despensa, crafteo, estadísticas y Supabase.

## Datos

De momento todo vive en el navegador (`localStorage`), empezando por los datos de ejemplo de `src/data/semilla.ts`, que amplían `datos-ejemplo.json` con los objetos del diseño. Para volver a empezar, borra los datos del sitio en el navegador.

Toda la lectura y escritura pasa por `src/store/cofre.tsx`, que es lo que habrá que cambiar para usar Supabase. Las reglas están en `src/domain/reglas.ts` como funciones puras.

## Supuestos

- Todos los personajes son competentes con sus armas equipadas.
- Las armas arrojadizas en la ranura «A distancia» usan FUE; las sutiles, la mejor de FUE y DES.
- La CA es un dato del personaje; no se recalcula con el equipo.
- Las dos ranuras «Cuerpo a cuerpo» son mano principal y secundaria (escudo).
