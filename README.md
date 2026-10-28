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
- Tooltip de objeto, avisos de movimiento, búsqueda que atenúa lo que no coincide e imagen de personaje subida desde el botón de la cámara, que hace de fondo de la columna (y de la zona de equipo en la vista individual).
- Vista individual: ficha (características, PX, condiciones, resistencias y rasgos), equipo grande con indicador de sintonización e inventario con filtros por categoría y orden por rareza, peso, valor o reciente. Se elige el personaje en los retratos.
- Sintonizar: doble clic en un objeto que lo requiere (también en los rombos de sintonización para quitarla). Con 3 ya sintonizados pide cuál sustituir.
- Soltar un objeto sobre un retrato se lo da a ese personaje.

- Monedas (se abre pulsando el tesoro de la barra superior): tesoro común con ingresar y retirar (Mayús = de 10 en 10), cambio exacto de monedas, historial, monedas por personaje con ingresos y retiradas (desde o hacia el tesoro, o monedas nuevas/gastadas), repartir botín moneda a moneda o convertido a la moneda más alta, y carga de cada personaje y de la party. Un reparto que deje a alguien con sobrepeso se bloquea.

- Estadísticas: tarjeta por personaje (características, ataques, resistencias, condiciones —incluidos hambre y carga cuando tienen efecto— y valor, peso y objetos por rareza), radar de características con leyenda que oculta personajes, y barras de valor del inventario y de carga sobre el máximo. «Objetos» cuenta pilas, no unidades.

- Despensa: hambre de cada personaje con su efecto, botón «Comer» con la comida elegida o arrastrando comida sobre la fila del personaje, y la comida de toda la party agrupada en raciones, platos e ingredientes. Comer gasta 1 unidad: primero de lo que lleva quien come, después del alijo y por último de otro personaje. «Reservas» calcula los días de comida y «Pasar un día» resta 25 de saciedad a todos (este botón no está en el diseño).

- Menú de cada personaje (las tres rayas): ver ficha, editar personaje, añadir objeto, ordenar su inventario y cambiar o quitar la imagen.
- Añadir, editar y eliminar objetos con el formulario del diseño y vista previa en vivo. Se añaden desde el menú del personaje, el «+» del alijo o «Añadir objeto» en la vista individual; clic derecho sobre un objeto abre Editar, Sintonizar, Dar a… y Eliminar (con confirmación).
- Orden manual: cada objeto se puede arrastrar a cualquier celda de su inventario (si está ocupada, se intercambian; si es la misma pila, se juntan). Con un filtro de categoría activo se ve la lista compacta y no se recoloca.
- Orden automático por rareza, tipo, valor, peso o nombre (menú del personaje, «Ordenar» del alijo y de la vista individual). Al ordenar se juntan las pilas iguales.
- Añadir personaje con el «+» de los retratos (hasta 5) y editar o eliminar personajes; al eliminar uno, lo que llevaba pasa al alijo.

- Vista grande de un objeto: un clic (sin arrastrar) en cualquier ranura la abre, con la imagen en grande y toda la ficha (daño y ataque calculados, cargas, habilidades, descripción, notas, sintonización). Desde ahí se sube, cambia o quita la imagen y se va a Editar. En objetos con doble clic (sintonizar) espera un instante para distinguir los dos gestos.
- Biblioteca de objetos (pestaña propia): cada objeto deja una ficha con su descripción, habilidades e imagen al crearlo o editarlo (y los que ya había, al cargar). La ficha se conserva aunque el objeto se borre, se gaste o se coma; muestra quién lo tiene ahora o quién lo tuvo por última vez, y desde ella se recupera para un personaje o el alijo (con las cargas llenas y comprobando la carga). Solo se puede quitar de la biblioteca lo que ya no tiene nadie. Un objeto nuevo con el mismo nombre y rareza que una ficha se enlaza con ella sin borrar lo que la ficha ya sabía.
- Bestiario (pestaña propia): criaturas con las que se ha enfrentado la party, con su imagen en grande. Solo el nombre es obligatorio; lo que no se sabe (PV, una característica, la tercera acción que aún no ha usado…) se deja vacío y la ficha lo muestra como «sin descubrir», con huecos de habilidad explícitos. Actitud agresiva, no agresiva o desconocida; bloque de estadísticas (CA, PV, velocidad, VD con sus PX, características, defensas, sentidos e idiomas), rasgos, acciones, reacciones y acciones legendarias, notas, dónde se la encontró y contadores de encuentros y abatidas. El botín se elige de la biblioteca (o como texto libre) y se ve con el icono, imagen y rareza del objeto; pulsarlo abre el objeto en grande para recuperarlo. Las criaturas de ejemplo solo aparecen en partidas nuevas.
- Las pestañas «Inventario grupal» e «Inventarios individuales» se muestran como «Grupal» e «Individual» para que quepan todas; el nombre completo sigue al pasar el ratón y para lectores de pantalla.

