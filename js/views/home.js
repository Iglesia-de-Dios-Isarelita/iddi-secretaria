import { t } from "../i18n.js";
import { html, setHTML, $, fmtDate } from "../util.js";
import * as api from "../api.js";
import { periodDates, wireRows } from "./common.js";

export async function render(view, app) {
  const [from, to] = periodDates("month");
  const key = app.scopeKey;
  const area = app.areaOrg();
  const [month, recent, trends, letters, circs] = await Promise.all([
    app.can("services.view") ? api.services(app.orgIds, { from, to }).catch(() => null) : null,
    app.can("services.view") ? api.services(app.orgIds, {}).catch(() => null) : null,
    app.can("trends.view") && area ? api.trends(area, from, to).catch(() => null) : null,
    app.can("letters.approve") ? api.letters(app.orgIds).catch(() => []) : [],
    app.can("circulars.acknowledge") ? api.circulars().catch(() => []) : [],
  ]);
  if (key !== app.scopeKey) return;
  const pending = (letters || []).filter((l) => l.status === "pending_approval" && app.orgIds.includes(l.organization_id));
  const mineChurches = new Set(app.inScope().filter((o) => o.kind === "church" && app.recordChurchFor(o.id, ["secretario_local", "encargado_local"])).map((o) => o.id));
  const unacked = (circs || []).filter((c) => c.status === "sent" && c.sec_circular_recipients.some((r) => mineChurches.has(r.organization_id) && !r.acknowledged_at));
  const rec = recent ? recent.rows.slice(0, 6) : [];
  const record = app.can("services.manage") && app.recordChurch();

  setHTML(view, html`
    <div class="dash-head"><div>${app.greeting() ? html`<p class="greet">${app.greeting()}</p>` : ""}<h1>${t("homeGreet")}</h1>
      <p class="muted small crumbs-line">${app.scopeParts.join(" › ")}</p></div>
      ${record ? html`<a class="btn btn-primary" href="#/predicaciones/nueva">${t("quickNew")}</a>` : ""}</div>
    <section class="grid kpis">
      ${month ? html`<a class="kpi" href="#/predicaciones"><span>${t("tileServices")} · ${t("thisMonth")}</span><strong>${month.count ?? month.rows.length}</strong></a>` : ""}
      ${trends ? html`<a class="kpi" href="#/tendencias"><span>${t("tileAttendance")} · ${t("thisMonth")}</span><strong>${trends.attendance.average}</strong></a>` : ""}
      ${app.can("letters.approve") ? html`<a class="kpi" href="#/cartas/por-aprobar"><span>${t("tilePendingLetters")}</span><strong class="${pending.length ? "warn-text" : ""}">${pending.length}</strong></a>` : ""}
      ${app.can("circulars.acknowledge") ? html`<a class="kpi" href="#/circulares"><span>${t("tilePendingCirculars")}</span><strong class="${unacked.length ? "warn-text" : ""}">${unacked.length}</strong></a>` : ""}
    </section>
    ${recent ? html`<section class="panel"><div class="row between"><h2>${t("recentServices")}</h2><a href="#/predicaciones">${t("seeAll")}</a></div>
      ${rec.length ? html`<ul class="txlist">${rec.map((s) => html`<li class="click" data-svc="${s.id}" tabindex="0"><span class="grow"><span>${s.title}</span>
        <small class="muted">${fmtDate(s.service_date)} · ${app.typeName(s.service_type_id)} · ${s.preacher_name}${app.orgId ? "" : ` · ${app.orgName(s.organization_id)}`}</small></span>
        <span class="amt">${s.attendance_total}</span></li>`)}</ul>` : html`<p class="empty">${t("empty")}</p>`}</section>` : ""}
    ${!month && !app.can("letters.approve") ? html`<p class="note-box">${t("homeHelp")}</p>` : ""}`);
  wireRows(view, "svc", (id) => { location.hash = "#/predicaciones/" + id; });
  const g = $(".greet", view); if (g) g.hidden = false;
}
