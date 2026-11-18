// Trends: services held, attendance and topics preached for a church or an administration's area.
import { t } from "../i18n.js";
import { html, raw, setHTML, $, esc, monthLabel } from "../util.js";
import { field } from "../ui.js";
import * as api from "../api.js";
import { periodDates, periodSelect, L } from "./common.js";

let period = "year";
const ATT = ["men", "women", "youth", "children", "visitors"];

function bars(rows, value, label) {
  const max = Math.max(1, ...rows.map(value));
  return html`<ul class="bars-h">${rows.map((r) => html`<li><span>${label(r)}</span><strong>${value(r)}</strong><span class="track"><i style="width:${Math.round((value(r) / max) * 100)}%"></i></span></li>`)}</ul>`;
}
function columns(months) {
  const max = Math.max(1, ...months.map((m) => Number(m.average)));
  const W = 560, H = 190, pad = 28, gap = (W - pad * 2) / Math.max(1, months.length), bw = Math.min(28, gap * 0.6);
  const cols = months.map((m, i) => {
    const x = pad + i * gap + gap / 2, h = Math.round((Number(m.average) / max) * (H - 50));
    return `<rect class="bar-in" x="${x - bw / 2}" y="${H - 28 - h}" width="${bw}" height="${h}" rx="3"><title>${esc(monthLabel(m.month + "-01"))}: ${esc(m.average)} (${esc(m.services)} ${esc(t("servicesCount").toLowerCase())})</title></rect>
      <text class="axis" x="${x}" y="${H - 8}" text-anchor="middle">${esc(monthLabel(m.month + "-01"))}</text>`;
  }).join("");
  return raw(`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t("byMonth"))}" class="chart"><line class="axis-line" x1="${pad - 8}" y1="${H - 28}" x2="${W - pad + 8}" y2="${H - 28}"/>${cols}</svg>`);
}

export async function render(view, app) {
  const key = app.scopeKey;
  const org = app.areaOrg();
  if (!org) return setHTML(view, html`<h1>${t("trendsTitle")}</h1><p class="empty">${t("noOrganization")}</p>`);
  const [from, to] = periodDates(period);
  const d = await api.trends(org, from, to);
  if (key !== app.scopeKey) return;
  const a = d.attendance || {};
  setHTML(view, html`
    <div class="dash-head"><div><h1>${t("trendsTitle")} · ${app.orgName(org)}</h1><p class="muted small crumbs-line">${app.scopeParts.join(" › ")}</p></div>
      <form id="pf">${field(t("period"), periodSelect(period))}</form></div>
    <section class="grid kpis">
      <div class="kpi"><span>${t("servicesCount")}</span><strong>${d.services}</strong></div>
      <div class="kpi"><span>${t("avgAttendance")}</span><strong>${a.average ?? 0}</strong></div>
      <div class="kpi"><span>${t("totalAttendance")}</span><strong>${a.total ?? 0}</strong></div>
    </section>
    ${d.services ? html`
    <section class="grid two">
      <div class="panel"><h2>${t("byMonth")} · ${t("avgAttendance")}</h2>${(d.by_month || []).length ? columns(d.by_month) : html`<p class="empty">${t("noData")}</p>`}</div>
      <div class="panel"><h2>${t("attendance")}</h2>${bars(ATT.map((k) => ({ k, v: Number(a[k] || 0) })), (r) => r.v, (r) => t(r.k))}</div>
    </section>
    <section class="grid two">
      <div class="panel"><h2>${t("byType")}</h2><div class="table-wrap"><table><thead><tr><th>${t("serviceType")}</th><th class="num">${t("servicesCount")}</th><th class="num">${t("avgAttendance")}</th></tr></thead>
        <tbody>${(d.by_type || []).map((r) => html`<tr><td>${L(r, "type")}</td><td class="num">${r.services}</td><td class="num">${r.average}</td></tr>`)}</tbody></table></div></div>
      <div class="panel"><h2>${t("topTopics")}</h2>${(d.topics || []).length ? bars(d.topics, (r) => Number(r.services), (r) => L(r, "topic")) : html`<p class="empty">${t("noData")}</p>`}</div>
    </section>` : html`<p class="empty">${t("noData")}</p>`}`);
  $("#pf", view).addEventListener("change", (e) => { period = e.target.value; app.rerender(); });
}