- Datos compartidos por toda la party: publicada en claude.ai, la app guarda todo en la base de datos del propio artefacto (capacidad `db`) y cada cambio llega en vivo a quien la tenga abierta. La primera vez, el dueño sube los datos de su navegador o empieza con los de ejemplo. Un visor que solo puede leer ve la partida pero no puede cambiarla (se le avisa). Bajo el nombre de la app se ve el estado: «Compartido con la party», «Guardando…», «solo lectura» o «Sin compartir».

Pendiente: crafteo.

## Datos

Publicada en claude.ai, la partida vive en la base de datos compartida del artefacto (`src/store/compartido.ts`, `src/store/documentos.ts`): un documento por personaje, objeto, ficha de la biblioteca y criatura, las imágenes en documentos propios (como mucho 256 KiB cada uno: las imágenes se reducen hasta caber) y la party, los movimientos y el registro de monedas en tres más. Cada cambio escribe solo los documentos que cambian; si dos personas cambian lo mismo a la vez, gana la última escritura de ese documento. Quién puede escribir lo decide el menú «Compartir» del artefacto (ver «Compartir con la party» abajo).

Fuera de claude.ai (desarrollo, fichero suelto), o hasta que el dueño sube los datos, todo vive en el navegador (`localStorage`), empezando por los datos de ejemplo de `src/data/semilla.ts`, que amplían `datos-ejemplo.json` con los objetos del diseño. Para volver a empezar, borra los datos del sitio en el navegador (hace falta para ver los platos de la despensa que se añadieron a los datos de ejemplo).

Toda la lectura y escritura pasa por `src/store/cofre.tsx`. Las reglas están en `src/domain/reglas.ts` como funciones puras.

Las imágenes: quien puede editar el artefacto (Editor o dueño) las sube al almacén de archivos del artefacto (capacidad `assets`, hasta 20 MiB por archivo), grandes y con calidad alta (objetos 1200 px, personajes 1600 px, criaturas 2400 px; `src/store/archivos.ts`), y en los datos queda la ruta `/_blob/<id>`. Para los demás, y fuera de claude.ai, se guardan como data URL reducida. Al escribir en `localStorage` las repetidas (la de un objeto y la de su ficha en la biblioteca) se guardan una sola vez (`src/store/imagenes.ts`). Las de objeto se reducen a 640 px de lado; con muchas imágenes el límite de unos 5 MB de `localStorage` se puede llenar, y entonces la sesión sigue en memoria pero no se guarda.

## Compartir con la party

Para que los demás puedan escribir (y no solo mirar), en el menú «Compartir» del artefacto:

- En un plan personal, invita a cada jugador por correo como **Editor** y quita el acceso «cualquiera con el enlace»: mientras el enlace público esté activo, los invitados de fuera de la organización solo pueden leer.
- En un plan de equipo (Team/Enterprise), los miembros de la organización que abren el artefacto escriben salvo que su nivel sea de solo lectura.

Todos necesitan una cuenta de claude.ai con la sesión iniciada; sin sesión no se ven los datos compartidos.

## Supuestos

- Todos los personajes son competentes con sus armas equipadas.
- Las armas arrojadizas en la ranura «A distancia» usan FUE; las sutiles, la mejor de FUE y DES.
- La CA es un dato del personaje; no se recalcula con el equipo.
- Las dos ranuras «Cuerpo a cuerpo» son mano principal y secundaria (escudo).
