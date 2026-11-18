import { t, getLang, setLang, languages } from "./i18n.js";
import { installButton, wireInstall } from "./install.js";
import { html, raw, setHTML, $, $$, esc } from "./util.js";
import { toast, modal, field } from "./ui.js";
import "./skin.js";
import * as api from "./api.js";
import { buildModel, resolve, pathOf, defaultSel, mountPicker, scopeButtonHtml, getModel } from "./scope.js";
import { renderLogin, renderMessage, renderNameForm } from "./views/login.js";

const root = document.getElementById("app");

// ---------- theme: automatic by the visitor's local clock, or chosen manually ----------
const THEMES = ["auto", "light", "dark"];
let themePref = "auto";
try { themePref = localStorage.getItem("iddi.theme") || "auto"; } catch (e) { /* ignore */ }
export function applyTheme() {
  let mode = themePref;
  if (mode === "auto") { const h = new Date().getHours(); mode = h >= 6 && h < 18 ? "light" : "dark"; }
  document.documentElement.setAttribute("data-theme", mode);
}
function cycleTheme() {
  themePref = THEMES[(THEMES.indexOf(themePref) + 1) % THEMES.length];
  try { localStorage.setItem("iddi.theme", themePref); } catch (e) { /* ignore */ }
  applyTheme();
}
const themeLabel = () => ({ auto: t("themeAuto"), light: t("themeLight"), dark: t("themeDark") })[themePref];
setInterval(applyTheme, 60000);
applyTheme();
setLang(getLang());

// ---------- shared app state ----------
export const app = {
  ctx: null, perms: new Set(), userId: null, subRoute: [],
  orgsAll: [], orgById: new Map(), types: [], topics: [],
  scope: {}, orgIds: [], orgId: null, scopeParts: [], scopeKey: "",
  can: (code) => app.perms.has("secretaria." + code),
  roles: () => (app.ctx && app.ctx.roles) || [],
  hasRole: (codes) => app.roles().some((r) => codes.includes(r.role)),
  isMaster: () => app.hasRole(["administrador_maestro"]),
  isCreator: () => !!(app.ctx && app.ctx.is_creator),
  topRank: () => Math.max(0, ...app.roles().map((r) => r.rank || 0)),
  allowed: (sec) => sec.when(app),
  rerender: () => route(),
  fullName: () => [app.ctx.first_name, app.ctx.last_name].filter(Boolean).join(" ") || app.ctx.full_name || app.ctx.email,
  greeting: () => (app.ctx.first_name ? t("greeting", { who: t(app.ctx.treatment || "hermano"), name: app.fullName() }) : ""),
  // Display name: churches by their city, societies with their church, administrations by name.
  orgName: (id) => {
    const o = app.orgById.get(id);
    if (!o) return "";
    if (o.kind === "church") return o.locality_name || o.display_name || o.name;
    if (o.kind === "society" || o.kind === "department") return `${o.name}${o.locality_name ? " — " + o.locality_name : ""}`;
    return o.display_name || o.name;
  },
  inScope: () => app.orgsAll.filter((o) => o.in_scope),
  // The church where the person can record sermons and letters right now (they must be its Secretario Local).
  recordChurch: (codes = ["secretario_local"]) => (app.recordChurchFor(app.orgId, codes) ? app.orgId : null),
  // True when the person holds one of these church roles for this church.
  recordChurchFor: (id, codes) => {
    const o = app.orgById.get(id);
    if (!o || o.kind !== "church") return false;
    return app.roles().some((r) => codes.includes(r.role) && r.locality_id && r.locality_id === o.locality_id);
  },
  // Organizations of these kinds the person works with (e.g. administrations that can publish).
  orgsWhere: (fn) => app.inScope().filter(fn).map((o) => o.id),
  // One organization that stands for what is being viewed: the chosen one, or the administration over the chosen area.
  areaOrg: () => {
    if (app.orgId) return app.orgId;
    const m = getModel(), s = app.scope || {};
    const c = m && m.countries.find((x) => x.id === s.c);
    if (c) {
      const z = c.zones.find((x) => x.id === s.z);
      if (z) return z.zoneOrg || (z.churches[0] && z.churches[0].id) || null;
      return c.nationalOrg || null;
    }
    return m && m.hq ? m.hq.id : null;
  },
  setScope: (sel) => applyScope(sel, true),
  focusOrg: (id) => { const p = pathOf(id); if (p) applyScope(p, true); },
  typeName: (id) => { const x = app.types.find((y) => y.id === id); return x ? (getLang() === "en" ? x.name_en : x.name_es) : ""; },
  topicName: (id) => { const x = app.topics.find((y) => y.id === id); return x ? (getLang() === "en" ? x.name_en : x.name_es) : ""; },
  reloadLists: async () => { [app.types, app.topics] = await Promise.all([api.serviceTypes(), api.topics()]); },
};

