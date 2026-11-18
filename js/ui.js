import { esc, html, raw, $, setHTML } from "./util.js";
import { t } from "./i18n.js";

let toastTimer;
export function toast(message, kind = "ok") {
  let el = $("#toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite"); document.body.appendChild(el); }
  el.textContent = message;
  el.className = "snack " + kind + " show";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 4500);
}

/** Opens an accessible dialog. `body` is raw HTML built with html``. Returns {el, close}. */
export function modal(title, body, { wide = false } = {}) {
  const previous = document.activeElement;
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `<div class="dialog${wide ? " wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
    <div class="dialog-head"><h2 id="dlg-title">${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="${esc(t("close"))}">×</button></div>
    <div class="dialog-body"></div></div>`;
  document.body.appendChild(overlay);
  setHTML($(".dialog-body", overlay), body);
  const close = () => { overlay.remove(); document.removeEventListener("keydown", onKey); if (previous && previous.focus) previous.focus(); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
  overlay.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
  const first = overlay.querySelector("input,select,textarea,button:not([data-close])");
  (first || overlay.querySelector("[data-close]")).focus();
  return { el: overlay, close };
}

export const statusBadge = (s) => html`<span class="badge ${s === "posted" ? "ok" : "muted"}">${t(s)}</span>`;

export function field(label, control, hint) {
  return html`<label class="field"><span class="field-label">${label}</span>${control}${hint ? html`<span class="field-hint">${hint}</span>` : ""}</label>`;
}

export function options(items, selected, placeholder) {
  return raw((placeholder != null ? `<option value="">${esc(placeholder)}</option>` : "") +
    items.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(selected) ? " selected" : ""}>${esc(l)}</option>`).join(""));
}

/** Paired bar chart (income vs expense) drawn as accessible SVG. */
export function pairedBars(rows, labels) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.income, r.expense]));
  const W = 560, H = 190, pad = 28, bw = 18, gap = (W - pad * 2) / rows.length;
  const bars = rows.map((r, i) => {
    const x = pad + i * gap + gap / 2;
    const hi = Math.round((r.income / max) * (H - 50)), he = Math.round((r.expense / max) * (H - 50));
    return `<rect class="bar-in" x="${x - bw - 2}" y="${H - 28 - hi}" width="${bw}" height="${hi}" rx="3"><title>${esc(labels[i])} · ${esc(t("income"))}: ${esc(r.incomeLabel)}</title></rect>
      <rect class="bar-out" x="${x + 2}" y="${H - 28 - he}" width="${bw}" height="${he}" rx="3"><title>${esc(labels[i])} · ${esc(t("expense"))}: ${esc(r.expenseLabel)}</title></rect>
      <text class="axis" x="${x}" y="${H - 8}" text-anchor="middle">${esc(labels[i])}</text>`;
  }).join("");
  return raw(`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t("last6"))}" class="chart"><line class="axis-line" x1="${pad - 8}" y1="${H - 28}" x2="${W - pad + 8}" y2="${H - 28}"/>${bars}</svg>
    <div class="legend"><span><i class="dot in"></i>${esc(t("income"))}</span><span><i class="dot out"></i>${esc(t("expense"))}</span></div>`);
}

// Small "⋯" menu: openMenu(button, [{ label, danger, run }]). Closes on choice, outside click or Escape.
export function openMenu(anchor, items) {
  document.querySelectorAll(".pop-menu").forEach((m) => m.remove());
  const menu = document.createElement("div");
  menu.className = "pop-menu";
  menu.setAttribute("role", "menu");
  items.forEach((it) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "menu-item" + (it.danger ? " danger" : ""); b.setAttribute("role", "menuitem"); b.textContent = it.label;
    b.addEventListener("click", (e) => { e.stopPropagation(); close(); it.run(); });
    menu.appendChild(b);
  });
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect(), w = menu.offsetWidth, h = menu.offsetHeight;
  menu.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + "px";
  menu.style.top = (r.bottom + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + "px";
  anchor.setAttribute("aria-expanded", "true");
  const first = menu.querySelector("button"); if (first) first.focus();
  function close() { menu.remove(); anchor.setAttribute("aria-expanded", "false"); document.removeEventListener("click", outside, true); document.removeEventListener("keydown", key); window.removeEventListener("scroll", close, true); }
  const outside = (e) => { if (!menu.contains(e.target)) close(); };
  const key = (e) => {
    if (e.key === "Escape") { close(); anchor.focus(); }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const bs = [...menu.querySelectorAll("button")]; const i = bs.indexOf(document.activeElement); bs[(i + (e.key === "ArrowDown" ? 1 : -1) + bs.length) % bs.length].focus(); }
  };
  setTimeout(() => { document.addEventListener("click", outside, true); window.addEventListener("scroll", close, true); });
  document.addEventListener("keydown", key);
}
export const moreButton = (attr, id, label) => `<button type="button" class="more-btn" data-${attr}="${id}" aria-haspopup="menu" aria-expanded="false" aria-label="${label}">⋯</button>`;
