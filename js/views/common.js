// Pieces shared by several sections: file fields, opening files, reason prompts and the agreement form.
import { t, getLang } from "../i18n.js";
import { html, raw, $, $$, esc, fmtDate, todayISO, friendlyError } from "../util.js";
import { modal, toast, field, options } from "../ui.js";
import { MAX_FILE_BYTES, FILE_TYPES } from "../config.js";
import * as api from "../api.js";

export const err = (x) => friendlyError(x, t);

/** File input with the current file noted. */
export const fileField = (current, label = t("file")) =>
  field(label, html`<input type="file" name="file" accept="${FILE_TYPES}">`, current ? `${t("fileHint")} ${t("keepFile")}` : t("fileHint"));

/** Uploads the chosen file (if any) and returns its storage path, or the current one. */
export async function takeFile(form, category, orgId, current) {
  const f = form.file && form.file.files[0];
  if (!f) return current || null;
  if (f.size > MAX_FILE_BYTES) throw new Error(t("fileTooBig"));
  return api.upload(category, orgId, f);
}

export function fileButton(path, label = t("openFile")) {
  return path ? html`<button type="button" class="ghost" data-file="${path}">📎 ${label}</button>` : "";
}
export function wireFiles(root) {
  $$("[data-file]", root).forEach((b) => b.addEventListener("click", async () => {
    const w = window.open("", "_blank");
    try { const url = await api.fileUrl(b.dataset.file); if (w) w.location = url; else location.href = url; }
    catch (x) { if (w) w.close(); toast(err(x), "error"); }
  }));
}

/** Asks for a reason (void, reject, revoke). Resolves to the text, or null when cancelled. */
export function askReason(title, label = t("reason")) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal(title, html`<form id="rf" novalidate>
      ${field(label, html`<textarea name="reason" rows="3" maxlength="500" required></textarea>`)}
      <p class="error-box" id="rerr" role="alert" hidden></p>
      <div class="row end"><button type="button" data-close>${t("cancel")}</button><button class="primary" type="submit">${t("save")}</button></div></form>`);
    const fm = $("#rf", m.el);
    fm.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = fm.reason.value.trim();
      if (!v) { const r = $("#rerr", m.el); r.textContent = t("reasonRequired"); r.hidden = false; return; }
      done = true; m.close(); resolve(v);
    });
    new MutationObserver((_, obs) => { if (!document.body.contains(m.el)) { obs.disconnect(); if (!done) resolve(null); } }).observe(document.body, { childList: true });
  });
}

/** Wraps a submit handler: disables the button, shows errors in #err, closes on success. */
export function onSubmit(m, form, run) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const box = $("#err", m.el), btn = $("[type=submit]", form);
    box.hidden = true; btn.disabled = true;
    try { await run(); }
    catch (x) { if (!(x instanceof Error)) console.error(x); box.textContent = err(x); box.hidden = false; btn.disabled = false; }
  });
}
export const formFoot = () => html`<p class="error-box" id="err" role="alert" hidden></p>
  <div class="row end"><button type="button" data-close>${t("cancel")}</button><button class="primary" type="submit">${t("save")}</button></div>`;

export const PERIODS = ["month", "quarter", "year", "lastYear", "all"];
export function periodDates(p) {
  const d = new Date(), y = d.getFullYear(), m = d.getMonth(), pad = (n) => String(n).padStart(2, "0");
  switch (p) {
    case "month": return [`${y}-${pad(m + 1)}-01`, todayISO()];
    case "quarter": return [`${y}-${pad(Math.floor(m / 3) * 3 + 1)}-01`, todayISO()];
    case "year": return [`${y}-01-01`, todayISO()];
    case "lastYear": return [`${y - 1}-01-01`, `${y - 1}-12-31`];
    default: return ["2000-01-01", todayISO()];
  }
}
export const periodSelect = (sel, name = "period") => html`<select name="${name}">${options(PERIODS.map((p) => [p, t("p" + p[0].toUpperCase() + p.slice(1))]), sel)}</select>`;

export const L = (row, base) => (getLang() === "en" ? row[base + "_en"] : row[base + "_es"]) || row[base + "_es"] || "";

// ---------- agreements (conciliar and society/department share one form) ----------
const ST = { vigente: "ok", derogado: "warn", anulado: "muted" };
export const agrBadge = (s) => html`<span class="badge ${ST[s] || ""}">${t("st_" + s)}</span>`;

export function agreementTable(rows, app) {
  return rows.length ? html`<div class="table-wrap"><table>
    <thead><tr><th>${t("agrNumber")}</th><th>${t("agrTopic")}</th><th>${t("issuedBy")}</th><th>${t("sessionDate")}</th><th>${t("status")}</th></tr></thead>
    <tbody>${rows.map((a) => html`<tr class="click${a.status !== "vigente" ? " voided" : ""}" data-agr="${a.id}" tabindex="0">
      <td><strong>${a.number || "—"}</strong></td><td>${a.topic}</td><td>${app.orgName(a.organization_id)}</td>
      <td>${a.session_date ? fmtDate(a.session_date) : ""}${a.session ? html`<br><small class="muted">${a.session}</small>` : ""}</td><td>${agrBadge(a.status)}</td></tr>`)}</tbody></table></div>`
    : html`<p class="empty">${t("empty")}</p>`;
}

