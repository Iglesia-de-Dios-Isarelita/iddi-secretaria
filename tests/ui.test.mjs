// Browser test with a stand-in database (tests/mock-supabase.js). Run: node tests/ui.test.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url); const { chromium } = require("playwright");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const headers = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root, "vercel.json"))).headers[0].headers.map((h) => [h.key, h.value]));
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split("?")[0]); if (p === "/") p = "/index.html"; const f = path.join(root, p); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { ...headers, "Content-Type": mime[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f)); });
await new Promise((ok) => srv.listen(0, ok)); const base = `http://localhost:${srv.address().port}`;
const mock = fs.readFileSync(path.join(root, "tests/mock-supabase.js"), "utf8");
const results = []; const check = (name, ok, extra = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${extra}`); };
const browser = await chromium.launch({ executablePath: fs.existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined });

async function open(query, hash = "", viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(() => { try { sessionStorage.setItem("iddi.splash", "1"); } catch (e) {} });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.route("**/cdn.jsdelivr.net/**", (r) => r.fulfill({ contentType: "text/javascript", body: mock }));
  await page.route(/iglesiadediosisraelita\.org|vercel-storage\.com/, (r) => r.abort());
  await page.goto(base + "/?" + query + hash);
  return { page, errors, ctx };
}
const main = (page) => page.textContent("main");

// 1 signed out
{ const { page, errors } = await open("out=1"); await page.waitForSelector("#google-btn");
  check("login shows the Google button", true);
  check("login title says Secretaría", (await page.title()).includes("Secretaría"));
  check("login: no errors", !errors.length, errors.join(" | ")); }

// 2 local secretary of Oakland
const { page, errors } = await open("role=local");
await page.waitForSelector(".kpis");
check("home shows sermons this month", (await page.textContent(".kpis")).includes("1"));
check("menu hides sections without permission", (await page.locator('[data-nav="configuracion"]').count()) === 0 && (await page.locator('[data-nav="predicaciones"]').count()) === 1);
check("home offers to record a sermon", await page.locator('a[href="#/predicaciones/nueva"]').isVisible());

// sermons
await page.click('[data-nav="predicaciones"]'); await page.waitForSelector("#list table");
check("sermon list shows the sample", (await page.textContent("#list")).includes("sembrador"));
await page.click("#new"); await page.waitForSelector(".dialog form");
await page.selectOption(".dialog select[name=type]", "t2");
await page.fill(".dialog input[name=title]", "El hijo pródigo"); await page.fill(".dialog input[name=preacher]", "Hno. Gómez");
await page.fill(".dialog input[name=att_men]", "8"); await page.fill(".dialog input[name=att_women]", "9"); await page.fill(".dialog input[name=att_youth]", "3");
check("attendance total adds up live", (await page.textContent("#att-total")) === "20");
await page.click(".dialog [type=submit]");
check("first citation is required", await page.locator("#err").isVisible() && (await page.textContent("#err")).includes("cita"));
await page.fill(".dialog [data-cite] input[name=ref]", "Lucas 15:11-32");
await page.click("#add-cite"); await page.locator(".dialog [data-cite]").nth(1).locator("input[name=ref]").fill("Lucas 15:7");
await page.click(".dialog label.chip-opt:has-text('Parábolas')");
await page.setInputFiles(".dialog input[name=file]", { name: "presentacion.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", buffer: Buffer.from("x") });
await page.click(".dialog [type=submit]");
await page.waitForFunction(() => document.querySelector("#list") && document.querySelector("#list").textContent.includes("pródigo"));
const saved = await page.evaluate(() => window.__MOCK.calls.find((c) => c[0] === "sec_service_save")[1]);
check("sermon saved with church, 2 citations, topic, attendance and file",
  saved.p_org === "o-oak" && saved.p_citations.length === 2 && saved.p_topics[0] === "p4" && saved.p_attendance.men === 8 && /^services\/o-oak\//.test(saved.p_presentation_path));
await page.locator("#list tr", { hasText: "pródigo" }).click(); await page.waitForSelector(".dialog .att-grid");
check("sermon detail shows total and citations", (await page.textContent(".dialog")).includes("20") && (await page.textContent(".dialog")).includes("Lucas 15:7"));
await page.click("#s-void"); await page.fill("textarea[name=reason]", "Registrada dos veces"); await page.click(".dialog [type=submit]");
await page.waitForFunction(() => !document.querySelector("#list").textContent.includes("pródigo"));
check("void hides the sermon from the list", true);

// letters: local and for all churches (approval)
await page.click('[data-nav="cartas"]'); await page.waitForSelector("#new");
check("letters show other churches' letters published for all", (await main(page)).includes("Campaña de evangelismo"));
await page.click("#new"); await page.fill(".dialog input[name=title]", "Carta a todas las iglesias");
await page.check(".dialog input[name=aud][value=all_churches]"); await page.click(".dialog [type=submit]");
await page.waitForFunction(() => document.querySelector("main").textContent.includes("Carta a todas las iglesias"));
check("letter for all churches waits for approval", (await page.locator("tr", { hasText: "Carta a todas las iglesias" }).textContent()).includes("Por aprobar"));
await page.click('a[href="#/cartas/por-aprobar"]'); await page.waitForFunction(() => location.hash === "#/cartas/por-aprobar" && document.querySelectorAll("main tbody tr").length === 1);
await page.locator("main tbody tr").first().click(); await page.waitForSelector("#l-ok"); await page.click("#l-ok");
await page.waitForFunction(() => document.querySelectorAll("main tbody tr").length === 0 || !document.querySelector("main tbody"));
check("Encargado Local approves the letter", await page.evaluate(() => window.__MOCK.db.sec_letters.find((l) => l.title === "Carta a todas las iglesias").status === "published"));

// circulars: acknowledge
await page.click('[data-nav="circulares"]'); await page.waitForSelector("[data-circ]");
check("received circular shows no acknowledgement yet", (await main(page)).includes("Sin acuse"));
await page.click("[data-circ]"); await page.click("[data-ack]");
await page.waitForFunction(() => document.querySelector("main").textContent.includes("Recibida"));
check("acknowledging marks it received", true);

// trends, search
await page.click('[data-nav="tendencias"]'); await page.waitForSelector(".kpis");
check("trends show services and a chart", (await page.textContent(".kpis")).includes("1") && (await page.locator("svg.chart rect").count()) >= 1);
await page.click('[data-nav="buscar"]'); await page.fill("input[name=q]", "sembrador"); await page.press("input[name=q]", "Enter");
await page.waitForSelector("[data-hit]");
check("IDDI AI finds the sermon in the app's records", (await page.textContent("#res")).includes("sembrador"));
await page.click("[data-hit]"); await page.waitForSelector(".dialog .att-grid");
check("a result opens its source", (await page.textContent(".dialog h2")).includes("sembrador"));
await page.keyboard.press("Escape");

// library (read only for a local secretary)
await page.click('[data-nav="biblioteca"]'); await page.waitForSelector(".doc-card");
check("library lists doctrinal documents, no publish button", (await main(page)).includes("Temario de bautismo") && (await page.locator("#new").count()) === 0);
await page.click('a[href="#/biblioteca/acuerdos"]'); await page.waitForSelector("[data-agr]");
check("conciliar agreements listed with number", (await main(page)).includes("CI-2026-001"));

// access: local leader can give lower roles only
await page.click('[data-nav="accesos"]'); await page.waitForSelector("#new"); await page.click("#new");
const roleOpts = await page.locator(".dialog select[name=role] option").allTextContents();
check("only roles below Local appear (Predicador needs rank 4, so only society secretary)", roleOpts.includes("Secretario de departamento o de sociedad") && !roleOpts.some((o) => /Zona|Nacional|Maestro|Predicador/.test(o)), roleOpts.join(","));
await page.fill(".dialog input[name=email]", "maria@iddioakland.org"); await page.selectOption(".dialog select[name=role]", "secretario_sociedad_departamento");
const orgOpts = await page.locator(".dialog select[name=org] option").allTextContents();
check("society role asks for a society or department", orgOpts.some((o) => o.includes("Sociedad de Jóvenes")) && orgOpts.some((o) => o.includes("Música")));
await page.selectOption(".dialog select[name=org]", "o-soc"); await page.click(".dialog [type=submit]");
await page.waitForFunction(() => document.querySelector("main").textContent.includes("maria@iddioakland.org"));
check("access given", true);

// English
await page.click('[data-lang="en"]'); await page.waitForFunction(() => document.querySelector('[data-nav="predicaciones"]').textContent.includes("Sermons"));
check("English menu", true);
check("local secretary run: no errors", !errors.length, errors.join(" | "));
await page.screenshot({ path: "/tmp/sec-local.png", fullPage: true });

// 3 master administrator: publish, settings
{ const { page, errors } = await open("role=master&lang=es");
  await page.waitForSelector('[data-nav="configuracion"]');
  await page.click('[data-nav="biblioteca"]'); await page.waitForSelector("#new"); await page.click("#new");
  await page.selectOption(".dialog select[name=org]", "o-hq"); await page.fill(".dialog input[name=title]", "Manual del secretario");
  await page.selectOption(".dialog select[name=kind]", "manual"); await page.click(".dialog [type=submit]");
  await page.waitForFunction(() => document.querySelector("main").textContent.includes("Manual del secretario"));
  check("master publishes a doctrinal document", true);
  await page.click('a[href="#/biblioteca/acuerdos"]'); await page.waitForSelector("#new"); await page.click("#new");
  await page.selectOption(".dialog select[name=org]", "o-nat"); await page.fill(".dialog input[name=topic]", "Horario de cultos"); await page.fill(".dialog textarea[name=body]", "Se acuerda...");
  await page.click(".dialog [type=submit]"); await page.waitForFunction(() => document.querySelector("main").textContent.includes("CN-USA-2026-001"));
  check("national agreement gets its number", true);
  await page.click('[data-nav="circulares"]'); await page.waitForSelector("#new"); await page.click("#new");
  await page.selectOption(".dialog select[name=org]", "o-zone"); await page.fill(".dialog input[name=title]", "Aviso de zona");
  await page.check(".dialog input[name=to][value=pick]"); await page.click(".dialog [type=submit]");
  check("picking churches requires at least one", await page.locator("#err").isVisible());
  await page.click(".dialog label.chip-opt:has-text('Oakland')"); await page.click(".dialog [type=submit]");
  await page.waitForFunction(() => document.querySelector("main").textContent.includes("Aviso de zona"));
  check("circular sent to the chosen church", await page.evaluate(() => window.__MOCK.db.sec_circulars[0].sec_circular_recipients.length === 1));
  await page.click('[data-nav="configuracion"]'); await page.waitForSelector("[data-add=service_types]");
  check("settings list the three service types and four topics", (await page.locator("main section").first().locator("tbody tr").count()) === 3 && (await page.locator("main section").nth(1).locator("tbody tr").count()) === 4);
  await page.click("[data-add=service_types]"); await page.fill(".dialog input[name=es]", "Servicio Especial"); await page.fill(".dialog input[name=en]", "Special Service"); await page.click(".dialog [type=submit]");
  await page.waitForFunction(() => document.querySelector("main").textContent.includes("Servicio Especial"));
  check("a service type can be added", true);
  check("master run: no errors", !errors.length, errors.join(" | "));
  await page.screenshot({ path: "/tmp/sec-master.png", fullPage: true }); }

// 4 society secretary: only its agreements
{ const { page, errors } = await open("role=society&lang=es");
  await page.waitForSelector('[data-nav="acuerdos"]');
  check("society secretary cannot record sermons or open settings", (await page.locator('[data-nav="configuracion"]').count()) === 0 && !(await page.locator('a[href="#/predicaciones/nueva"]').count()));
  await page.click('[data-nav="acuerdos"]'); await page.waitForSelector("#new"); await page.click("#new");
  await page.fill(".dialog input[name=topic]", "Himno especial"); await page.fill(".dialog textarea[name=body]", "Quien canta el himno especial también lo presenta.");
  await page.click(".dialog [type=submit]"); await page.waitForFunction(() => document.querySelector("main").textContent.includes("AS-2026-001"));
  check("society agreement saved with AS number", true);
  check("society run: no errors", !errors.length, errors.join(" | ")); }

// 5 phone size
{ const { page, errors } = await open("role=local", "#/predicaciones", { width: 390, height: 844 });
  await page.waitForSelector("#list table");
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  check("phone: page does not scroll sideways", !wide);
  await page.screenshot({ path: "/tmp/sec-phone.png" });
  check("phone: no errors", !errors.length, errors.join(" | ")); }

await browser.close(); srv.close();
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
