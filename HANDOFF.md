# Traspaso: Inventario compartido para una party de D&D

Este documento es para un agente de código (Claude Code) que va a construir la aplicación a partir de un diseño ya cerrado. Lo escribió el asistente que hizo el diseño. Léelo entero antes de proponer arquitectura.

## 1. Qué es

Una aplicación web de escritorio (diseñada a 1920×1080) para que una party de 3 a 5 jugadores de D&D 5e gestione su inventario compartido. Está en español. La estética imita la atmósfera de los inventarios de Baldur's Gate 3: fondo casi negro, marcos de filigrana dorada, rejillas de ranuras y colores por rareza. Todo el arte es original: no hay logotipos, iconos ni imágenes del juego, y así debe seguir.

Funciones principales:

- vista grupal con una columna por personaje y un alijo común;
- arrastrar objetos entre personajes, al alijo o a ranuras de equipo;
- vista individual con ficha de personaje;
- alta, edición y detalle de objetos;
- monedas personales y tesoro común, con reparto de botín;
- control de carga;
- despensa y hambre;
- crafteo con recetas;
- estadísticas comparativas.

## 2. Contenido del paquete

| Ruta | Qué es |
|---|---|
| `HANDOFF.md` | Este documento. |
| `capturas/*.png` | Captura a 1920×1080 de cada pantalla. Es la referencia visual de verdad. |
| `diseno/*.dc.html` | Fuente del diseño, una pantalla por archivo. |
| `diseno/support.js` | Runtime que interpreta los `.dc.html`. Solo sirve para abrirlos en un navegador. |
| `datos-ejemplo.json` | Datos de ejemplo de la party que aparecen en el diseño. |

### Cómo usar los `.dc.html`

**No son componentes de producción.** Son archivos de un editor de diseño: HTML con estilos en línea y plantillas `{{hueco}}`, `<sc-for>` y `<sc-if>`, más una clase JS `Component extends DCLogic` que interpreta `support.js` (React por debajo). No los portes tal cual.

Úsalos para tres cosas:

1. Copiar valores exactos: colores, tamaños, espaciados, sombras, rutas SVG de los iconos y el CSS del bloque `<helmet><style>`, que se puede reutilizar casi directo.
2. Leer la estructura de cada pantalla.
3. Abrirlos en el navegador. Sirve la carpeta `diseno/` con un servidor estático (por ejemplo `python3 -m http.server`) y abre `Main.dc.html`. Las fuentes cargan desde Google Fonts.

Los iconos de objetos son trazos SVG en un `viewBox` de 24×24, guardados como cadenas `d` en un objeto `IC` dentro del script de cada archivo (el de `Main.dc.html` es el más completo). Se pueden extraer a un módulo de iconos.

## 3. Sistema visual (tokens)

- **Fuentes:** Cinzel (títulos, nombres y cifras de CA), Alegreya (texto y descripciones) y Alegreya Sans (datos). Todas de Google Fonts.
- **Base:** fondo `#0D0B09`, panel `#16120E`, borde `#5E4C2C`, oro `#B89A55`, oro claro `#E2C27A`, texto `#E8DFCC`, texto secundario `#B9AB90`, pestaña activa `#1F5560` (degradado hasta `#113139`).
- **Rareza** (borde, halo y color del nombre):

  | Rareza | Color |
  |---|---|
  | Común | `#CFC8BA` |
  | Poco común | `#5FCF6D` |
  | Raro | `#55A3FF` |
  | Muy raro | `#B874FF` |
  | Legendario | `#F5A93C` |
  | Artefacto | `#EC4652` |

  En CSS son las variables `--rc` (color) y `--rg` (halo, con alfa) de las clases `.r-c`, `.r-u`, `.r-r`, `.r-m`, `.r-l` y `.r-a`.
- **Estados de ranura** (clases `.slot`):
  - vacía;
  - fantasma (ranura de equipo libre, icono atenuado);
  - con objeto, que muestra un contador de cantidad abajo a la derecha y un rombo dorado arriba a la izquierda si el objeto requiere sintonización;
  - hover: halo del color de rareza y sube 1 px en 160 ms;
  - arrastrando: escala 1,12, giro de −7° y sombra larga;
  - origen del arrastre: borde punteado;
  - destino válido (`#73E281`) y destino no válido (`#EF5A55`).