function applyScope(sel, reroute) {
  const r = resolve(sel || {});
  app.scope = r.sel; app.orgIds = r.ids; app.orgId = r.single; app.scopeParts = r.parts; app.scopeKey = JSON.stringify(r.sel);
  try { localStorage.setItem("iddi.sec.scope." + app.userId, app.scopeKey); } catch (e) { /* ignore */ }
  const b = $("#scope-btn"); if (b) { setHTML(b, raw(scopeButtonHtml(app.scopeParts))); b.classList.toggle("combined", !app.orgId); }
  if (reroute) route();
}

// The scope picker is built from the organizations the person works with (same shape as Finance's structure).
function buildScope(rows) {
  const mine = rows.filter((o) => o.in_scope);
  const countries = new Map();
  for (const o of mine) {
    if (!o.country_id) continue;
    if (!countries.has(o.country_id)) countries.set(o.country_id, { id: o.country_id, name: o.country_name, code: o.country_code, national: null, zones: new Map() });
    const c = countries.get(o.country_id);
    if (o.kind === "administration" && o.admin_level === "national") c.national = { id: o.national_administration_id, name: o.name, org_id: o.id };
    if (o.zone_id) {
      if (!c.zones.has(o.zone_id)) c.zones.set(o.zone_id, { id: o.zone_id, name: o.zone_name, org_id: null, churches: [] });
      const z = c.zones.get(o.zone_id);
      if (o.kind === "administration" && o.admin_level === "zone") z.org_id = o.id;
      if (o.kind === "church") z.churches.push({ id: o.id, name: o.name, locality: o.locality_name, active: true });
    }
  }
  const tree = [...countries.values()].map((c) => ({ ...c, zones: [...c.zones.values()] }));
  const orgs = mine.map((o) => ({ id: o.id, kind: o.kind, name: o.name, display_name: o.kind === "church" ? o.locality_name : o.display_name,
    admin_level: o.admin_level, parent_organization_id: o.parent_organization_id, locality_id: o.locality_id }));
  buildModel(tree, orgs);
}

const SECTIONS = [
  { id: "inicio", key: "navHome", when: () => true, load: () => import("./views/home.js") },
  { id: "predicaciones", key: "navServices", when: (a) => a.can("services.view"), load: () => import("./views/services.js") },
  { id: "biblioteca", key: "navLibrary", when: (a) => a.can("library.view"), load: () => import("./views/library.js") },
  { id: "cartas", key: "navLetters", when: (a) => a.can("letters.view"), load: () => import("./views/letters.js") },
  { id: "acuerdos", key: "navAgreements", when: (a) => a.hasRole(["secretario_local", "encargado_local", "secretario_sociedad_departamento", "administrador_maestro"]), load: () => import("./views/agreements.js") },
  { id: "circulares", key: "navCirculars", when: (a) => a.can("circulars.send") || a.can("circulars.acknowledge") || a.isMaster(), load: () => import("./views/circulars.js") },
  { id: "tendencias", key: "navTrends", when: (a) => a.can("trends.view"), load: () => import("./views/trends.js") },
  { id: "buscar", key: "navSearch", when: (a) => a.can("ai.use"), load: () => import("./views/search.js") },
  { id: "accesos", key: "navAccess", when: (a) => a.can("users.view") || a.isCreator(), load: () => import("./views/access.js") },
  { id: "configuracion", key: "navSettings", when: (a) => a.can("settings.manage"), load: () => import("./views/settings.js") },
];

// ---------- boot ----------
let booting = false, lastUser = undefined;
async function boot() {
  if (booting) return;
  booting = true;
  try {
    setHTML(root, html`<div class="center-screen"><div class="spinner" aria-hidden="true"></div><p>${t("loading")}</p></div>`);
    const session = await api.auth.session();
    lastUser = session ? session.user.id : null;
    if (!session) return renderLogin(root, { onLang: boot });
    const ctx = await api.context();
    if (!ctx) return renderMessage(root, { title: t("pendingTitle"), text: t("pendingText"), onLang: boot, signOut: true });
    app.ctx = ctx; app.userId = ctx.user_id; app.perms = new Set(ctx.permissions || []);
    if (ctx.status === "suspended" || ctx.status === "deactivated") return renderMessage(root, { title: t("suspendedTitle"), text: t("suspendedText"), onLang: boot, signOut: true });
    if (ctx.status !== "active") return renderMessage(root, { title: t("pendingTitle"), text: t("pendingText"), onLang: boot, signOut: true });
    if (!(ctx.roles || []).length && !ctx.is_creator) return renderMessage(root, { title: t("pendingTitle"), text: t("noAccessApp"), onLang: boot, signOut: true });
    if (!ctx.first_name || !ctx.last_name) return renderNameForm(root, { ctx, onLang: boot, onDone: boot });
    return await startApp();
  } catch (err) {
    console.error(err);
    renderMessage(root, { title: t("signInError"), text: err.message || t("errorGeneric"), onLang: boot, signOut: true });
  } finally { booting = false; window.__appReady = true; window.dispatchEvent(new Event("iddi:ready")); }
}

