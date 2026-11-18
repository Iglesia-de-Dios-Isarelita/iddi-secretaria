// Official letters. Local letters are published right away; letters for all churches wait for the Encargado Local.
import { t } from "../i18n.js";
import { html, setHTML, $, fmtDate, todayISO } from "../util.js";
import { modal, toast, field, options } from "../ui.js";
import * as api from "../api.js";
import { fileField, takeFile, fileButton, wireFiles, askReason, onSubmit, formFoot, wireRows, err } from "./common.js";

const KINDS = ["anuncio", "nombramiento", "correspondencia", "otro"];
const BADGE = { published: "ok", pending_approval: "warn", rejected: "bad", voided: "muted" };
const badge = (s) => html`<span class="badge ${BADGE[s] || ""}">${t("ls_" + s)}</span>`;

export async function render(view, app) {
  const key = app.scopeKey;
  const tab = app.subRoute[0] === "por-aprobar" ? "pending" : "all";
  // Where a new letter is written: the chosen church, if the person is its Secretario Local (or the Master Administrator).
  const church = app.orgById.get(app.orgId);
  const writeOrg = app.can("letters.manage") && church && church.kind === "church" && (app.isMaster() || app.recordChurchFor(church.id, ["secretario_local"])) ? church.id : null;
  const canApprove = app.can("letters.approve");

  const rows = await api.letters(app.orgIds);
  if (key !== app.scopeKey) return;
  const pending = rows.filter((l) => l.status === "pending_approval");
  const shown = tab === "pending" ? pending : rows;

  setHTML(view, html`
    <div class="row between"><h1>${t("lettersTitle")}</h1>${writeOrg ? html`<button class="primary" id="new">${t("newLetter")}</button>` : ""}</div>
    ${!writeOrg && app.can("letters.manage") ? html`<p class="note-box">${t("recordOnlyOwnChurch")}</p>` : ""}
    ${canApprove ? html`<nav class="tabs-bar"><a href="#/cartas" class="tab-link" aria-current="${tab === "all" ? "page" : "false"}">${t("tabAll")}</a>
      <a href="#/cartas/por-aprobar" class="tab-link" aria-current="${tab === "pending" ? "page" : "false"}">${t("tabPending")} (${pending.length})</a></nav>` : ""}
    <div class="panel">${shown.length ? html`<div class="table-wrap"><table>
      <thead><tr><th>${t("date")}</th><th>${t("title")}</th><th>${t("letterKind")}</th><th>${t("churchCol")}</th><th>${t("audience")}</th><th>${t("status")}</th></tr></thead>
      <tbody>${shown.map((l) => html`<tr class="click${l.status === "voided" ? " voided" : ""}" data-letter="${l.id}" tabindex="0">
        <td>${fmtDate(l.letter_date)}</td><td>${l.title}${l.file_path ? " 📎" : ""}</td><td>${t("lk_" + l.kind)}</td><td>${app.orgName(l.organization_id) || "—"}</td>
        <td>${t("aud_" + l.audience)}</td><td>${badge(l.status)}</td></tr>`)}</tbody></table></div>` : html`<p class="empty">${t("empty")}</p>`}</div>`);

  const reload = () => app.rerender();
  wireRows(view, "letter", (id) => detail(app, id, reload));
  const nb = $("#new", view); if (nb) nb.addEventListener("click", () => letterForm(app, null, writeOrg, reload));
  const sub = app.subRoute[0];
  if (sub && sub !== "por-aprobar") { history.replaceState(null, "", "#/cartas"); detail(app, sub, reload); }
}

