// Nacho signing-request test harness.
//
//   node tools/signtest/server.mjs        # then open the printed URL in a browser
//
// Serves a dashboard that builds `nacho://sign?req=<base64url(JSON)>` QR codes for
// every request type (message / records / transfer / sale / rotate), so you can
// scan them with the app and exercise each flow. It also receives the app's POST
// (for endpoint round-trips) and verifies message (sign-in) responses.
//
// No npm deps: the page pulls a QR lib + @noble from a CDN (needs internet in the
// browser only — the phone just scans the on-screen QR, which is self-contained).
//
// Endpoint round-trip note: the app only allows an https endpoint (or
// http://localhost in a dev build) and REJECTS LAN IPs. So for the app to POST
// back here, expose this server via an https tunnel (e.g. `ngrok http 8899`) and
// paste that https URL into the "endpoint" field. Without a tunnel, use the
// "Copy response" button in the app and paste it into the Verify box below — that
// exercises the full sign + verify loop over the LAN with no endpoint needed.

import http from "node:http";
import os from "node:os";
import { readFileSync } from "node:fs";

const PORT = Number(process.env.PORT || 8899);

// Vendored QR library (qrcode-generator) — served locally so the page never
// depends on a CDN being reachable from the browser.
const QR_JS = readFileSync(new URL("./vendor/qrcode.js", import.meta.url), "utf8");

let lastResponse = null; // { at, body }

function lanIps() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === "IPv4" && !ni.internal) out.push(ni.address);
    }
  }
  return out;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // CORS so a tunnel/browser can POST freely.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && url.pathname === "/cb") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      lastResponse = { at: Date.now(), body };
      console.log("\n← received response:\n" + body + "\n");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/last") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(lastResponse || {}));
    return;
  }

  if (req.method === "GET" && url.pathname === "/qrcode.js") {
    res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
    res.end(QR_JS);
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, must-revalidate",
  });
  res.end(PAGE);
});

server.listen(PORT, () => {
  console.log(`\nNacho sign-test harness on:`);
  console.log(`  http://localhost:${PORT}`);
  for (const ip of lanIps()) console.log(`  http://${ip}:${PORT}  (LAN)`);
  console.log(`\nOpen it in a browser, then scan the QR codes with the app.\n`);
});