async function startApp() {
  const [rows] = await Promise.all([api.orgs().catch(() => []), app.reloadLists()]);
  app.orgsAll = rows || []; app.orgById = new Map(app.orgsAll.map((o) => [o.id, o]));
  buildScope(app.orgsAll);
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem("iddi.sec.scope." + app.userId) || "null"); } catch (e) { /* ignore */ }
  applyScope(saved || defaultSel(app.ctx), false);
  renderShell();
  await route();
}

const ICONS = {
  inicio: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/>',
  predicaciones: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5M9 7h7M9 11h5"/>',
  biblioteca: '<path d="M2 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h8z"/>',
  cartas: '<path d="M4 4h16v16H4zM4 6l8 7 8-7"/>',
  acuerdos: '<path d="M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',
  circulares: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
  tendencias: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  buscar: '<path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3M11 8v6M8 11h6"/>',
  accesos: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  configuracion: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};
const icon = (id) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id] || ""}</svg>`;

let sideOpen = true, escBound = false, closeSide = () => {};
function renderShell() {
  const role = app.roles().slice().sort((a, b) => b.rank - a.rank)[0] || {};
  const roleName = role[getLang() === "es" ? "name_es" : "name_en"] || "";
  const links = SECTIONS.filter((s) => app.allowed(s)).map((s) => `<a href="#/${s.id}" data-nav="${s.id}" title="${esc(t(s.key))}">${icon(s.id)}<span>${esc(t(s.key))}</span></a>`).join("");
  const name = app.fullName();
  const initials = name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  setHTML(root, html`
    <div class="shell">
      <aside class="sidebar" id="sidebar">
        <button type="button" class="side-toggle" id="side-toggle" aria-expanded="false" aria-controls="sidebar" aria-label="${t("menuOpen")}" title="${t("menuOpen")}"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
        <a class="brand" href="#/inicio"><img class="logo-emblem" data-logo="emblem" alt="" width="40" height="42"><span class="brand-text"><strong>${t("church")}</strong><small>${t("appShort")}</small></span></a>
        <nav class="nav" aria-label="Principal">${raw(links)}</nav>
        <button type="button" class="sidebar-foot" id="me-btn" title="${esc(app.ctx.email)}" aria-label="${t("editName")}"><span class="me" aria-hidden="true">${initials}</span><span class="who"><strong>${name}</strong><small>${roleName}</small></span></button>
      </aside>
      <div class="content">
        <header class="topbar">
          <div class="scope-wrap"><button type="button" id="scope-btn" class="scope-btn${app.orgId ? "" : " combined"}" aria-haspopup="dialog" aria-expanded="false" title="${t("scopeTitle")}">${raw(scopeButtonHtml(app.scopeParts))}</button></div>
          <div class="topbar-tools">
            <div class="seg" role="group" aria-label="${t("language")}">${raw(languages.map((l) => `<button type="button" data-lang="${l}" aria-pressed="${l === getLang()}">${l.toUpperCase()}</button>`).join(""))}</div>
            ${installButton()}
            <button type="button" class="ghost" id="theme-btn" title="${t("theme")}">${themeLabel()}</button>
            <button type="button" class="ghost" id="signout-btn">${t("signOut")}</button>
          </div>
        </header>
        <main id="view" tabindex="-1"></main>
      </div>
    </div>`);
  applyLogos();
  $("#me-btn").addEventListener("click", editName);
  const shell = $(".shell"), tog = $("#side-toggle"), view = $("#view");
  let peekTimer, peekBlocked = false;
  const setOpen = (open) => {
    sideOpen = open; clearTimeout(peekTimer); shell.classList.toggle("side-open", open); shell.classList.remove("side-peek");
    tog.setAttribute("aria-expanded", String(open));
    const label = t(open ? "menuClose" : "menuOpen"); tog.setAttribute("aria-label", label); tog.title = label;
  };
  setOpen(sideOpen);
  tog.addEventListener("click", () => { if (sideOpen) peekBlocked = true; setOpen(!sideOpen); });
  const work = () => { if (sideOpen && matchMedia("(min-width: 901px)").matches) setOpen(false); };
  view.addEventListener("pointerdown", work);
  const side = $("#sidebar");
  const peek = (on) => { clearTimeout(peekTimer); if (!on) return shell.classList.remove("side-peek");
    if (!sideOpen && !peekBlocked && matchMedia("(min-width: 901px) and (hover: hover)").matches) peekTimer = setTimeout(() => { if (!sideOpen) shell.classList.add("side-peek"); }, 160); };
  side.addEventListener("mouseenter", () => peek(true));
  side.addEventListener("mouseleave", () => { peekBlocked = false; peek(false); });
  $$(".sidebar .nav a, .sidebar .brand", shell).forEach((a) => a.addEventListener("click", () => { if (!sideOpen) { peekBlocked = true; peek(false); } }));
  side.addEventListener("focusin", () => { if (!sideOpen && !peekBlocked && matchMedia("(min-width: 901px)").matches) shell.classList.add("side-peek"); });
  side.addEventListener("focusout", (e) => { if (!side.contains(e.relatedTarget)) peek(false); });
  view.addEventListener("keydown", work);
  closeSide = () => { peekBlocked = true; setOpen(false); };
  if (!escBound) { escBound = true; document.addEventListener("keydown", (e) => { if (e.key === "Escape" && sideOpen && !document.querySelector(".overlay, .scope-pop")) closeSide(); }); }
  wireInstall(root);
  mountPicker($("#scope-btn"), app);
  $$("[data-lang]").forEach((b) => b.addEventListener("click", () => { setLang(b.dataset.lang); renderShell(); route(); }));
  $("#theme-btn").addEventListener("click", () => { cycleTheme(); $("#theme-btn").textContent = themeLabel(); });
  $("#signout-btn").addEventListener("click", async () => { await api.auth.signOut(); });
}

export function applyLogos() {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  $$("[data-logo]").forEach((img) => { img.src = `assets/${img.dataset.logo === "full" ? "logo" : "emblem"}-${dark || img.closest(".sidebar") ? "white" : "navy"}.png`; });
}
new MutationObserver(applyLogos).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

let routeToken = 0;
async function route() {
  const view = $("#view");
  if (!view) return;
  const allowed = SECTIONS.filter((s) => app.allowed(s));
  const parts = location.hash.replace(/^#\//, "").split("?")[0].split("/").filter(Boolean);
  app.subRoute = parts.slice(1);
  const section = allowed.find((s) => s.id === (parts[0] || "inicio")) || allowed[0];
  $$("[data-nav]").forEach((a) => a.setAttribute("aria-current", a.dataset.nav === (section && section.id) ? "page" : "false"));
  if (!section) return setHTML(view, html`<p class="empty">${t("noAccess")}</p>`);
  const token = ++routeToken;
  setHTML(view, html`<div class="center-screen small"><div class="spinner" aria-hidden="true"></div></div>`);
  try {
    const mod = await section.load();
    if (token !== routeToken) return;
    await mod.render(view, app);
  } catch (err) {
    console.error(err);
    if (token === routeToken) setHTML(view, html`<p class="error-box">${err.message || t("errorGeneric")}</p>`);
  }
}
window.addEventListener("hashchange", route);

api.auth.onChange((event, session) => {
  const uid = session ? session.user.id : null;
  if (event === "SIGNED_OUT" || (event === "SIGNED_IN" && uid !== lastUser)) boot();
});

boot();

function editName() {
  const c = app.ctx;
  const m = modal(t("editName"), html`<form id="f" novalidate>
    <fieldset class="treat" aria-label="${t("treatmentLabel")}">
      <label><input type="radio" name="treatment" value="hermano"${c.treatment !== "hermana" ? " checked" : ""}> ${t("treatHermano")}</label>
      <label><input type="radio" name="treatment" value="hermana"${c.treatment === "hermana" ? " checked" : ""}> ${t("treatHermana")}</label>
    </fieldset>
    ${field(t("firstName"), html`<input name="first" required maxlength="60" autocomplete="given-name" value="${c.first_name || ""}">`)}
    ${field(t("lastName"), html`<input name="last" required maxlength="60" autocomplete="family-name" value="${c.last_name || ""}">`)}
    <p class="muted small">${c.email}</p>
    <p class="error-box" id="err" role="alert" hidden></p>
    <div class="row end"><button type="button" data-close>${t("cancel")}</button><button class="primary" type="submit">${t("save")}</button></div></form>`);
  const fm = $("#f", m.el);
  fm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#err", m.el), btn = $("[type=submit]", fm), f = fm.first.value.trim(), l = fm.last.value.trim();
    if (f.length < 2 || l.length < 2) { err.textContent = t("errYourName"); err.hidden = false; return; }
    btn.disabled = true;
    try {
      await api.setMyName(f, l, fm.treatment.value);
      Object.assign(app.ctx, { first_name: f, last_name: l, treatment: fm.treatment.value, full_name: f + " " + l });
      m.close(); toast(t("saved")); renderShell(); route();
    } catch (x) { btn.disabled = false; err.textContent = x.message; err.hidden = false; }
  });
}
