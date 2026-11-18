import { t } from "../i18n.js";
import { html, setHTML, $, $$, fmtDate, todayISO } from "../util.js";
import { modal, toast, field, options } from "../ui.js";
import * as api from "../api.js";
import { fileField, takeFile, fileButton, wireFiles, askReason, onSubmit, formFoot, periodDates, periodSelect, wireRows, err } from "./common.js";

const ATT = ["men", "women", "youth", "children", "visitors"];
let filters = { period: "year", type: "", topic: "", text: "", voided: false };

export async function render(view, app) {
  const key = app.scopeKey;
  const canRecord = app.can("services.manage") && app.recordChurch();
  const isLocalSec = app.hasRole(["secretario_local"]);
  let page = 0, rows = [], count = 0;

  setHTML(view, html`
    <div class="row between"><h1>${t("servicesTitle")}</h1>${canRecord ? html`<button class="primary" id="new">${t("newService")}</button>` : ""}</div>
    ${!canRecord && isLocalSec && app.can("services.manage") ? html`<p class="note-box">${t("recordOnlyOwnChurch")}</p>` : ""}
    <form class="panel filters" id="flt">
      ${field(t("period"), periodSelect(filters.period))}
      ${field(t("serviceType"), html`<select name="type">${options(app.types.map((x) => [x.id, app.typeName(x.id)]), filters.type, t("anyType"))}</select>`)}
      ${field(t("topics"), html`<select name="topic">${options(app.topics.map((x) => [x.id, app.topicName(x.id)]), filters.topic, t("anyTopic"))}</select>`)}
      ${field(t("textFilter"), html`<input name="text" type="search" value="${filters.text}">`)}
      <label class="opt-line"><input type="checkbox" name="voided"${filters.voided ? " checked" : ""}> ${t("showVoided")}</label>
    </form>
    <div class="panel" id="list"><div class="center-screen small"><div class="spinner"></div></div></div>`);

  const load = async (more) => {
    const [from, to] = periodDates(filters.period);
    const r = await api.services(app.orgIds, { ...filters, from, to }, page);
    if (key !== app.scopeKey) return;
    rows = more ? rows.concat(r.rows) : r.rows; count = r.count || 0;
    draw();
  };
  const draw = () => {
    const box = $("#list", view);
    setHTML(box, rows.length ? html`<div class="table-wrap"><table>
      <thead><tr><th>${t("date")}</th><th>${t("title")}</th><th>${t("serviceType")}</th><th>${t("preacher")}</th>${app.orgId ? "" : html`<th>${t("churchCol")}</th>`}<th class="num">${t("attendance")}</th></tr></thead>
      <tbody>${rows.map((s) => html`<tr class="click${s.status === "voided" ? " voided" : ""}" data-svc="${s.id}" tabindex="0">
        <td>${fmtDate(s.service_date)}</td><td>${s.title}${s.status === "voided" ? html` <span class="badge muted">${t("voided")}</span>` : ""}${s.presentation_path ? " 📎" : ""}</td>
        <td>${app.typeName(s.service_type_id)}</td><td>${s.preacher_name}</td>${app.orgId ? "" : html`<td>${app.orgName(s.organization_id)}</td>`}
        <td class="num">${s.attendance_total}</td></tr>`)}</tbody></table></div>
      ${(page + 1) * 50 < count ? html`<div class="row center"><button type="button" class="ghost" id="more">${t("loadMore")}</button></div>` : ""}`
      : html`<p class="empty">${t("empty")}</p>`);
    wireRows(box, "svc", (id) => { location.hash = "#/predicaciones/" + id; });
    const mb = $("#more", box); if (mb) mb.addEventListener("click", () => { page++; load(true); });
  };

  const fm = $("#flt", view);
  let timer;
  fm.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => {
    filters = { period: fm.period.value, type: fm.type.value, topic: fm.topic.value, text: fm.text.value.trim(), voided: fm.voided.checked };
    page = 0; load(false).catch((x) => toast(err(x), "error"));
  }, 300); });
  fm.addEventListener("submit", (e) => e.preventDefault());
  const nb = $("#new", view); if (nb) nb.addEventListener("click", () => serviceForm(app, null, () => load(false)));

  await load(false);
  const sub = app.subRoute[0];
  if (sub === "nueva" && canRecord) { history.replaceState(null, "", "#/predicaciones"); serviceForm(app, null, () => load(false)); }
  else if (sub) { history.replaceState(null, "", "#/predicaciones"); detail(app, sub, () => load(false)); }
}

