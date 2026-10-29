# Decisiones del proyecto

Respuestas a las decisiones abiertas del §8 de `HANDOFF.md`.

| # | Decisión | Respuesta |
|---|---|---|
| 1 | Stack | React + Vite (frontend) y Supabase (Postgres, almacenamiento de imágenes y tiempo real). Despliegue estático en Vercel o Netlify. Se reutiliza el CSS del bloque `<helmet><style>` de los `.dc.html`. |
| 2 | Autenticación y permisos | Sin cuentas. Cualquiera con el enlace o código de la party puede hacerlo todo. El historial de movimientos guarda el nombre que el jugador elige al entrar. |
| 3 | Datos e imágenes | Base de datos Postgres de Supabase; imágenes de personajes y objetos en Supabase Storage. |
| 4 | Reglas caseras | Carga en kg (máximo ≈ FUE × 6,8 kg, con los tramos de 5e) y monedas que pesan (50 monedas = 0,45 kg). El hambre pasa a ser el «hambre de mazmorra» de 0 a 7 (ver README), en lugar de la escala de 0 a 100. |
| 5 | Catálogo de objetos | Siempre a mano (objetos caseros), con un formulario por tipo de objeto y modificadores libres que se aplican solos. Las armas y armaduras del manual sirven solo como plantilla para rellenar. |
| 6 | Móvil | Sin preguntar todavía; por defecto, solo escritorio, como el diseño. |
