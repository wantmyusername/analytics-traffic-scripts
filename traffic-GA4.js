/*
 * GA4 Ultra High-Speed Sender (KeepAlive Optimized)
 */

const https = require("https");

const MEASUREMENT_ID = "G-JN6CHDS26V";
const API_SECRET = "JA8r2u-ARLGZ3i_RDoNtLA";

const TOTAL_EVENTS = 1000000*1000000;  // envía 300k súper rápido
const CONCURRENCY = 1000;      // workers simultáneos
const BATCH_SIZE = 1;         // GA4 realtime solo funciona con 1 evento por request

// 🔥 Keep-Alive Agent acelera 5–10x
const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 500,
  maxFreeSockets: 500,
  timeout: 60000
});

function sendToGA4(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);

    const req = https.request(
      {
        hostname: "www.google-analytics.com",
        path: `/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`,
        method: "POST",
        agent,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data)
        }
      },
      (res) => {
        res.on("data", () => {});
        res.on("end", () => resolve(true));
      }
    );

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function randomCID() {
  return `${Math.floor(Math.random() * 1e10)}.${Math.floor(Math.random() * 1e10)}`;
}

async function worker(count) {
  for (let i = 0; i < count; i++) {
    const payload = {
      client_id: randomCID(),
      events: [
        {
          name: "page_view",
          params: {
            page_title: "Rhapsody of Realities",
            page_location: "/",
            engagement_time_msec: 1
          }
        }
      ]
    };

    try {
      await sendToGA4(payload);
    } catch {}
  }
}

async function main() {
  console.log("🚀 Starting ultra-fast GA4 sender…");

  const perWorker = Math.ceil(TOTAL_EVENTS / CONCURRENCY);
  const workers = [];

  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(worker(perWorker));
  }

  await Promise.all(workers);
  console.log("✔ Done!");
}

main();
