// Library: doctrinal documents and conciliar (international and national) agreements.
import { t, getLang } from "../i18n.js";
import { html, setHTML, $, $$, fmtDate } from "../util.js";
import { modal, toast, field, options } from "../ui.js";
import * as api from "../api.js";
import { fileField, takeFile, fileButton, wireFiles, onSubmit, formFoot, wireRows, err, agreementTable, agreementDetail, agreementForm } from "./common.js";

const KINDS = ["temario", "manual", "guia", "estudio", "otro"];
let kindFilter = "", showArchived = false;

export async function render(view, app) {
  const sub = app.subRoute;
  const tab = sub[0] === "acuerdos" || sub[0] === "acuerdo" ? "acuerdos" : "documentos";
  // Administrations that can publish (national and international) among those the person works with.
  const pubOrgs = app.orgsWhere((o) => o.kind === "administration" && ["national", "international"].includes(o.admin_level));
  const canDoc = app.can("doctrine.publish") && pubOrgs.length > 0;
  const canAgr = app.can("agreements.publish") && pubOrgs.length > 0;

  setHTML(view, html`
    <div class="row between"><h1>${t("libraryTitle")}</h1>
      ${tab === "documentos" && canDoc ? html`<button class="primary" id="new">${t("newDocument")}</button>` : ""}
      ${tab === "acuerdos" && canAgr ? html`<button class="primary" id="new">${t("newAgreement")}</button>` : ""}</div>
    <nav class="tabs-bar" aria-label="${t("libraryTitle")}">
      <a href="#/biblioteca/documentos" class="tab-link" aria-current="${tab === "documentos" ? "page" : "false"}">${t("tabDocuments")}</a>
      <a href="#/biblioteca/acuerdos" class="tab-link" aria-current="${tab === "acuerdos" ? "page" : "false"}">${t("tabConciliar")}</a></nav>
    <div id="body"><div class="center-screen small"><div class="spinner"></div></div></div>`);
  const body = $("#body", view);

  if (tab === "documentos") {
    const load = async () => {
      const rows = await api.documents();
      const shown = rows.filter((d) => (showArchived || d.status === "active") && (!kindFilter || d.kind === kindFilter));
      setHTML(body, html`<form class="panel filters" id="flt">
          ${field(t("docKind"), html`<select name="kind">${options(KINDS.map((k) => [k, t("kind_" + k)]), kindFilter, t("anyKind"))}</select>`)}
          ${canDoc ? html`<label class="opt-line"><input type="checkbox" name="arch"${showArchived ? " checked" : ""}> ${t("showArchived")}</label>` : ""}</form>
        <div class="doc-grid">${shown.length ? shown.map((d) => html`<article class="doc-card click${d.status === "archived" ? " voided" : ""}" data-doc="${d.id}" tabindex="0">
            <span class="badge">${t("kind_" + d.kind)}</span>${d.status === "archived" ? html` <span class="badge muted">${t("archived")}</span>` : ""}
            <h3>${d.title}</h3>${d.description ? html`<p class="muted small clamp">${d.description}</p>` : ""}
            <small class="muted">${app.orgName(d.publisher_organization_id)} · ${t("lang_" + d.language)} · ${fmtDate(d.created_at)}${d.file_path ? " · 📎" : ""}</small></article>`)
          : html`<p class="empty">${t("empty")}</p>`}</div>`);
      const fm = $("#flt", body);
      fm.addEventListener("change", () => { kindFilter = fm.kind.value; showArchived = !!(fm.arch && fm.arch.checked); load(); });
      wireRows(body, "doc", (id) => docDetail(app, id, canDoc, pubOrgs, load));
    };
    await load();
    const nb = $("#new", view); if (nb) nb.addEventListener("click", () => docForm(app, null, pubOrgs, load));
    if (sub[0] === "doc" && sub[1]) { history.replaceState(null, "", "#/biblioteca/documentos"); docDetail(app, sub[1], canDoc, pubOrgs, load); }
  } else {
    const writable = (org) => app.can("agreements.publish") && pubOrgs.includes(org);
    const load = async () => {
      const rows = await api.agreements(["international", "national"]);
      setHTML(body, html`<div class="panel">${agreementTable(rows, app)}</div>`);
      wireRows(body, "agr", (id) => agreementDetail(app, id, { writable, choices: pubOrgs, onChange: load }));
    };
    await load();
    const nb = $("#new", view); if (nb) nb.addEventListener("click", () => agreementForm(app, null, pubOrgs, load));
    if (sub[0] === "acuerdo" && sub[1]) { history.replaceState(null, "", "#/biblioteca/acuerdos"); agreementDetail(app, sub[1], { writable, choices: pubOrgs, onChange: load }).catch((x) => toast(err(x), "error")); }
  }
}

