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

- Sistema visual del diseño (`src/styles/sistema.css`). Iconos de interfaz de línea (`src/ui/iconos.ts`) e iconos de objetos, clases, bestiario y marca de [game-icons.net](https://game-icons.net) (`src/ui/iconosJuego.ts`), de Lorc, Delapouite y Faithtoken, con licencia [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/); el crédito sale también en la configuración de la app.
- Vista grupal: una columna por personaje (más anchas con 2 o 3), equipo, CA, ataque y daño calculados, inventario, saciedad y carga al pie, y alijo con filtros.
- Arrastrar y soltar entre personajes, alijo y ranuras de equipo, con validación de carga y de ranura. Mayús al soltar abre «Dividir pila».
- Tooltip de objeto, avisos de movimiento, búsqueda que atenúa lo que no coincide e imagen de personaje subida desde el botón de la cámara.
- Vista individual: ficha (características, PX, condiciones, resistencias y rasgos), equipo grande con indicador de sintonización e inventario con filtros por categoría y orden por rareza, peso, valor o reciente. Se elige el personaje en los retratos.
- Sintonizar: doble clic en un objeto que lo requiere (también en los rombos de sintonización para quitarla). Con 3 ya sintonizados pide cuál sustituir.
- Soltar un objeto sobre un retrato se lo da a ese personaje.

- Monedas (se abre pulsando el tesoro de la barra superior): tesoro común con ingresar y retirar (Mayús = de 10 en 10), cambio exacto de monedas, historial, monedas por personaje con ingresos y retiradas (desde o hacia el tesoro, o monedas nuevas/gastadas), repartir botín moneda a moneda o convertido a la moneda más alta, y carga de cada personaje y de la party. Un reparto que deje a alguien con sobrepeso se bloquea.

- Objetos con efecto real (`src/domain/hoja.ts`): características, CA, ataque y daño, salvaciones, habilidades, pasivas, iniciativa, velocidades, PV máximos, CD y ataque de conjuros, sentidos, carga, resistencias, inmunidades, ventajas y desventajas. Cada objeto lleva una lista de modificadores (sumar o «pasa a ser al menos», como el Amuleto de la salud) que se aplican mientras está equipado y, si lo pide, sintonizado. Pasando el ratón por un valor se ve de dónde sale.
- Armas con las propiedades de 5e programadas: sutil (mejor de FUE y DES), arrojadiza, munición (DES), versátil (dado mayor con la otra mano libre), a dos manos (libera la mano secundaria y no deja equipar nada en ella), ligera (ataque con la mano secundaria sin modificador al daño), pesada (desventaja si eres Pequeño), alcance, recarga, plateada y adamantina. Bonos mágicos, daño adicional y rango de crítico. Sin sintonizar, un arma que lo pide no suma su magia.
- Armaduras con CA base, tope de DES por tipo (la pesada no suma DES), FUE mínima (−10 pies) y desventaja en Sigilo. También pueden ir en la cabeza, las manos o los pies: entonces suman su CA como un escudo. Escudos; defensa sin armadura de bárbaro y monje.
- Añadir objeto en dos pasos: primero el tipo (arma, armadura, escudo, prenda o accesorio, poción, pergamino, comida, material, munición, misión, varios) y después un formulario a medida, con plantillas de las armas y armaduras del manual y una vista previa de cómo cambia al personaje. Cada icono dice qué es (Casco, Espada…) y elegirlo lleva la armadura o el accesorio a su ranura. Clic derecho en cualquier objeto para editarlo o eliminarlo.
- Despensa con el hambre de mazmorra (ver Supuestos), comer, paso del tiempo y descansos. La comida enseña su imagen.
- Estadísticas en cuatro vistas: Resumen (tarjetas, hexágono de características con leyenda para ocultar personajes y combate comparado: CA, PV, mejor ataque, daño medio, iniciativa, percepción, velocidad y CD), ¿Quién tira? (el mejor bono de la party en cada habilidad, salvación y pasiva), Equipo y riqueza (valor del equipo por dueño, rarezas, sintonización, lo más valioso y la magia que no está haciendo efecto) y Desglose (de dónde sale cada número).

- Usar objetos: doble clic (o «Usar» en su editor) gasta una carga o una unidad, tira los dados de «Efectos» y, si dice «Recuperas XdY PV», cura sin pasar del máximo. Lo del alijo lo usa el jugador que maneja la app. Un objeto puede además dar un efecto temporal a quien lo usa («Al usarlo» en el editor). Los descansos de la despensa recuperan cargas según su «Recarga» («Al amanecer», «1d6+1 al amanecer», «Descanso corto», «2 cargas…») y los usos de los rasgos.
- Efectos temporales en la ficha: conjuros y pociones habituales (Bendecir, Escudo de la fe, Acelerar, Fuerza de gigante…) o uno a mano, con modificadores, duración en rondas, minutos u horas, hasta un descanso o hasta quitarlo, y concentración. Cambian la hoja como un objeto. «Pasa 1 ronda / 1 min / 10 min / 1 h» baja las duraciones; un descanso corto cuenta 1 h y uno largo 8 h. El mismo efecto se renueva, no se acumula.
- Editor de personajes (lápiz de la ficha, clic derecho en un retrato o «+» bajo los retratos): identidad, clases y multiclase, características, PV, velocidad, tamaño, CA extra, defensa sin armadura, característica de conjuros, salvaciones, competencias y pericias, resistencias, condiciones y rasgos con usos. Enseña la hoja resultante mientras editas. Quitar a un personaje deja su equipo en el alijo y sus monedas en el tesoro.
- Party compartida con Supabase (botón con el código de la barra superior). Ver Datos.
- PV rápidos en la ficha: daño, curación y ±1, sin bajar de 0 ni pasar del máximo.
- Biblioteca de objetos: una ficha por cada objeto conocido, que se guarda sola al crearlo o editarlo. Filtros por quién lo tiene (en la party o nadie) y categoría; cada carta abre la ficha grande y permite recuperar el objeto para alguien o quitarlo de la biblioteca.
- Bestiario: criaturas con actitud, CA, PV, velocidad, desafío y PX, características, defensas y sentidos, rasgos y acciones (también «sin descubrir»), botín enlazado a la biblioteca, lugar, notas, imagen y contador de encuentros y abatidas. Solo el nombre es obligatorio.
- Ficha grande de objeto con un clic: imagen (subir, cambiar o quitar), datos, efectos, descripción, y botones de usar, sintonizar y editar. Clic derecho: menú con ver, editar, usar, sintonizar, dar a otro personaje o al alijo y eliminar (con confirmación).
- Rejillas con posición: se suelta un objeto en la celda que se quiera (si está ocupada por otro del mismo dueño, se cambian) y «Ordenar» junta pilas y las ordena por rareza, tipo, valor, peso o nombre.
- La imagen del personaje sirve de fondo de su columna y de su equipo; iconos de clase en la ficha y las columnas; menú de opciones de cada columna.
- Despensa: arrastrar comida sobre un personaje se la da de comer.
- Espacios de conjuro en la ficha, calculados con las tablas de 5e (multiclase incluida) y la magia del pacto del brujo; se gastan con un clic y vuelven con los descansos (el corto, solo los del pacto). Se pueden ajustar a mano en el editor para subclases lanzadoras.
- Filtros de búsqueda (embudo de la barra): rareza, categoría, mágicos, con sintonización, equipados, usables y con cargas. Lo que no cumple se atenúa en todas las pantallas.
- Configuración de cada jugador (engranaje de la barra): color del tema (Oro, Esmeralda, Zafiro, Amatista, Carmesí, Plata u otro). Se guarda en su navegador y no cambia lo que ven los demás.
- Las imágenes que ya no usa nadie (retratos cambiados, subidas canceladas) se borran solas del almacenamiento pasada una hora.

Pendiente: crafteo.

## Datos

Sin party compartida, todo vive en el navegador (`localStorage`) y se empieza con la party vacía. La party de ejemplo de `src/data/semilla.ts` (que amplía `datos-ejemplo.json` con los objetos del diseño) solo la usan los tests. Para volver a empezar, borra los datos del sitio en el navegador.

Cuando cambia el formato de los datos se sube `VERSION_MODELO` (`src/domain/objetos.ts`) y `migrar` pone al día lo guardado (por ejemplo, la velocidad de metros a pies). La migración solo cambia el formato, nunca el contenido.

### Sincronizar entre jugadores (Supabase)

1. En el SQL Editor del proyecto de Supabase, ejecuta [supabase/esquema.sql](supabase/esquema.sql): crea la tabla `parties`, sus permisos, el tiempo real y el bucket `imagenes`.
2. Copia `.env.example` como `.env` y pon la Project URL y la anon key (Project Settings → API). Son públicas; **nunca** pongas la contraseña de la base de datos.
3. Reinicia `npm run dev`. La web entra sola en la party de la mesa (`PARTY_POR_DEFECTO` en [src/config.ts](src/config.ts), o la variable `VITE_PARTY`): basta con pasar el enlace de la web. El botón con el código de la barra superior abre «Party compartida», donde se puede salir, crear otra o entrar en otra con su código (`?party=CODIGO`).

Cada cambio es una función pura del estado (`src/store/cofre.tsx`). Se ve al momento y se guarda con «actualiza si la versión sigue siendo N»; si otro jugador guardó antes, se descarga su versión y se reaplica encima. Lo que ya no vale se descarta y se avisa a quien lo hizo: mover un objeto que otro acaba de mover, gastar la última carga o comer la última ración. Probado con dos jugadores actuando en el mismo milisegundo: los cambios compatibles se suman todos y de los incompatibles gana uno solo, sin duplicar nada. Detalles en `src/store/sincro.ts`. Las imágenes se suben al bucket. Sin cuentas: quien tenga el código puede leer y cambiar la party.

Las reglas están en `src/domain/` como funciones puras (`reglas.ts`, `hoja.ts`, `uso.ts`, `personajes.ts`, `biblioteca.ts`, `bestiario.ts`, `conjuros.ts`, `filtros.ts`).

## Supuestos

- Todos los personajes son competentes con sus armas y armaduras equipadas.
- Hambre de mazmorra [casera]: saciedad de 0 a 7. Baja 1 cada 30–90 min (botón «Pasa el tiempo», lo decide el DM), 1 con un descanso corto y 4 con uno largo, que solo se puede empezar con 4 o más. Efectos acumulados: con 3, desventaja en pruebas de característica (−5 a las pasivas); con 2, velocidad a la mitad; con 1, desventaja en ataques y salvaciones; con 0, PV máximos a la mitad. Cada comida dice cuántos puntos llena.
- Las salvaciones competentes y la característica de conjuros salen de la clase; la velocidad va en pies: 30, o 25 para enanos, medianos y gnomos. Las razas con visión en la oscuridad la tienen a 18 m.
- Las armas arrojadizas en la ranura «A distancia» usan FUE; las sutiles, la mejor de FUE y DES.
- Las dos ranuras «Cuerpo a cuerpo» son mano principal y secundaria (escudo).
