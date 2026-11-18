// What the person is looking at: all countries, one country, one zone, one church (each step optional).
// Shared with the Finance app. In Secretaría a choice filters sermons, letters and trends; recording needs one church.
import { t } from "./i18n.js";
import { html, setHTML, $, $$, esc } from "./util.js";

let model = null;

// Builds country → zone → church (→ society/department) from the structure and the organizations the person can see.
export function buildModel(tree, orgs) {
  const byId = new Map(orgs.map((o) => [o.id, o]));
  const hq = orgs.find((o) => o.kind === "administration" && o.admin_level === "international") || null;
  const subsOf = (id) => orgs.filter((o) => o.parent_organization_id === id && (o.kind === "society" || o.kind === "department"))
    .map((o) => ({ id: o.id, kind: o.kind, name: o.name }));
  const countries = (tree || []).map((c) => ({
    id: c.id, name: c.name, code: c.code,
    nationalOrg: c.national && c.national.org_id && byId.has(c.national.org_id) ? c.national.org_id : null,
    nationalName: c.national ? c.national.name : "",
    zones: (c.zones || []).map((z) => ({
      id: z.id, name: z.name, zoneOrg: z.org_id && byId.has(z.org_id) ? z.org_id : null,
      churches: (z.churches || []).filter((ch) => ch.active !== false && byId.has(ch.id))
        .map((ch) => ({ id: ch.id, name: ch.locality || ch.name, full: ch.name, subs: subsOf(ch.id) })),
    })).filter((z) => z.zoneOrg || z.churches.length),
  })).filter((c) => c.nationalOrg || c.zones.length);
  const covered = new Set(hq ? [hq.id] : []);
  countries.forEach((c) => { if (c.nationalOrg) covered.add(c.nationalOrg); c.zones.forEach((z) => { if (z.zoneOrg) covered.add(z.zoneOrg);
    z.churches.forEach((ch) => { covered.add(ch.id); ch.subs.forEach((s) => covered.add(s.id)); }); }); });
  const others = orgs.filter((o) => !covered.has(o.id)).map((o) => ({ id: o.id, name: o.display_name || o.name }));
  model = { hq, countries, others, allIds: orgs.map((o) => o.id) };
  return model;
}

const findCountry = (id) => model.countries.find((c) => c.id === id);
const shortZone = (name) => name.replace(/^Administración de la /i, "");

// Steps that only have one possible answer are filled in, so people never pick what has no alternative.
export function normalize(sel) {
  const s = { c: null, z: null, u: null, s: null, ...sel };
  const topCount = model.countries.length + (model.hq ? 1 : 0) + model.others.length;
  if (s.c === null && topCount === 1) s.c = model.countries.length ? model.countries[0].id : model.hq ? "hq" : "org:" + model.others[0].id;
  const c = findCountry(s.c);
  if (!c) return { c: s.c, z: null, u: null, s: null };
  if (s.z === null && c.zones.length === 1 && !c.nationalOrg) s.z = c.zones[0].id;
  const z = c.zones.find((x) => x.id === s.z);
  if (!z) return { c: s.c, z: s.z === "nat" && c.nationalOrg ? "nat" : null, u: null, s: null };
  if (s.u === null && z.churches.length === 1 && !z.zoneOrg) s.u = z.churches[0].id;
  const ch = z.churches.find((x) => x.id === s.u);
  if (!ch) return { c: s.c, z: s.z, u: s.u === "zadm" && z.zoneOrg ? "zadm" : null, s: null };
  return { c: s.c, z: s.z, u: s.u, s: s.s && (s.s === "all" || ch.subs.some((x) => x.id === s.s)) ? s.s : null };
}