- **Marcos:** los paneles (`.panel`) tienen doble borde interior y esquinas ornamentales SVG (`.cn`).
- **Saciedad:** Saciado `#9CC95E`, Normal `#C9A65A`, Hambriento `#E0883A`, Famélico `#E0534D`.
- **Carga:** Normal `#C9A65A`, Cargado `#E0883A`, Sobrecargado `#E0534D`.

## 4. Pantallas

Cada pantalla tiene su captura en `capturas/` y su fuente en `diseno/` con el mismo nombre.

Todas las pantallas comparten dos piezas: `Topbar.dc.html`, la barra superior, y `Retratos.dc.html`, la barra lateral de retratos.

- **Barra superior:** nombre de la app («Cofre de la Compañía»), cinco pestañas (Inventario grupal, Inventarios individuales, Estadísticas, Crafteo, Despensa), el tesoro común con las cinco monedas, el buscador «Buscar objetos…» y un botón de filtros.
- **Barra lateral:** un retrato por personaje con los PV actuales y máximos, una barra de PV, una barra de saciedad y el botón para añadir personaje. Abajo, la carga total de la party.

1. **Main – Vista grupal.** Una columna por personaje, que se adapta de 3 a 5, más el «Alijo de la party».
   - Cada columna lleva: nombre, oro personal, raza, clase, nivel y PV, y la barra de saciedad.
   - En el centro, la imagen subida por el jugador. En el diseño es una silueta de relleno.
   - Alrededor de la imagen, las ranuras de equipo:
     - a la izquierda: cabeza, capa, armadura, guantes y botas;
     - a la derecha: amuleto y dos anillos;
     - abajo: dos ranuras cuerpo a cuerpo y dos a distancia.
   - Debajo del equipo: emblema de CA, bono de ataque y daño de cada arma, rejilla de inventario de 7×5 y barra de carga.
   - La pantalla muestra además un tooltip abierto, la leyenda de rarezas y una notificación de movimiento.
2. **Grupal-arrastre – Arrastre en curso.** Mientras se arrastra, todas las columnas indican si aceptan el objeto: verde si sí, rojo si no, con el motivo («Sobrepeso: 69,0 kg supera su máximo de 68 kg»). Las ranuras de equipo incompatibles se atenúan y el hueco de origen queda punteado.
3. **Dividir-pila.** Modal «¿Cuántas pociones mover?» con stepper, deslizador, atajos (1 / Mitad / Todas) y una vista previa de la carga del destino. Es interactivo.
4. **Individual – Vista individual.**
   - Izquierda: la ficha, con raza, clase y nivel, PX, las 6 características con su modificador, condiciones, resistencias y rasgos.
   - Centro: imagen grande, equipo, CA, botón «Cambiar imagen del personaje» e indicador de sintonización (3 ranuras).
   - Derecha: inventario con filtros por categoría, ordenación, carga por tramos y monedas personales.
5. **Estados.**
   - personaje sin imagen;
   - inventario vacío;
   - alijo vacío;
   - sobrepeso;
   - intento de sintonizar un 4.º objeto, donde hay que elegir cuál deja de estar sintonizado;
   - confirmación de borrado;
   - notificaciones apiladas.