async function detail(app, id, reload) {
  let l;
  try { l = await api.letter(id); } catch (x) { return toast(err(x), "error"); }
  const mine = app.can("letters.manage") && (app.isMaster() || app.recordChurchFor(l.organization_id, ["secretario_local"]));
  const reviewer = app.can("letters.approve") && (app.isMaster() || app.recordChurchFor(l.organization_id, ["encargado_local"]));
  const m = modal(l.title, html`
    <p class="meta-line">${badge(l.status)} <span class="muted">${fmtDate(l.letter_date)} · ${t("lk_" + l.kind)} · ${app.orgName(l.organization_id)} · ${t("aud_" + l.audience)}</span></p>
    ${l.review_note ? html`<p class="note-box">${t("reviewNote")}: ${l.review_note}</p>` : ""}
    ${l.void_reason ? html`<p class="note-box">${t("voidedBy", { reason: l.void_reason })}</p>` : ""}
    ${l.body ? html`<div class="prose">${l.body}</div>` : ""}
    <div class="row end">${fileButton(l.file_path)}
      ${reviewer && l.status === "pending_approval" ? html`<button type="button" class="ghost danger" id="l-rej">${t("reject")}</button><button type="button" class="primary" id="l-ok">${t("approve")}</button>` : ""}
      ${mine && l.status !== "voided" ? html`<button type="button" class="ghost" id="l-edit">${t("edit")}</button><button type="button" class="ghost danger" id="l-void">${t("voidLetter")}</button>` : ""}</div>`, { wide: true });
  wireFiles(m.el);
  const on = (sel, fn) => { const b = $(sel, m.el); if (b) b.addEventListener("click", fn); };
  const act = async (fn, msg) => { try { await fn(); m.close(); toast(msg); reload(); } catch (x) { toast(err(x), "error"); } };
  on("#l-ok", () => act(() => api.letterReview(l.id, true, null), t("approvedToast")));
  on("#l-rej", async () => { const r = await askReason(t("reject"), t("rejectReason")); if (r) act(() => api.letterReview(l.id, false, r), t("rejectedToast")); });
  on("#l-void", async () => { const r = await askReason(t("voidLetter")); if (r) act(() => api.letterVoid(l.id, r), t("saved")); });
  on("#l-edit", () => { m.close(); letterForm(app, l, l.organization_id, reload); });
}

function letterForm(app, row, org, reload) {
  const r = row || {};
  const m = modal(t(row ? "editLetter" : "newLetter"), html`<form id="f" novalidate>
    <p class="muted small">${app.orgName(org)}</p>
    <div class="grid two" style="gap:.6rem">
      ${field(t("date"), html`<input type="date" name="date" required value="${r.letter_date || todayISO()}">`)}
      ${field(t("letterKind"), html`<select name="kind">${options(KINDS.map((k) => [k, t("lk_" + k)]), r.kind || "anuncio")}</select>`)}
    </div>
    ${field(t("title"), html`<input name="title" required maxlength="200" value="${r.title || ""}">`)}
    ${field(t("letterBody"), html`<textarea name="body" rows="6">${r.body || ""}</textarea>`)}
    ${fileField(r.file_path)}
    <fieldset><legend>${t("audience")}</legend>
      <label class="opt-line"><input type="radio" name="aud" value="local"${r.audience !== "all_churches" ? " checked" : ""}> ${t("aud_local")}</label>
      <label class="opt-line"><input type="radio" name="aud" value="all_churches"${r.audience === "all_churches" ? " checked" : ""}> ${t("aud_all_churches")}</label>
      <p class="muted small">${t("audAllHint")}</p></fieldset>
    ${formFoot()}</form>`, { wide: true });
  const fm = $("#f", m.el);
  onSubmit(m, fm, async () => {
    if (!fm.title.value.trim()) throw new Error(t("titleRequired"));
    const file = await takeFile(fm, "letters", org, r.file_path);
    await api.letterSave({ id: r.id, org, date: fm.date.value, kind: fm.kind.value, title: fm.title.value.trim(), body: fm.body.value.trim(), audience: fm.aud.value, file });
    m.close(); toast(fm.aud.value === "all_churches" && !app.isMaster() ? t("sentForApproval") : t("saved")); reload();
  });
}
