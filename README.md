# Analytics Traffic Scripts

> **APÉNDICE / AVISO.** Colección de scripts en **Node.js** escritos para **simular tráfico masivo y falsificar métricas**: inflar pageviews de un sitio de terceros (`ror.world`) e inyectar eventos en **Google Analytics 4**. **No los uses.** Se conservan únicamente como referencia (histórica / de qué se hizo y por qué está mal). Este README es explicativo, no una guía de uso.

---

## Qué es este repositorio

Cuatro scripts independientes que compartían una misma idea: **generar peticiones falsas a alta velocidad** para inflar contadores de analítica/tracking. Todos:

- Abusan de endpoints de **terceros** (no del dueño del script).
- **Falsifican la identidad** del visitante (IP, `User-Agent`, `Origin`, `Referer`, cookies).
- Optimizan para velocidad (conexiones `keep-alive`, alta concurrencia, DNS cacheado).

Es, en la práctica, un pequeño toolkit de **fraude de analítica** y de **estrés/DoS** contra un sitio ajeno.

## Archivos

| Archivo | Objetivo | Qué hacía | Técnica principal |
|---|---|---|---|
| `ror-sender-mach10.js` | `ror.world` → `POST /v1/track/add` | Hasta **50,000,000** de `page_view` falsos. | Concurrencia alta (150), IP cacheada por DNS, socket destruido al responder, `X-Forwarded-For`/`User-Agent`/`Origin`/`Referer` falsos. |
| `ror-sender-steady.js` | `download.ror.world` → `POST /v1/track/add` | Bucle infinito de visitas con baja concurrencia para **no disparar el WAF**. | Descarga la página, **extrae el `AUTH_TOKEN` y las cookies** del HTML, y las reenvía; spoof de `X-Forwarded-For`, `X-Real-IP`, `Client-IP`; pausas aleatorias. |
| `ror-sender-smart.js` | `ror.world` → `POST /v1/track/add` | Simula un **"funnel"** de usuario: `page_view`, `devotional_read`, `pdf_download`, `app_download` con probabilidades. | Concurrencia limitada con `keep-alive`, IPs y `User-Agent` aleatorios. |
| `traffic-GA4.js` | **GA4 Measurement Protocol** (`google-analytics.com/mp/collect`) | Envío masivo de `page_view` a GA4 con `measurement_id` + `api_secret`. | Agente `keep-alive` con hasta 1000 peticiones concurrentes, `client_id` aleatorio por evento. |

> El `measurement_id`/`api_secret` de GA4 que aparecía en `traffic-GA4.js` **ya no existe** (el property fue eliminado), así que ese script está muerto.

## Técnicas que usaban (por qué son abuso)

- **Spoofing de IP**: `X-Forwarded-For`, `X-Real-IP`, `Client-IP` con IPs aleatorias para parecer miles de visitantes distintos.
- **Identidad falsa**: `User-Agent`, `Origin`, `Referer` y cookies fabricadas.
- **Bypass de WAF/rate-limit**: baja concurrencia + `keep-alive` + cookies/token obtenidos de la propia web.
- **Amplificación**: decenas de millones de requests para inflar métricas y, de paso, cargar el servidor.

## Por qué NO se debe usar

- **Manipula métricas de un tercero**: es fraude de analítica.
- **Puede tumbar el servicio** (`ror-sender-smart.js` incluso comentaba "podrías tirar el sitio de nuevo"): eso es un ataque tipo DoS.
- **Falsifica identidad** (IP/headers), lo que agrava el abuso.
- Viola los términos de servicio de las plataformas y puede ser **ilegal** según la jurisdicción.

## Estado

- Repositorio **privado**, **sin licencia** y **no mantenido**.
- Objetivo original (`ror.world`) y el property de GA4 ya no son relevantes.
- Se conserva solo como **referencia de lo que se hizo**, no como software para ejecutar.

## Licencia

Sin licencia. Contenido conservado únicamente con fines de referencia.
