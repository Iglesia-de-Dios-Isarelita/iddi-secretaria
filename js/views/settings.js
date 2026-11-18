// Settings: the lists of service types and topics (Spanish and English names, order, in use).
import { t } from "../i18n.js";
import { html, setHTML, $, $$ } from "../util.js";
import { modal, toast, field } from "../ui.js";
import * as api from "../api.js";
import { onSubmit, formFoot } from "./common.js";

export async function render(view, app) {
  await app.reloadLists();
  const table = (list, rows) => html`<div class="table-wrap"><table>
    <thead><tr><th>${t("nameEs")}</th><th>${t("nameEn")}</th><th class="num">${t("order")}</th><th>${t("visible")}</th><th><span class="sr-only">${t("actions")}</span></th></tr></thead>
    <tbody>${rows.map((r) => html`<tr class="${r.active ? "" : "voided"}"><td>${r.name_es}</td><td>${r.name_en}</td><td class="num">${r.sort}</td>
      <td>${r.active ? t("yes") : t("no")}</td><td class="end"><button type="button" class="ghost" data-edit="${list}:${r.id}">${t("edit")}</button></td></tr>`)}</tbody></table></div>`;
  setHTML(view, html`
    <h1>${t("settingsTitle")}</h1>
    <section class="panel"><div class="row between"><h2>${t("serviceTypes")}</h2><button type="button" class="ghost" data-add="service_types">+ ${t("addItem")}</button></div>${table("service_types", app.types)}</section>
    <section class="panel"><div class="row between"><h2>${t("topicsList")}</h2><button type="button" class="ghost" data-add="topics">+ ${t("addItem")}</button></div>${table("topics", app.topics)}</section>`);
  const reload = () => app.rerender();
  $$("[data-add]", view).forEach((b) => b.addEventListener("click", () => itemForm(b.dataset.add, null, reload)));
  $$("[data-edit]", view).forEach((b) => b.addEventListener("click", () => {
    const [list, id] = b.dataset.edit.split(":");
    itemForm(list, (list === "topics" ? app.topics : app.types).find((x) => x.id === id), reload);
  }));
}

function itemForm(list, row, reload) {
  const r = row || { sort: 100, active: true };
  const m = modal(`${t(list === "topics" ? "topicsList" : "serviceTypes")} · ${t(row ? "edit" : "addItem")}`, html`<form id="f" novalidate>
    ${field(t("nameEs"), html`<input name="es" required maxlength="80" value="${r.name_es || ""}">`)}
    ${field(t("nameEn"), html`<input name="en" required maxlength="80" value="${r.name_en || ""}">`)}
    ${field(t("order"), html`<input type="number" name="sort" step="1" value="${r.sort}">`)}
    <label class="opt-line"><input type="checkbox" name="active"${r.active ? " checked" : ""}> ${t("visible")}</label>
    ${formFoot()}</form>`);
  const fm = $("#f", m.el);
  onSubmit(m, fm, async () => {
    if (!fm.es.value.trim() || !fm.en.value.trim()) throw new Error(t("errBothNames"));
    await api.listSave(list, r.id, fm.es.value.trim(), fm.en.value.trim(), parseInt(fm.sort.value, 10) || 100, fm.active.checked);
    m.close(); toast(t("saved")); reload();
  });
}