const PAGE = /* html */ `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Nacho sign-test</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; font: 14px/1.45 -apple-system,system-ui,sans-serif; background:#0d0d0f; color:#e8e8ea; }
  header { padding:16px 20px; border-bottom:1px solid #26262b; position:sticky; top:0; background:#0d0d0f; z-index:2; }
  header h1 { margin:0; font-size:16px; }
  header p { margin:4px 0 0; color:#9a9aa0; font-size:12px; }
  main { display:grid; grid-template-columns: 1fr 340px; gap:20px; padding:20px; align-items:start; }
  .cards { display:flex; flex-direction:column; gap:14px; }
  .card { background:#161619; border:1px solid #26262b; border-radius:12px; padding:14px; }
  .card h2 { margin:0 0 10px; font-size:14px; }
  label { display:block; font-size:12px; color:#9a9aa0; margin:8px 0 3px; }
  input, select, textarea { width:100%; background:#0d0d0f; border:1px solid #33333a; color:#e8e8ea; border-radius:8px; padding:8px; font:13px monospace; }
  textarea { min-height:70px; resize:vertical; }
  .row { display:flex; gap:8px; }
  .row > * { flex:1; }
  button { background:#FF7B00; color:#000; border:0; border-radius:8px; padding:9px 14px; font-weight:700; cursor:pointer; margin-top:10px; }
  button.sec { background:#26262b; color:#e8e8ea; font-weight:600; }
  .qrwrap { position:sticky; top:76px; background:#161619; border:1px solid #26262b; border-radius:12px; padding:16px; text-align:center; }
  #qr { background:#fff; padding:12px; border-radius:8px; display:inline-block; min-height:220px; }
  #qr img { width:300px; height:auto; image-rendering:pixelated; display:block; }
  #qrurl { word-break:break-all; font:11px monospace; color:#9a9aa0; margin-top:10px; text-align:left; }
  .oprow { display:grid; grid-template-columns: 70px 60px 1fr 1fr 24px; gap:6px; margin-top:6px; align-items:center; }
  .oprow button { margin:0; padding:6px; }
  .muted { color:#9a9aa0; font-size:12px; }
  .chk { display:flex; align-items:center; gap:6px; margin-top:8px; }
  .chk input { width:auto; }
  pre { white-space:pre-wrap; word-break:break-all; background:#0d0d0f; border:1px solid #33333a; border-radius:8px; padding:10px; font-size:12px; }
  .ok { color:#3fbf70; } .bad { color:#ff6b6b; }
</style></head>
<body>
<header>
  <h1>Nacho signing-request test harness</h1>
  <p>Build a request → scan the QR with the app → approve. Config (endpoint/return/exp/ref) applies to every request.</p>
</header>
<main>
  <div class="cards">
    <div class="card">
      <h2>Config (optional, applied to all)</h2>
      <div class="row">
        <div><label>Transport</label>
          <select id="base">
            <option value="nacho://sign">nacho://sign (custom scheme)</option>
            <option value="https://nacho.test/sign">https://nacho.test/sign (universal link)</option>
          </select></div>
        <div><label>exp (unix secs, blank = never)</label><input id="exp" placeholder=""/></div>
      </div>
      <label>endpoint (https tunnel; app POSTs response here)</label>
      <input id="endpoint" placeholder="https://xxxx.ngrok.io/cb"/>
      <label>return (https deep link back)</label>
      <input id="ret" placeholder="https://example.com/done"/>
      <label>ref (opaque, echoed back)</label>
      <input id="ref" placeholder="test-123"/>
    </div>

    <div class="card">
      <h2>① Message — Sign in with Nacho</h2>
      <div class="chk"><input type="checkbox" id="m_nohandle" checked/><label style="margin:0">let the user pick the handle (omit handle)</label></div>
      <label>handle (used only if unchecked)</label><input id="m_handle" placeholder="satoshi@bitcoin"/>
      <label>challenge</label>
      <div class="row"><input id="m_challenge"/><button class="sec" style="flex:0 0 auto" onclick="newChallenge()">↻</button></div>
      <button onclick="genMessage()">Generate QR</button>
    </div>

    <div class="card">
      <h2>② Records — add / set / delete</h2>
      <div class="chk"><input type="checkbox" id="r_nohandle" checked/><label style="margin:0">let the user pick the handle (omit handle)</label></div>
      <label>handle (used only if unchecked)</label><input id="r_handle" placeholder="satoshi@bitcoin"/>
      <label>ops</label>
      <div id="ops"></div>
      <button class="sec" onclick="addOp()">+ op</button>
      <button onclick="genRecords()">Generate QR</button>
    </div>

    <div class="card">
      <h2>③ Transfer</h2>
      <label>handle</label><input id="t_handle" placeholder="satoshi@bitcoin"/>
      <label>to (recipient script_pubkey, hex)</label><input id="t_to" placeholder="5120…"/>
      <div class="row">
        <div><label>outpoint txid</label><input id="t_txid"/></div>
        <div><label>vout</label><input id="t_vout" value="0"/></div>
        <div><label>amount</label><input id="t_amount" value="10000"/></div>
      </div>
      <button onclick="genTransfer()">Generate QR</button>
    </div>

    <div class="card">
      <h2>④ Sale</h2>
      <label>handle</label><input id="s_handle" placeholder="satoshi@bitcoin"/>
      <label>price (base units)</label><input id="s_price" value="50000"/>
      <div class="row">
        <div><label>outpoint txid</label><input id="s_txid"/></div>
        <div><label>vout</label><input id="s_vout" value="0"/></div>
        <div><label>amount</label><input id="s_amount" value="10000"/></div>
      </div>
      <button onclick="genSale()">Generate QR</button>
    </div>

    <div class="card">
      <h2>⑤ Rotate key</h2>
      <label>handle</label><input id="ro_handle" placeholder="satoshi@bitcoin"/>
      <div class="row">
        <div><label>outpoint txid</label><input id="ro_txid"/></div>
        <div><label>vout</label><input id="ro_vout" value="0"/></div>
        <div><label>amount</label><input id="ro_amount" value="10000"/></div>
      </div>
      <button onclick="genRotate()">Generate QR</button>
    </div>

    <div class="card">
      <h2>Verify a response</h2>
      <p class="muted">Live: shows whatever the app POSTs to <code>/cb</code>. Or paste a copied response below. Message (sign-in) responses are signature-checked against the last challenge.</p>
      <button class="sec" onclick="pollNow()">Check for POSTed response</button>
      <label>paste response JSON</label>
      <textarea id="resp"></textarea>
      <button onclick="verifyPasted()">Verify</button>
      <pre id="verdict" class="muted">—</pre>
    </div>
  </div>

  <div class="qrwrap">
    <div id="qr"></div>
    <div id="qrurl">Generate a request to see its QR.</div>
  </div>
</main>

<!-- Vendored, served locally (global qrcode()); no CDN. -->
<script src="/qrcode.js"></script>
<script>
const $ = (id) => document.getElementById(id);
let lastChallenge = "";

function b64url(obj) {
  const s = btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
  return s.replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
}
function common() {
  const c = {};
  const exp = $("exp").value.trim(); if (exp) c.exp = Number(exp);
  const ep = $("endpoint").value.trim(); if (ep) c.endpoint = ep;
  const rt = $("ret").value.trim(); if (rt) c.return = rt;
  const rf = $("ref").value.trim(); if (rf) c.ref = rf;
  return c;
}
function show(req) {
  const url = $("base").value + "?req=" + b64url(req);
  try {
    const qr = qrcode(0, "L"); // type 0 = auto-fit, "L" = max data capacity
    qr.addData(url);
    qr.make();
    $("qr").innerHTML = qr.createImgTag(6, 8); // cellSize, margin (px per module)
  } catch (e) {
    $("qr").innerHTML = "<div style='color:#000;padding:20px;font:13px monospace'>Request too long to QR-encode: " + e.message + "</div>";
  }
  $("qrurl").textContent = url;
  console.log(JSON.stringify(req, null, 2));
}

window.newChallenge = () => {
  const b = crypto.getRandomValues(new Uint8Array(16));
  lastChallenge = "login-" + [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  $("m_challenge").value = lastChallenge;
};
window.genMessage = () => {
  lastChallenge = $("m_challenge").value.trim();
  const req = { v: 1, type: "message", challenge: lastChallenge, ...common() };
  if (!$("m_nohandle").checked && $("m_handle").value.trim()) req.handle = $("m_handle").value.trim();
  show(req);
};

let opId = 0;
window.addOp = (preset) => {
  opId++;
  const div = document.createElement("div");
  div.className = "oprow";
  div.innerHTML =
    '<select class="op"><option value="set">set</option><option value="delete">delete</option></select>' +
    '<select class="rtype"><option value="txt">txt</option><option value="addr">addr</option></select>' +
    '<input class="key" placeholder="key"/>' +
    '<input class="val" placeholder="value"/>' +
    '<button class="sec" onclick="this.parentNode.remove()">×</button>';
  $("ops").appendChild(div);
  if (preset) {
    div.querySelector(".op").value = preset.op;
    div.querySelector(".rtype").value = preset.rtype || "txt";
    div.querySelector(".key").value = preset.key || "";
    div.querySelector(".val").value = preset.value || "";
  }
};
window.genRecords = () => {
  const ops = [...document.querySelectorAll(".oprow")].map((r) => {
    const op = r.querySelector(".op").value;
    const key = r.querySelector(".key").value.trim();
    const rtype = r.querySelector(".rtype").value;
    if (op === "delete") return { op, key, rtype };
    return { op: "set", rtype, key, value: [r.querySelector(".val").value.trim()] };
  }).filter((o) => o.key);
  if (!ops.length) return alert("Add at least one op with a key.");
  const req = { v: 1, type: "records", ops, ...common() };
  if (!$("r_nohandle").checked && $("r_handle").value.trim()) req.handle = $("r_handle").value.trim();
  show(req);
};

const outpoint = (t, v, a) => ({ txid: $(t).value.trim(), vout: Number($(v).value), amount: Number($(a).value) });
window.genTransfer = () => show({ v: 1, type: "transfer", handle: $("t_handle").value.trim(), to: $("t_to").value.trim(), outpoint: outpoint("t_txid", "t_vout", "t_amount"), ...common() });
window.genSale = () => show({ v: 1, type: "sale", handle: $("s_handle").value.trim(), price: Number($("s_price").value), outpoint: outpoint("s_txid", "s_vout", "s_amount"), ...common() });
window.genRotate = () => show({ v: 1, type: "rotate", handle: $("ro_handle").value.trim(), outpoint: outpoint("ro_txid", "ro_vout", "ro_amount"), ...common() });

// ---- verification (crypto libs loaded lazily; a failure here never breaks the
// request builders above) ----
let _noble = null;
async function loadNoble() {
  if (_noble) return _noble;
  const [secp, sha2, utils] = await Promise.all([
    import("https://esm.sh/@noble/secp256k1@2.1.0"),
    import("https://esm.sh/@noble/hashes@1.5.0/sha2"),
    import("https://esm.sh/@noble/hashes@1.5.0/utils"),
  ]);
  _noble = { schnorr: secp.schnorr, sha256: sha2.sha256, u: utils };
  return _noble;
}
async function verifyMessage(resp) {
  if (resp.type !== "message") return { ok: false, msg: "Not a message response (type=" + resp.type + "). Shown for inspection only." };
  if (!lastChallenge) return { ok: false, msg: "No challenge on record — generate a Message QR first." };
  try {
    const { schnorr, sha256, u } = await loadNoble();
    const t = sha256(u.utf8ToBytes("nacho/message/v1"));
    const digest = sha256(u.concatBytes(t, t, u.utf8ToBytes(lastChallenge)));
    const ok = schnorr.verify(u.hexToBytes(resp.signature), digest, u.hexToBytes(resp.pubkey));
    return { ok, msg: ok
      ? "✓ Valid signature for challenge \\"" + lastChallenge + "\\"\\n  handle: " + resp.handle + "\\n  pubkey: " + resp.pubkey + (resp.ref ? "\\n  ref: " + resp.ref : "") + "\\n\\n  (Bind to the handle by resolving it and matching this pubkey.)"
      : "✗ Signature does NOT verify against the last challenge." };
  } catch (e) { return { ok: false, msg: "Verify error (crypto lib failed to load?): " + e.message }; }
}
async function render(resp) {
  const v = await verifyMessage(resp);
  const el = $("verdict");
  el.className = v.ok ? "ok" : "bad";
  el.textContent = v.msg + "\\n\\n" + JSON.stringify(resp, null, 2);
}
window.verifyPasted = () => {
  try { render(JSON.parse($("resp").value.trim())); }
  catch (e) { $("verdict").className = "bad"; $("verdict").textContent = "Not valid JSON: " + e.message; }
};
window.pollNow = async () => {
  const r = await fetch("/last").then((x) => x.json());
  if (!r.body) { $("verdict").className = "muted"; $("verdict").textContent = "No response POSTed yet."; return; }
  $("resp").value = r.body;
  try { render(JSON.parse(r.body)); } catch { $("verdict").textContent = r.body; }
};

// seed defaults
newChallenge();
addOp({ op: "set", rtype: "addr", key: "btc", value: "bc1qexampleexampleexampleexample" });
addOp({ op: "set", rtype: "txt", key: "website", value: "example.com" });
setInterval(async () => {
  const r = await fetch("/last").then((x) => x.json()).catch(() => ({}));
  if (r.body && r.at && r.at !== window.__seen) { window.__seen = r.at; window.pollNow(); }
}, 2000);
</script>
</body></html>`;