async function docDetail(app, id, canDoc, pubOrgs, reload) {
  let d;
  try { d = await api.documentOne(id); } catch (x) { return toast(err(x), "error"); }
  const can = canDoc && pubOrgs.includes(d.publisher_organization_id);
  const m = modal(d.title, html`
    <p class="meta-line"><span class="badge">${t("kind_" + d.kind)}</span> <span class="muted">${t("publisher")}: ${app.orgName(d.publisher_organization_id)} · ${t("lang_" + d.language)} · ${fmtDate(d.created_at)}</span>
      ${d.status === "archived" ? html` <span class="badge muted">${t("archived")}</span>` : ""}</p>
    ${d.description ? html`<div class="prose">${d.description}</div>` : ""}
    ${d.content_text ? html`<details><summary>${t("contentText")}</summary><div class="prose small">${d.content_text}</div></details>` : ""}
    <div class="row end">${fileButton(d.file_path)}
      ${can ? html`<button type="button" class="ghost" id="d-edit">${t("edit")}</button>
        <button type="button" class="ghost" id="d-arch">${t(d.status === "active" ? "archive" : "unarchive")}</button>` : ""}</div>`, { wide: true });
  wireFiles(m.el);
  const eb = $("#d-edit", m.el); if (eb) eb.addEventListener("click", () => { m.close(); docForm(app, d, pubOrgs, reload); });
  const ab = $("#d-arch", m.el); if (ab) ab.addEventListener("click", async () => {
    try { await api.documentSetStatus(d.id, d.status === "active" ? "archived" : "active"); m.close(); toast(t("saved")); reload(); } catch (x) { toast(err(x), "error"); }
  });
}

function docForm(app, row, pubOrgs, reload) {
  const r = row || {};
  const m = modal(t(row ? "editDocument" : "newDocument"), html`<form id="f" novalidate>
    ${field(t("publisher"), html`<select name="org" required ${row ? "disabled" : ""}>${options(pubOrgs.map((id) => [id, app.orgName(id)]), r.publisher_organization_id || (pubOrgs.length === 1 ? pubOrgs[0] : ""), pubOrgs.length === 1 ? null : t("chooseOrg"))}</select>`)}
    ${field(t("title"), html`<input name="title" required maxlength="200" value="${r.title || ""}">`)}
    <div class="grid two" style="gap:.6rem">
      ${field(t("docKind"), html`<select name="kind">${options(KINDS.map((k) => [k, t("kind_" + k)]), r.kind || "temario")}</select>`)}
      ${field(t("docLanguage"), html`<select name="lang">${options([["es", t("lang_es")], ["en", t("lang_en")]], r.language || getLang())}</select>`)}
    </div>
    ${field(t("description"), html`<textarea name="desc" rows="3" maxlength="2000">${r.description || ""}</textarea>`)}
    ${fileField(r.file_path)}
    ${field(t("contentText"), html`<textarea name="content" rows="5">${r.content_text || ""}</textarea>`, t("contentTextHint"))}
    ${formFoot()}</form>`, { wide: true });
  const fm = $("#f", m.el);
  onSubmit(m, fm, async () => {
    const org = row ? r.publisher_organization_id : fm.org.value;
    if (!org) throw new Error(t("chooseOrg"));
    if (!fm.title.value.trim()) throw new Error(t("titleRequired"));
    const file = await takeFile(fm, "documents", org, r.file_path);
    await api.documentSave({ id: r.id, org, title: fm.title.value.trim(), kind: fm.kind.value, description: fm.desc.value.trim(), language: fm.lang.value, file, content: fm.content.value.trim() });
    m.close(); toast(t("saved")); reload();
  });
}