// Turns a choice into the organizations it covers, the one set of books (if any) and a label.
export function resolve(sel) {
  const s = normalize(sel);
  const parts = [];
  const church = (ch) => [ch.id, ...ch.subs.map((x) => x.id)];
  const zoneIds = (z) => [...(z.zoneOrg ? [z.zoneOrg] : []), ...z.churches.flatMap(church)];
  if (s.c === null) return { sel: s, ids: model.allIds, single: null, parts: [t("scopeAll")] };
  if (s.c === "hq") return { sel: s, ids: [model.hq.id], single: model.hq.id, parts: [t("scopeHq")] };
  if (String(s.c).startsWith("org:")) { const o = model.others.find((x) => "org:" + x.id === s.c); return { sel: s, ids: [o.id], single: o.id, parts: [o.name] }; }
  const c = findCountry(s.c);
  parts.push(c.name);
  if (s.z === null) return { sel: s, ids: [...(c.nationalOrg ? [c.nationalOrg] : []), ...c.zones.flatMap(zoneIds)], single: null, parts };
  if (s.z === "nat") return { sel: s, ids: [c.nationalOrg], single: c.nationalOrg, parts: [...parts, c.nationalName] };
  const z = c.zones.find((x) => x.id === s.z);
  parts.push(shortZone(z.name));
  if (s.u === null) return { sel: s, ids: zoneIds(z), single: null, parts };
  if (s.u === "zadm") return { sel: s, ids: [z.zoneOrg], single: z.zoneOrg, parts: [...parts, t("scopeZoneBooks")] };
  const ch = z.churches.find((x) => x.id === s.u);
  parts.push(ch.name);
  if (s.s === "all") return { sel: s, ids: church(ch), single: null, parts: [...parts, t("scopeChurchAll")] };
  if (s.s) { const sub = ch.subs.find((x) => x.id === s.s); return { sel: s, ids: [sub.id], single: sub.id, parts: [...parts, sub.name] }; }
  return { sel: s, ids: [ch.id], single: ch.id, parts };
}

// Where an organization sits, so "show me this one" can jump straight to it.
export function pathOf(orgId) {
  if (model.hq && model.hq.id === orgId) return { c: "hq" };
  for (const c of model.countries) {
    if (c.nationalOrg === orgId) return { c: c.id, z: "nat" };
    for (const z of c.zones) {
      if (z.zoneOrg === orgId) return { c: c.id, z: z.id, u: "zadm" };
      for (const ch of z.churches) {
        if (ch.id === orgId) return { c: c.id, z: z.id, u: ch.id };
        if (ch.subs.some((x) => x.id === orgId)) return { c: c.id, z: z.id, u: ch.id, s: orgId };
      }
    }
  }
  if (model.others.some((o) => o.id === orgId)) return { c: "org:" + orgId };
  return null;
}

// Where someone starts: their own level (Secretaría roles carry a scope level).
export function defaultSel(ctx) {
  const roles = ((ctx && ctx.roles) || []).slice().sort((a, b) => b.rank - a.rank);
  for (const r of roles) {
    if (r.scope_level === "international") return {};
    if (r.scope_level === "national" && r.country_id && findCountry(r.country_id)) return { c: r.country_id };
    if (r.scope_level === "zone" && r.zone_id) { const c = model.countries.find((x) => x.zones.some((z) => z.id === r.zone_id)); if (c) return { c: c.id, z: r.zone_id }; }
    if (r.organization_id) { const p = pathOf(r.organization_id); if (p) return p; }
  }
  return {};
}
export const getModel = () => model;

