import { CURRENCY } from "./config.js";
import { getLang } from "./i18n.js";

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

/** Tagged template that escapes every interpolated value unless it is wrapped with raw(). */
export class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(s);
export function html(strings, ...vals) {
  let out = "";
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) {
      const v = vals[i];
      if (v instanceof Raw) out += v.s;
      else if (Array.isArray(v)) out += v.map((x) => (x instanceof Raw ? x.s : esc(x))).join("");
      else out += esc(v);
    }
  });
  return new Raw(out);
}

export function money(n) {
  const v = Number(n || 0);
  return new Intl.NumberFormat(getLang() === "es" ? "es-US" : "en-US", { style: "currency", currency: CURRENCY }).format(v);
}
export function fmtDate(d) {
  if (!d) return "";
  const dt = typeof d === "string" && d.length === 10 ? new Date(d + "T00:00:00") : new Date(d);
  return new Intl.DateTimeFormat(getLang() === "es" ? "es-US" : "en-US", { year: "numeric", month: "short", day: "numeric" }).format(dt);
}
export function fmtDateTime(d) {
  if (!d) return "";
  return new Intl.DateTimeFormat(getLang() === "es" ? "es-US" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(d));
}
export function monthLabel(isoMonth) {
  return new Intl.DateTimeFormat(getLang() === "es" ? "es-US" : "en-US", { month: "short" }).format(new Date(isoMonth + "T00:00:00"));
}
export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export function monthStart(offset = 0) {
  const d = new Date();
  const m = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-01`;
}

const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const PERIOD_KEYS = ["month", "lastMonth", "quarter", "lastQuarter", "half", "year", "lastYear"];
export const periodKey = (p) => "p" + p[0].toUpperCase() + p.slice(1);
/** Start and end dates of a named period, or null when the name is not a preset. */
export function periodRange(p) {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth(), q = Math.floor(m / 3);
  switch (p) {
    case "month": return [monthStart(0), todayISO()];
    case "lastMonth": return [monthStart(-1), isoDay(new Date(y, m, 0))];
    case "quarter": return [isoDay(new Date(y, q * 3, 1)), todayISO()];
    case "lastQuarter": return [isoDay(new Date(y, q * 3 - 3, 1)), isoDay(new Date(y, q * 3, 0))];
    case "half": return [monthStart(-5), todayISO()];
    case "year": return [`${y}-01-01`, todayISO()];
    case "lastYear": return [`${y - 1}-01-01`, `${y - 1}-12-31`];
    default: return null;
  }
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function setHTML(el, content) { el.innerHTML = content instanceof Raw ? content.s : String(content); }

export function uuid() { return crypto.randomUUID(); }
export const safeFileName = (n) => n.normalize("NFKD").replace(/[^\w.\-]+/g, "_").slice(-80);

/** Maps a database error into text a person can act on. */
export function friendlyError(err, tr) {
  const m = (err && (err.message || err.error_description)) || "";
  const known = [
    ["The first bible citation is required", "errCitation"],
    ["outside your scope", "errOutsideScope"],
    ["Enter the reason", "errReason"],
    ["not waiting for approval", "errNotPending"],
    ["society or a department", "errChooseSociety"],
    ["Choose a church", "errChooseChurch"],
    ["Voided records cannot be changed", "errVoidedLocked"],
    ["Only agreements in force", "errOnlyInForce"],
    ["This email domain is not approved", "errDomain"],
    ["Your role cannot invite this kind of user", "errCannotInvite"],
    ["You cannot change your own access", "errOwnAccess"],
    ["No churches to send to", "errNoChurches"],
    ["Enter a valid date", "errValidDate"],
    ["Choose the administration", "errChooseAdmin"],
    ["Enter a title", "titleRequired"],
    ["Enter the preacher", "preacherRequired"],
    ["Choose a service type", "typeRequired"],
    ["Enter a valid email address", "emailInvalid"],
    ["Enter your first and last name", "errYourName"],
    ["Enter the name in Spanish and English", "errBothNames"],
    ["Choose an organization", "chooseOrg"],
    ["Not allowed", "noAccess"],
  ];
  for (const [needle, key] of known) if (m.includes(needle)) return tr(key);
  if (m.startsWith("This email address has not been invited") || m.includes("Database error saving new user")) return tr("signInNotApproved");
  return m || tr("errorGeneric");
}

export const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export function download(filename, blob) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
