/*
 * ROR World "Smart Flow" (Velocidad Sostenible sin caídas)
 */

const https = require("https");

// --- CONFIGURACIÓN BALANCEADA ---
const TOTAL_VISITAS = 5000;   // Total de usuarios (sesiones) a simular
const MAX_CONCURRENCY = 60;   // ⚠️ CLAVE: Mantenlo bajo (40-80). Si subes a 200+, podrías tirar el sitio de nuevo.

const TARGET_HOST = "ror.world";
const TARGET_PATH = "/v1/track/add";

// Agente optimizado pero respetuoso
const agent = new https.Agent({
  keepAlive: true,            // Reutiliza el tubo TCP (ahorra CPU al servidor)
  maxSockets: MAX_CONCURRENCY,
  maxFreeSockets: 10,
  timeout: 10000              // 10s timeout
});

const LANGUAGES = ["indonesian", "hindi", "spanish", "english", "french", "chinese"]; 
const LANG_CODE_MAP = { "indonesian": "id", "hindi": "hi", "english": "en", "spanish": "es", "french": "fr", "chinese": "zh-CN" };

function randomIP() {
  return `${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}`;
}
const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Envío de una sola petición con manejo de errores silencioso
function sendRequest(action, lang, isoCode, ip) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ id: lang, action: action });

    const req = https.request(
      {
        hostname: TARGET_HOST,
        path: TARGET_PATH,
        method: "POST",
        agent,
        headers: {
          "Host": TARGET_HOST,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          "X-Forwarded-For": ip,
          "User-Agent": `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(Math.random()*10)+135}.0.0.0 Safari/537.36`,
          "Origin": `https://${TARGET_HOST}`,
          "Referer": `https://${TARGET_HOST}/${lang}`,
          "Cookie": `googtrans=/en/${isoCode}`,
          "Connection": "keep-alive"
        }
      },
      (res) => {
        // Leemos la data para limpiar el buffer, pero no la procesamos
        res.resume();
        res.on("end", () => {
            // Solo cuenta si es 200 OK. Si es 503/502/504 es que lo estamos matando.
            resolve(res.statusCode === 200); 
        });
      }
    );

    req.on("error", () => resolve(false)); // Error de red
    req.write(payload);
    req.end();
  });
}

// Simula la sesión completa de un usuario (Funnel)
async function processUserSession() {
  const lang = getRandom(LANGUAGES);
  const isoCode = LANG_CODE_MAP[lang] || "en";
  const ip = randomIP();
  
  const actions = [];
  
  // 1. Page View (Siempre)
  actions.push(sendRequest("page_view", lang, isoCode, ip));

  // 2. Probabilidades (Funnel)
  if (Math.random() < 0.80) actions.push(sendRequest("devotional_read", lang, isoCode, ip));
  if (Math.random() < 0.70) actions.push(sendRequest("pdf_download", lang, isoCode, ip));
  if (Math.random() < 0.50) actions.push(sendRequest("app_download", lang, isoCode, ip));

  // Enviamos todas las acciones de ESTE usuario en paralelo
  // PERO el límite global MAX_CONCURRENCY del agente frenará si hay muchas
  const results = await Promise.all(actions);
  
  // Retorna cuántas peticiones exitosas hizo este usuario
  return results.filter(r => r === true).length;
}

async function main() {
  console.log(`🚀 Iniciando Smart Flow Sender...`);
  console.log(`🛡️  Límite de Conexiones Simultáneas: ${MAX_CONCURRENCY}`);
  console.log(`🎯 Usuarios a procesar: ${TOTAL_VISITAS}`);

  const start = Date.now();
  let activeWorkers = 0;
  let usersProcessed = 0;
  let totalSuccessfulRequests = 0;
  
  // Promesa maestra que controla el flujo
  return new Promise((resolve) => {
    
    // Función que repone workers constantemente
    const refill = () => {
      while (activeWorkers < MAX_CONCURRENCY && usersProcessed < TOTAL_VISITAS) {
        activeWorkers++;
        usersProcessed++;
        
        processUserSession()
          .then((reqsOk) => {
            totalSuccessfulRequests += reqsOk;
            activeWorkers--;
            
            // Log de progreso cada 100 usuarios
            if (usersProcessed % 100 === 0) {
               const currentSecs = (Date.now() - start) / 1000;
               const speed = (totalSuccessfulRequests / currentSecs).toFixed(1);
            //    console.log(`Procesados: ${usersProcessed} | Vel: ${speed} req/s`);
            }
            
            refill(); // Al terminar uno, intenta meter otro inmediatamente
          })
          .catch(() => {
            activeWorkers--;
            refill();
          });
      }
      
      // Condición de salida
      if (usersProcessed >= TOTAL_VISITAS && activeWorkers === 0) {
        resolve();
      }
    };

    refill(); // Iniciar el ciclo
  }).then(() => {
    const duration = (Date.now() - start) / 1000;
    console.log(`\n✔ Finalizado en ${duration.toFixed(2)}s`);
    console.log(`📦 Peticiones Exitosas (HTTP 200): ${totalSuccessfulRequests}`);
    console.log(`⚡ Velocidad Promedio: ${(totalSuccessfulRequests / duration).toFixed(1)} req/s`);
    
    if ((totalSuccessfulRequests / duration) < 10) {
        console.log("⚠️  La velocidad fue baja. El servidor podría estar bloqueando o tu internet lento.");
    } else {
        console.log("✅ Flujo saludable. El servidor respondió correctamente.");
    }
  });
}

main();