6. **Sistema.** Hoja con los tokens, los estados de ranura, la tipografía, los botones y las escalas de saciedad, carga y monedas.
7. **Objeto-editar.** Formulario de alta y edición con vista previa en vivo de la ranura y del tooltip. Los campos están en el modelo de datos (§5).
8. **Objeto-detalle.** Vista de solo lectura de un objeto con efectos, descripción, notas de la party, historial de movimientos y las acciones Eliminar, Editar, Dar a… y Equipar y sintonizar.
9. **Monedas.** Tesoro común con botones de ingresar y retirar, tabla de monedas por personaje con su total en PO, la herramienta «Repartir botín» (interactiva) y la carga de cada personaje y de la party.
10. **Despensa.** Saciedad de cada personaje con un botón «Comer» que usa el alimento seleccionado (interactivo; también se puede arrastrar comida sobre el retrato) y la comida agrupada en raciones, platos e ingredientes, cada una con su valor de saciedad.
11. **Crafteo.** Materiales agrupados (hierbas, minerales, partes de criaturas, reactivos), libro de recetas que marca cada ingrediente como disponible o faltante, y una mesa de crafteo con el resultado en el centro y los ingredientes alrededor. Al seleccionar una receta se carga en la mesa (interactivo).
12. **Estadísticas.** Una tarjeta por personaje (datos básicos, combate e inventario por rareza), un radar hexagonal de las 6 características con leyenda que se puede ocultar, y barras de valor del inventario y de carga.

## 5. Modelo de datos (propuesta)

Lo deduje del diseño. Es una propuesta, no un esquema cerrado.

- **Party:** `id`, `nombre`, `tesoro` (`{ppt, po, pe, pp, pc}`), miembros.
- **Personaje:**
  - identidad: `id`, `partyId`, `jugadorId`, `nombre`, `raza`, `trasfondo`, `clases` (lista `{clase, nivel}`, para permitir multiclase), `px`;
  - vida y defensa: `pvActual`, `pvMax`, `ca`;
  - características: `fue`, `des`, `con`, `int`, `sab`, `car`;
  - estado: `condiciones[]`, `resistencias[]`, `rasgos[]` (`{nombre, usos, usosMax, recarga}`);
  - recursos: `imagenUrl` (opcional), `monedas` (`{ppt, po, pe, pp, pc}`), `saciedad` (de 0 a 100), `color` (para gráficas y retratos).
- **Objeto:**
  - descripción: `id`, `nombre`, `imagenUrl` (opcional), `icono` (clave del icono por defecto), `categoria`, `rareza`;
  - cantidad y valor: `cantidad`, `pesoKg` por unidad, `valorPo` por unidad;
  - sintonización: `requiereSintonizacion`, `sintonizado`;
  - equipo: `ranuraEquipo` (null o `cabeza`, `capa`, `armadura`, `guantes`, `botas`, `amuleto`, `anillo`, `cuerpoACuerpo`, `distancia`);
  - propiedades: `dano`, `bonoCa`, `cargas`, `cargasMax`, `recarga`, `efectos`, `descripcion`, `notas`;
  - ubicación: `propietario` (`{tipo: 'personaje', id} | {tipo: 'alijo'}`), `equipadoEn` (`null | {ranura, indice}`);
  - comida: `saciedad` (solo si la categoría es Comida);
  - registro: `creadoPor`, `fechas`.
- **Categorías:** Armas, Armaduras, Pociones, Pergaminos, Materiales, Comida, Llaves/misión y Varios. Comida tiene tres subtipos: ración, plato e ingrediente. Materiales tiene cuatro: hierba, mineral, parte de criatura y reactivo.
- **Rarezas:** común, poco común, raro, muy raro, legendario y artefacto.
- **Receta:** `id`, `nombre`, `resultado` (plantilla de objeto y cantidad), `ingredientes[]` (`{nombreOPlantilla, cantidad}`), `herramienta`, `tiempo`, `cd`.
- **Movimiento (historial):** `id`, `objetoId`, `cantidad`, `origen`, `destino`, `actor` (jugador), `fecha`. Alimenta las notificaciones («X ha movido Y a Z») y el historial del detalle de objeto.

## 6. Reglas de negocio

Cada regla lleva su origen: **[5e]** es una regla del Manual del Jugador de D&D 5e (2014); **[casera]** es una propuesta mía, que el usuario debe confirmar.