async function detail(app, id, reload) {
  let s;
  try { s = await api.service(id); } catch (x) { return toast(err(x), "error"); }
  const cites = (s.sec_service_citations || []).sort((a, b) => a.position - b.position);
  const canEdit = s.status === "posted" && app.can("services.manage") && app.recordChurchFor(s.organization_id, ["secretario_local"]);
  const m = modal(s.title, html`
    <p class="meta-line">${fmtDate(s.service_date)} · ${app.typeName(s.service_type_id)} · ${app.orgName(s.organization_id)}
      ${s.status === "voided" ? html` <span class="badge muted">${t("voided")}</span>` : ""}</p>
    ${s.status === "voided" ? html`<p class="note-box">${t("voidedBy", { reason: s.void_reason || "" })}</p>` : ""}
    <dl class="details-list"><dt>${t("preacher")}</dt><dd>${s.preacher_name}</dd>
      <dt>${t("topics")}</dt><dd>${(s.sec_service_topics || []).map((x) => app.topicName(x.topic_id)).join(", ") || "—"}</dd></dl>
    <h3>${t("attendance")}</h3>
    <div class="att-grid">${ATT.map((k) => html`<div><small>${t(k)}</small><strong>${s["attendance_" + k]}</strong></div>`)}<div class="tot"><small>${t("total")}</small><strong>${s.attendance_total}</strong></div></div>
    <h3>${t("citations")}</h3>
    <ol class="cites">${cites.map((c) => html`<li><strong>${c.reference}</strong>${c.comment ? html` — <span>${c.comment}</span>` : ""}</li>`)}</ol>
    ${s.notes ? html`<h3>${t("notes")}</h3><div class="prose">${s.notes}</div>` : ""}
    <div class="row end">${fileButton(s.presentation_path)}
      ${canEdit ? html`<button type="button" class="ghost" id="s-edit">${t("edit")}</button><button type="button" class="ghost danger" id="s-void">${t("voidService")}</button>` : ""}</div>`, { wide: true });
  wireFiles(m.el);
  const eb = $("#s-edit", m.el); if (eb) eb.addEventListener("click", () => { m.close(); serviceForm(app, { ...s, cites }, reload); });
  const vb = $("#s-void", m.el); if (vb) vb.addEventListener("click", async () => {
    const reason = await askReason(t("confirmVoidService"));
    if (!reason) return;
    try { await api.serviceVoid(s.id, reason); m.close(); toast(t("saved")); reload(); } catch (x) { toast(err(x), "error"); }
  });
}

