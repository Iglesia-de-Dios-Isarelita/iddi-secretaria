// Circulars: zone, national and international administrations send them; each church acknowledges receipt.
import { t } from "../i18n.js";
import { html, setHTML, $, $$, fmtDateTime } from "../util.js";
import { modal, toast, field, options } from "../ui.js";
import * as api from "../api.js";
import { fileField, takeFile, fileButton, wireFiles, onSubmit, formFoot, wireRows, err } from "./common.js";

export async function render(view, app) {
  const senders = app.can("circulars.send") ? app.orgsWhere((o) => o.kind === "administration" && ["zone", "national", "international"].includes(o.admin_level)) : [];
  // Churches whose receipt this person can acknowledge.
  const ackOrgs = new Set(app.inScope().filter((o) => o.kind === "church" && app.recordChurchFor(o.id, ["secretario_local", "encargado_local"])).map((o) => o.id));
  const rows = await api.circulars();
  const sent = new Set(senders);

  setHTML(view, html`
    <div class="row between"><h1>${t("circularsTitle")}</h1>${senders.length ? html`<button class="primary" id="new">${t("newCircular")}</button>` : ""}</div>
    <div class="panel">${rows.length ? html`<ul class="txlist">${rows.map((c) => {
      const rec = c.sec_circular_recipients || [];
      const mine = rec.filter((r) => ackOrgs.has(r.organization_id));
      const open = mine.filter((r) => !r.acknowledged_at);
      const acked = rec.filter((r) => r.acknowledged_at).length;
      return html`<li class="click" data-circ="${c.id}" tabindex="0"><span class="grow"><span>${c.title}${c.file_path ? " 📎" : ""}</span>
        <small class="muted">${t("fromOrg")}: ${app.orgName(c.from_organization_id)} · ${fmtDateTime(c.sent_at)}${sent.has(c.from_organization_id) ? ` · ${t("ackCount", { a: acked, n: rec.length })}` : ""}</small></span>
        ${mine.length ? html`<span class="badge ${open.length ? "warn" : "ok"}">${t(open.length ? "notAcknowledged" : "acknowledged")}</span>` : ""}</li>`; })}</ul>`
      : html`<p class="empty">${t("empty")}</p>`}</div>`);

  const reload = () => app.rerender();
  const show = (id) => detail(app, rows.find((c) => c.id === id), ackOrgs, sent, reload);
  wireRows(view, "circ", show);
  const nb = $("#new", view); if (nb) nb.addEventListener("click", () => sendForm(app, senders, reload));
  const sub = app.subRoute[0];
  if (sub && rows.some((c) => c.id === sub)) { history.replaceState(null, "", "#/circulares"); show(sub); }
}

function detail(app, c, ackOrgs, sent, reload) {
  const rec = c.sec_circular_recipients || [];
  const mine = rec.filter((r) => ackOrgs.has(r.organization_id));
  const m = modal(c.title, html`
    <p class="meta-line muted">${t("fromOrg")}: ${app.orgName(c.from_organization_id)} · ${fmtDateTime(c.sent_at)}</p>
    ${c.body ? html`<div class="prose">${c.body}</div>` : ""}
    <div class="row end">${fileButton(c.file_path)}</div>
    ${mine.length ? html`<h3>${t("acknowledge")}</h3><ul class="plain-list">${mine.map((r) => html`<li class="row between"><span>${app.orgName(r.organization_id)}</span>
      ${r.acknowledged_at ? html`<span class="badge ok">${t("acknowledged")} · ${fmtDateTime(r.acknowledged_at)}</span>` : html`<button type="button" class="primary" data-ack="${r.organization_id}">${t("acknowledge")}</button>`}</li>`)}</ul>` : ""}
    ${sent.has(c.from_organization_id) ? html`<h3>${t("recipients")} · ${t("ackCount", { a: rec.filter((r) => r.acknowledged_at).length, n: rec.length })}</h3>
      <ul class="plain-list">${rec.map((r) => html`<li class="row between"><span>${app.orgName(r.organization_id)}</span>
        <span class="badge ${r.acknowledged_at ? "ok" : "muted"}">${r.acknowledged_at ? fmtDateTime(r.acknowledged_at) : t("notAcknowledged")}</span></li>`)}</ul>` : ""}`, { wide: true });
  wireFiles(m.el);
  $$("[data-ack]", m.el).forEach((b) => b.addEventListener("click", async () => {
    b.disabled = true;
    try { await api.circularAck(c.id, b.dataset.ack); m.close(); toast(t("ackToast")); reload(); } catch (x) { b.disabled = false; toast(err(x), "error"); }
  }));
}

// The churches inside an administration's area, from the organizations the person can see.
function areaChurches(app, adminId) {
  const a = app.orgById.get(adminId);
  if (!a) return [];
  return app.inScope().filter((o) => o.kind === "church" && (a.admin_level === "international"
    || (a.admin_level === "national" && o.country_id === a.country_id) || (a.admin_level === "zone" && o.zone_id === a.zone_id)));
}

function sendForm(app, senders, reload) {
  const m = modal(t("newCircular"), html`<form id="f" novalidate>
    ${field(t("fromOrg"), html`<select name="org" required>${options(senders.map((id) => [id, app.orgName(id)]), senders.length === 1 ? senders[0] : "", senders.length === 1 ? null : t("chooseOrg"))}</select>`)}
    ${field(t("title"), html`<input name="title" required maxlength="200">`)}
    ${field(t("circularBody"), html`<textarea name="body" rows="6"></textarea>`)}
    ${fileField(null)}
    <fieldset><legend>${t("recipients")}</legend>
      <label class="opt-line"><input type="radio" name="to" value="all" checked> ${t("allInArea")}</label>
      <label class="opt-line"><input type="radio" name="to" value="pick"> ${t("selectChurches")}</label>
      <div class="chips" id="pick" hidden></div></fieldset>
    ${formFoot()}</form>`, { wide: true });
  const fm = $("#f", m.el), pick = $("#pick", m.el);
  const fill = () => setHTML(pick, html`${areaChurches(app, fm.org.value).map((o) => html`<label class="chip-opt"><input type="checkbox" name="church" value="${o.id}"> ${app.orgName(o.id)}</label>`)}`);
  fm.org.addEventListener("change", fill); fill();
  fm.addEventListener("change", (e) => { if (e.target.name === "to") pick.hidden = fm.to.value !== "pick"; });
  onSubmit(m, fm, async () => {
    const org = fm.org.value;
    if (!org) throw new Error(t("chooseOrg"));
    if (!fm.title.value.trim()) throw new Error(t("titleRequired"));
    const targets = fm.to.value === "pick" ? $$("[name=church]:checked", fm).map((x) => x.value) : null;
    if (targets && !targets.length) throw new Error(t("chooseChurches"));
    const file = await takeFile(fm, "circulars", org, null);
    await api.circularSend({ from: org, title: fm.title.value.trim(), body: fm.body.value.trim(), file, targets });
    m.close(); toast(t("saved")); reload();
  });
}