// ---------- the picker ----------
export function mountPicker(btn, app) {
  let open = null;
  const close = () => { if (open) { open.remove(); open = null; btn.setAttribute("aria-expanded", "false"); } };
  btn.addEventListener("click", (e) => { e.stopPropagation(); if (open) close(); else show(); });
  document.addEventListener("click", (e) => { if (open && !open.contains(e.target) && e.target !== btn) close(); });
  document.addEventListener("keydown", (e) => { if (open && e.key === "Escape") { close(); btn.focus(); } });

  function show() {
    let draft = { ...app.scope };
    let query = "";
    open = document.createElement("div");
    open.className = "scope-pop";
    open.id = "scope-pop";
    open.setAttribute("role", "dialog");
    open.setAttribute("aria-label", t("scopeTitle"));
    btn.after(open);
    btn.setAttribute("aria-expanded", "true");
    draw();

    function chip(value, label, current, attr, extra = "") {
      return html`<button type="button" class="chip-opt${extra}" data-${attr}="${value === null ? "" : value}" aria-pressed="${current === value}">${label}</button>`;
    }
    function draw() {
      const s = normalize(draft), r = resolve(s);
      const c = findCountry(s.c), z = c && c.zones.find((x) => x.id === s.z), ch = z && z.churches.find((x) => x.id === s.u);
      const topCount = model.countries.length + (model.hq ? 1 : 0) + model.others.length;
      const steps = [];
      if (topCount > 1) steps.push(html`<div class="scope-step"><p class="scope-h">${t("scopeCountry")}</p><div class="chips">
        ${chip(null, t("scopeAll"), s.c, "c")}${model.hq ? chip("hq", t("scopeHq"), s.c, "c", " books") : ""}
        ${model.countries.map((x) => chip(x.id, html`<b class="code">${x.code}</b> ${x.name}`, s.c, "c"))}
        ${model.others.map((o) => chip("org:" + o.id, o.name, s.c, "c", " books"))}</div></div>`);
      if (c && (c.zones.length > 1 || c.nationalOrg)) steps.push(html`<div class="scope-step"><p class="scope-h">${t("scopeZone")} <span class="opt">${t("optional")}</span></p><div class="chips">
        ${chip(null, t("scopeAllZones"), s.z, "z")}${c.nationalOrg ? chip("nat", t("scopeNationalBooks"), s.z, "z", " books") : ""}
        ${c.zones.map((x) => chip(x.id, shortZone(x.name), s.z, "z"))}</div></div>`);
      if (z && (z.churches.length > 1 || z.zoneOrg)) {
        const list = z.churches.filter((x) => !query || x.name.toLowerCase().includes(query));
        steps.push(html`<div class="scope-step"><p class="scope-h">${t("scopeChurch")} <span class="opt">${t("optional")}</span></p>
          ${z.churches.length > 8 ? html`<input type="search" class="scope-search" id="scope-q" placeholder="${t("search")}" value="${query}">` : ""}
          <div class="chips">${chip(null, t("scopeAllChurches"), s.u, "u")}${z.zoneOrg ? chip("zadm", t("scopeZoneBooks"), s.u, "u", " books") : ""}
          ${list.map((x) => chip(x.id, x.name, s.u, "u"))}</div></div>`);
      }
      if (ch && ch.subs.length) steps.push(html`<div class="scope-step"><p class="scope-h">${t("scopeSub")} <span class="opt">${t("optional")}</span></p><div class="chips">
        ${chip(null, t("scopeChurchOnly"), s.s, "s")}${chip("all", t("scopeChurchAll"), s.s, "s")}
        ${ch.subs.map((x) => chip(x.id, x.name, s.s, "s"))}</div></div>`);
      setHTML(open, html`<div class="scope-head"><strong>${t("scopeTitle")}</strong><button type="button" class="ghost icon-btn" id="scope-x" aria-label="${t("close")}">×</button></div>
        ${steps.length ? steps : html`<p class="muted">${t("scopeOnlyOne")}</p>`}
        <div class="scope-foot"><p class="scope-sum">${r.single ? html`<span class="dot ok"></span>${t("scopeSingle")}` : html`<span class="dot"></span>${t("scopeCombined", { n: r.ids.length })}`}</p>
          <button type="button" class="primary" id="scope-apply">${t("scopeApply")}</button></div>`);
      const set = (k, v) => { draft = { ...normalize(draft), [k]: v === "" ? null : v };
        if (k === "c") Object.assign(draft, { z: null, u: null, s: null }); if (k === "z") Object.assign(draft, { u: null, s: null }); if (k === "u") draft.s = null;
        query = ""; draw(); };
      ["c", "z", "u", "s"].forEach((k) => $$(`[data-${k}]`, open).forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); set(k, b.dataset[k]); })));
      const q = $("#scope-q", open);
      if (q) q.addEventListener("input", () => { query = q.value.trim().toLowerCase(); const pos = q.selectionStart; draw(); const n = $("#scope-q", open); n.focus(); n.setSelectionRange(pos, pos); });
      $("#scope-x", open).addEventListener("click", close);
      $("#scope-apply", open).addEventListener("click", () => { close(); app.setScope(draft); btn.focus(); });
    }
  }
}

export const scopeButtonHtml = (parts) => `<span class="scope-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg></span><span class="scope-label">${parts.map((p) => esc(p)).join('<span class="sep">›</span>')}</span><span class="caret" aria-hidden="true">▾</span>`;