/** Opens one agreement. `writable(org)` says whether this person may change it. */
export async function agreementDetail(app, id, { writable, choices, onChange }) {
  const a = await api.agreement(id);
  const can = writable(a.organization_id);
  const m = modal(`${a.number || ""} · ${a.topic}`, html`
    <p class="meta-line">${agrBadge(a.status)} <span class="muted">${t("issuedBy")}: ${app.orgName(a.organization_id)}</span></p>
    <dl class="details-list">
      ${a.session ? html`<dt>${t("session")}</dt><dd>${a.session}</dd>` : ""}
      ${a.session_date ? html`<dt>${t("sessionDate")}</dt><dd>${fmtDate(a.session_date)}</dd>` : ""}
      ${a.status_reason ? html`<dt>${t("reason")}</dt><dd>${a.status_reason}</dd>` : ""}
    </dl>
    <div class="prose">${a.body}</div>
    <div class="row end">${fileButton(a.file_path)}
      ${can && a.status === "vigente" ? html`<button type="button" class="ghost" id="a-edit">${t("edit")}</button>
        <button type="button" class="ghost" id="a-derog">${t("derogate")}</button><button type="button" class="ghost danger" id="a-annul">${t("annul")}</button>` : ""}
      ${can && a.status !== "vigente" ? html`<button type="button" class="ghost" id="a-back">${t("reinstate")}</button>` : ""}
    </div>`, { wide: true });
  wireFiles(m.el);
  const setStatus = async (status) => {
    const reason = status === "vigente" ? null : await askReason(t(status === "derogado" ? "derogate" : "annul"));
    if (status !== "vigente" && !reason) return;
    try { await api.agreementSetStatus(a.id, status, reason); m.close(); toast(t("saved")); onChange(); } catch (x) { toast(err(x), "error"); }
  };
  const on = (sel, fn) => { const b = $(sel, m.el); if (b) b.addEventListener("click", fn); };
  on("#a-edit", () => { m.close(); agreementForm(app, a, choices, onChange); });
  on("#a-derog", () => setStatus("derogado"));
  on("#a-annul", () => setStatus("anulado"));
  on("#a-back", () => setStatus("vigente"));
}

export function agreementForm(app, row, choices, onDone) {
  const r = row || {};
  const m = modal(t(row ? "editAgreement" : "newAgreement"), html`<form id="f" novalidate>
    ${field(t("issuedBy"), html`<select name="org" required ${row ? "disabled" : ""}>${options(choices.map((id) => [id, app.orgName(id)]), r.organization_id || (choices.length === 1 ? choices[0] : ""), choices.length === 1 ? null : t("chooseOrg"))}</select>`)}
    ${row ? html`<p class="muted small">${t("agrNumber")}: <strong>${r.number}</strong></p>` : html`<p class="muted small">${t("numberAuto")}</p>`}
    <div class="grid two" style="gap:.6rem">
      ${field(t("session"), html`<input name="session" maxlength="120" value="${r.session || ""}">`)}
      ${field(t("sessionDate"), html`<input type="date" name="sdate" value="${r.session_date || todayISO()}">`)}
    </div>
    ${field(t("agrTopic"), html`<input name="topic" required maxlength="200" value="${r.topic || ""}">`)}
    ${field(t("agrBody"), html`<textarea name="body" rows="6" required>${r.body || ""}</textarea>`)}
    ${fileField(r.file_path)}
    ${formFoot()}</form>`, { wide: true });
  const fm = $("#f", m.el);
  onSubmit(m, fm, async () => {
    const org = row ? r.organization_id : fm.org.value;
    if (!org) throw new Error(t("chooseOrg"));
    if (!fm.topic.value.trim() || !fm.body.value.trim()) throw new Error(t("titleRequired"));
    const file = await takeFile(fm, "agreements", org, r.file_path);
    await api.agreementSave({ id: r.id, org, session: fm.session.value.trim(), sessionDate: fm.sdate.value || null, topic: fm.topic.value.trim(), body: fm.body.value.trim(), file });
    m.close(); toast(t("saved")); onDone();
  });
}

export function wireRows(root, attr, fn) {
  $$(`[data-${attr}]`, root).forEach((tr) => {
    tr.addEventListener("click", (e) => { if (!e.target.closest("button,a")) fn(tr.dataset[attr]); });
    tr.addEventListener("keydown", (e) => { if (e.key === "Enter") fn(tr.dataset[attr]); });
  });
}
export { raw, esc };