function serviceForm(app, row, reload) {
  const r = row || {};
  const org = r.organization_id || app.recordChurch();
  const topicSet = new Set((r.sec_service_topics || []).map((x) => x.topic_id));
  const types = app.types.filter((x) => x.active || x.id === r.service_type_id);
  const topics = app.topics.filter((x) => x.active || topicSet.has(x.id));
  const cites = r.cites && r.cites.length ? r.cites : [{ reference: "", comment: "" }];
  const citeRow = (c, i) => html`<div class="cite-row" data-cite>
    <input name="ref" maxlength="120" placeholder="${t("citationRef")}" aria-label="${t("citation")} ${i + 1}" value="${c.reference || ""}" ${i === 0 ? "required" : ""}>
    <input name="com" maxlength="300" placeholder="${t("citationComment")}" aria-label="${t("citationComment")}" value="${c.comment || ""}">
    ${i === 0 ? html`<span class="cite-pad"></span>` : html`<button type="button" class="icon-btn" data-rm aria-label="${t("remove")}">×</button>`}</div>`;

  const m = modal(t(row ? "editService" : "newService"), html`<form id="f" novalidate>
    <p class="muted small">${app.orgName(org)}</p>
    <div class="grid two" style="gap:.6rem">
      ${field(t("date"), html`<input type="date" name="date" required max="${todayISO()}" value="${r.service_date || todayISO()}">`)}
      ${field(t("serviceType"), html`<select name="type" required>${options(types.map((x) => [x.id, app.typeName(x.id)]), r.service_type_id || (types.length === 1 ? types[0].id : ""), t("typeRequired"))}</select>`)}
    </div>
    ${field(t("title"), html`<input name="title" required maxlength="200" value="${r.title || ""}">`)}
    ${field(t("preacher"), html`<input name="preacher" required maxlength="120" value="${r.preacher_name || ""}">`)}
    <fieldset class="att-fields"><legend>${t("attendance")}</legend>
      ${ATT.map((k) => field(t(k), html`<input type="number" name="att_${k}" min="0" step="1" inputmode="numeric" value="${r["attendance_" + k] ?? 0}">`))}
      <div class="att-total"><small>${t("total")}</small><strong id="att-total">0</strong></div></fieldset>
    <fieldset class="chips-field"><legend>${t("topics")}</legend><div class="chips">
      ${topics.map((x) => html`<label class="chip-opt"><input type="checkbox" name="topic" value="${x.id}"${topicSet.has(x.id) ? " checked" : ""}> ${app.topicName(x.id)}</label>`)}</div></fieldset>
    <fieldset><legend>${t("citations")}</legend><div id="cites">${cites.map(citeRow)}</div>
      <button type="button" class="ghost" id="add-cite">+ ${t("addCitation")}</button></fieldset>
    ${field(t("notes"), html`<textarea name="notes" rows="3" maxlength="4000">${r.notes || ""}</textarea>`)}
    ${fileField(r.presentation_path, t("presentation"))}
    ${formFoot()}</form>`, { wide: true });

  const fm = $("#f", m.el), box = $("#cites", m.el);
  const total = () => { $("#att-total", m.el).textContent = ATT.reduce((s, k) => s + (parseInt(fm["att_" + k].value, 10) || 0), 0); };
  fm.addEventListener("input", total); total();
  const wireRm = () => $$("[data-rm]", box).forEach((b) => { b.onclick = () => b.closest("[data-cite]").remove(); });
  wireRm();
  $("#add-cite", m.el).addEventListener("click", () => {
    box.insertAdjacentHTML("beforeend", String(citeRow({}, box.children.length)));
    wireRm(); $$("[data-cite]", box).pop().querySelector("input").focus();
  });

  onSubmit(m, fm, async () => {
    const citations = $$("[data-cite]", box).map((d) => ({ reference: d.querySelector("[name=ref]").value.trim(), comment: d.querySelector("[name=com]").value.trim() || null })).filter((c) => c.reference);
    if (!fm.type.value) throw new Error(t("typeRequired"));
    if (!fm.title.value.trim()) throw new Error(t("titleRequired"));
    if (!fm.preacher.value.trim()) throw new Error(t("preacherRequired"));
    if (!$$("[data-cite]", box)[0].querySelector("[name=ref]").value.trim()) throw new Error(t("firstCitationRequired"));
    const attendance = Object.fromEntries(ATT.map((k) => [k, Math.max(0, parseInt(fm["att_" + k].value, 10) || 0)]));
    const file = await takeFile(fm, "services", org, r.presentation_path);
    await api.serviceSave({ id: r.id, org, date: fm.date.value, type: fm.type.value, title: fm.title.value.trim(), preacher: fm.preacher.value.trim(),
      notes: fm.notes.value.trim(), attendance, topics: $$("[name=topic]:checked", fm).map((x) => x.value), citations, file });
    m.close(); toast(t("saved")); reload();
  });
}