- **Modificador de característica [5e]:** `floor((valor − 10) / 2)`.
- **Carga:** máximo = FUE × 15 lb **[5e]**. En la app se trabaja en kg, máximo ≈ FUE × 6,8 kg **[casera]**: la conversión y el redondeo son decisiones mías.
  - Tramos de la regla variante **[5e]**: más de FUE × 5 lb (⅓ del máximo) es **Cargado**, −10 pies (≈ −3 m) de velocidad; más de FUE × 10 lb (⅔ del máximo) es **Sobrecargado**, −20 pies (≈ −6 m) y desventaja en pruebas, ataques y salvaciones de FUE, DES y CON.
  - El peso es la suma de `pesoKg × cantidad` de lo que lleva el personaje, equipo incluido.
  - Las monedas pesan 50 monedas por libra, ≈ 0,45 kg **[5e]**. El diseño las suma a la carga; confirmarlo.
  - El alijo no cuenta para nadie (va en el carro).
- **Mover objetos:** se rechaza si el destino superaría su carga máxima o si la ranura de equipo no es compatible. Si se mueve una pila con cantidad mayor que 1, se abre el diálogo de dividir pila.
- **Sintonización [5e]:** máximo 3 objetos sintonizados por personaje. Al intentar el 4.º hay que elegir cuál se deja. Sintonizar requiere un descanso corto.
- **Monedas [5e]:** 1 PPT = 10 PO; 1 PE = ½ PO; 10 PP = 1 PO; 100 PC = 1 PO.
- **Repartir botín:** reparto a partes iguales, moneda a moneda, entre los personajes seleccionados. El resto de cada tipo va al tesoro común. También hay opciones para mandarlo todo al tesoro y para convertir a la moneda más alta.
- **Saciedad [casera]:** 5e no tiene barra de hambre. Escala de 0 a 100:

  | Estado | Rango | Efecto |
  |---|---|---|
  | Saciado | 75–100 | Ventaja en salvaciones contra agotamiento |
  | Normal | 40–74 | Sin efectos |
  | Hambriento | 15–39 | No recupera dados de golpe en descanso corto |
  | Famélico | 0–14 | +1 nivel de agotamiento al día |

  Baja 25 puntos por día de viaje. Comer suma la saciedad del alimento, con un tope de 100, y gasta 1 unidad.
- **Crafteo:** una receta está disponible si los materiales de la party y del alijo cubren todos los ingredientes. Se gastan primero los del alijo y después los de quien craftea. Lleva una prueba de herramienta con su CD. Qué pasa al fallar no está definido.

## 7. Operaciones que necesita la interfaz

- CRUD de party, personajes, objetos y recetas.
- Subida de imágenes de personaje y de objeto.
- Mover objetos con cantidad y validación de carga y ranura.
- Equipar y desequipar.
- Sintonizar, incluido el caso de sustituir uno.
- Ingresar y retirar monedas (personaje y tesoro); repartir botín.
- Comer (personaje + alimento).
- Craftear (receta + personaje).
- Búsqueda global y filtros por categoría, con ordenación por rareza, peso, valor o reciente.
- Agregados para estadísticas: valor de inventario, peso y conteo por rareza.
- **Tiempo real:** varios jugadores ven la misma party a la vez, así que los movimientos tienen que llegar a todos (notificaciones y refresco). Hace falta una suscripción (WebSocket, SSE o similar).

## 8. Decisiones abiertas (preguntar al usuario antes de construir)

1. Stack de frontend y backend, y si se reutiliza el CSS del diseño.
2. Autenticación y permisos: ¿puede cualquier jugador mover objetos de otro? ¿Hay un rol de DM?
3. Dónde se guardan los datos y las imágenes.
4. Reglas caseras: hambre, conversión a kg y si las monedas pesan.
5. Si los objetos se basan en un catálogo SRD o son siempre libres.
6. Si hace falta soporte de móvil (el diseño es solo de escritorio).

## 9. Datos de ejemplo

`datos-ejemplo.json` contiene la party del diseño: Aldric Varn (humano, paladín 5), Nerys Valtëa (elfa, maga 5), Brom Hierroforja (enano, clérigo 5) e Ysolde Mirra (mediana, pícara 5), con sus monedas, el tesoro común y algunos objetos. Todo es ficticio y sirve para pruebas.
