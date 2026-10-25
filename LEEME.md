# Página de Axol Studio

Página estática para GitHub Pages con panel para publicar noticias, streamers en vivo,
la historia de Voragos 1 y donaciones. Las noticias también llegan al botón NOTICIAS de AXOL Launcher.

## Páginas
- `index.html` — Axol Studio (inicio)
- `voragos2.html` — Voragos II: noticias, aventureros (con quién está en vivo) y cómo unirse
- `voragos1.html` — la historia de Voragos I (capítulos que escribes desde el panel)
- `donar.html` — formas de apoyar
- `admin.html` — tu panel (no aparece en el menú; guárdalo en favoritos)

## Datos (los edita el panel)
- `data/noticias.json`, `data/streamers.json`, `data/voragos1.json`, `data/donaciones.json`, `data/sitio.json`
- `feed/noticias.xml` — lo lee AXOL Launcher (se regenera solo al publicar noticias)

## Instalación (una sola vez)
1. En GitHub crea un repositorio público llamado exactamente `axolstudios.github.io`.
2. Sube todo el contenido de esta carpeta (Add file → Upload files, arrastra todo).
3. Settings → Pages → Source: "Deploy from a branch", rama `main`, carpeta `/ (root)`.
4. La página queda en https://axolstudios.github.io/
5. Crea la llave del panel (instrucciones dentro de admin.html) y conéctate.

## Conectar las noticias con AXOL Launcher
En `voragos-repo/meta/distrometa.json` pon:

    "rss": "https://axolstudios.github.io/feed/noticias.xml"

y ejecuta `publicar.bat`. Desde entonces publica noticias solo desde el panel
(ya no uses NUEVA-NOTICIA.bat, porque vuelve a poner el feed viejo).

## Para el mod de "EN VIVO" en el TAB
El mod del servidor puede leer https://axolstudios.github.io/data/streamers.json
Cada streamer tiene `nick` (nombre en Minecraft) y `envivo` = { "plataforma", "desde" } o null.
Se considera en vivo si `desde` tiene menos de 12 horas.
