// Stand-in for supabase-js used by the browser test. It keeps a small in-memory church and answers the
// same calls the app makes. Page query: ?out=1 (signed out), ?role=local|master|society.
const qs = new URLSearchParams(location.search);
const uid = "u-1";
const ID = { hq: "o-hq", nat: "o-nat", zone: "o-zone", oak: "o-oak", sf: "o-sf", soc: "o-soc", dep: "o-dep" };
const LOC = { oak: "l-oak", sf: "l-sf" };
const orgs = [
  { id: ID.hq, kind: "administration", name: "Administración Internacional", display_name: "Administración Internacional", admin_level: "international", parent_organization_id: null },
  { id: ID.nat, kind: "administration", name: "Administración Nacional de EE. UU.", display_name: "Administración Nacional de EE. UU.", admin_level: "national", national_administration_id: "n-us", country_id: "c-us", country_name: "Estados Unidos", country_code: "USA", parent_organization_id: ID.hq },
  { id: ID.zone, kind: "administration", name: "Administración de la Zona Oeste", display_name: "Administración de la Zona Oeste", admin_level: "zone", zone_id: "z-w", zone_name: "Administración de la Zona Oeste", national_administration_id: "n-us", country_id: "c-us", country_name: "Estados Unidos", country_code: "USA", parent_organization_id: ID.nat },
  { id: ID.oak, kind: "church", name: "Iglesia de Oakland", display_name: "Oakland", locality_id: LOC.oak, locality_name: "Oakland", zone_id: "z-w", zone_name: "Administración de la Zona Oeste", national_administration_id: "n-us", country_id: "c-us", country_name: "Estados Unidos", country_code: "USA", parent_organization_id: ID.zone },
  { id: ID.sf, kind: "church", name: "Iglesia de San Francisco", display_name: "San Francisco", locality_id: LOC.sf, locality_name: "San Francisco", zone_id: "z-w", zone_name: "Administración de la Zona Oeste", national_administration_id: "n-us", country_id: "c-us", country_name: "Estados Unidos", country_code: "USA", parent_organization_id: ID.zone },
  { id: ID.soc, kind: "society", name: "Sociedad de Jóvenes", display_name: "Sociedad de Jóvenes", locality_id: LOC.oak, locality_name: "Oakland", zone_id: "z-w", country_id: "c-us", parent_organization_id: ID.oak },
  { id: ID.dep, kind: "department", name: "Departamento de Música", display_name: "Departamento de Música", locality_id: LOC.oak, locality_name: "Oakland", zone_id: "z-w", country_id: "c-us", parent_organization_id: ID.oak },
];
const ALLP = ["services.view", "services.manage", "library.view", "doctrine.publish", "agreements.publish", "letters.view", "letters.manage", "letters.approve",
  "circulars.send", "circulars.acknowledge", "trends.view", "ai.use", "users.view", "users.invite", "settings.manage"];
const PROFILES = {
  master: { roles: [{ role: "administrador_maestro", name_es: "Administrador Maestro", name_en: "Master Administrator", rank: 6, scope_level: "international" }], perms: ALLP, scope: orgs.map((o) => o.id), creator: true },
  local: { roles: [{ role: "secretario_local", name_es: "Secretario Local", name_en: "Local Secretary", rank: 3, scope_level: "church", organization_id: ID.oak, locality_id: LOC.oak },
                   { role: "encargado_local", name_es: "Encargado Local", name_en: "Local Leader", rank: 3, scope_level: "church", organization_id: ID.oak, locality_id: LOC.oak }],
    perms: ["services.view", "services.manage", "library.view", "letters.view", "letters.manage", "letters.approve", "circulars.acknowledge", "trends.view", "ai.use", "users.view", "users.invite"],
    scope: [ID.oak, ID.soc, ID.dep], creator: false },
  society: { roles: [{ role: "secretario_sociedad_departamento", name_es: "Secretario de Sociedad", name_en: "Society Secretary", rank: 1, scope_level: "society_or_department", organization_id: ID.soc }],
    perms: ["services.view", "library.view", "letters.view", "ai.use", "agreements.local"], scope: [ID.soc], creator: false },
};
const P = PROFILES[qs.get("role") || "local"];
const today = new Date().toISOString().slice(0, 10);
const db = {
  sec_service_types: [{ id: "t1", name_es: "Servicio de Recibimiento", name_en: "Welcoming Service", sort: 10, active: true },
    { id: "t2", name_es: "Servicio Vespertino", name_en: "Evening Service", sort: 20, active: true }, { id: "t3", name_es: "Servicio Matutino", name_en: "Morning Service", sort: 30, active: true }],
  sec_topics: [{ id: "p1", name_es: "Profético", name_en: "Prophetic", sort: 10, active: true }, { id: "p2", name_es: "Evangelismo", name_en: "Evangelism", sort: 20, active: true },
    { id: "p3", name_es: "Puntos de fe", name_en: "Points of faith", sort: 30, active: true }, { id: "p4", name_es: "Parábolas", name_en: "Parables", sort: 40, active: true }],
  sec_services: [{ id: "s1", organization_id: ID.oak, service_date: today, service_type_id: "t3", preacher_name: "Hno. Pérez", title: "La parábola del sembrador", notes: "",
    attendance_men: 10, attendance_women: 12, attendance_youth: 6, attendance_children: 4, attendance_visitors: 2, status: "posted", presentation_path: null, created_at: today,
    topics: ["p4"], cites: [{ position: 1, reference: "Mateo 13:3-9", comment: null }] }],
  sec_documents: [{ id: "d1", publisher_organization_id: ID.hq, title: "Temario de bautismo", kind: "temario", description: "Puntos de fe para el bautismo", language: "es", file_path: null, status: "active", created_at: today, content_text: "" }],
  sec_agreements: [{ id: "a1", organization_id: ID.hq, level: "international", number: "CI-2026-001", year: 2026, seq: 1, session: "Concilio 2026", session_date: today, topic: "Calendario de fiestas", body: "Se aprueba el calendario.", status: "vigente", file_path: null, created_at: today }],
  sec_letters: [{ id: "L1", organization_id: ID.sf, letter_date: today, kind: "anuncio", title: "Campaña de evangelismo", body: "Invitación", audience: "all_churches", status: "published", file_path: null, created_at: today }],
  sec_circulars: [{ id: "c1", from_organization_id: ID.zone, title: "Reunión de secretarios", body: "Sábado a las 3", file_path: null, status: "sent", sent_at: new Date().toISOString(),
    sec_circular_recipients: [{ organization_id: ID.oak, acknowledged_at: null }, { organization_id: ID.sf, acknowledged_at: null }] }],
  roles: [["administrador_maestro", "Administrador Maestro", "international", 6], ["secretario_nacional", "Secretario Nacional", "national", 5], ["secretario_zona", "Secretario de Zona", "zone", 4],
    ["encargado_local", "Encargado Local", "church", 3], ["secretario_local", "Secretario Local", "church", 3], ["predicador", "Predicador", "church", 2, 4],
    ["secretario_sociedad_departamento", "Secretario de departamento o de sociedad", "society_or_department", 1]]
    .map(([code, es, scope, rank, min]) => ({ id: "r-" + code, app_code: "secretaria", code, display_name_es: es, display_name_en: es, scope_level: scope, rank, min_inviter_rank: min || null })),
  grants: [{ id: "g1", email: "pedro@iddioakland.org", role: "predicador", role_name_es: "Predicador", role_name_en: "Preacher", organization_id: ID.oak, organization_name: "Oakland", active: true, first_name: "Pedro", last_name: "Ruiz", last_sign_in_at: null }],
};
window.__MOCK = { db, calls: [] };
const err = (message) => ({ data: null, error: { message } });
const ok = (data) => ({ data, error: null });
const nid = () => Math.random().toString(36).slice(2, 10);
const audit = (n, a) => window.__MOCK.calls.push([n, a]);
const shapeService = (s, cols) => {
  const r = { ...s, attendance_total: s.attendance_men + s.attendance_women + s.attendance_youth + s.attendance_children + s.attendance_visitors,
    sec_service_topics: s.topics.map((x) => ({ topic_id: x })) };
  if (cols.includes("sec_service_citations")) r.sec_service_citations = s.cites;
  return r;
};
const visibleLetters = () => db.sec_letters.filter((l) => qs.get("role") === "master" || l.organization_id === ID.oak || (l.status === "published" && l.audience === "all_churches"));

function query(table) {
  const st = { table, filters: [], cols: "*", single: false, count: false, ors: null };
  const run = () => {
    let rows = { sec_letters: visibleLetters() }[table] || db[table] || [];
    rows = rows.filter((r) => st.filters.every((f) => f(r)));
    if (st.ors) rows = rows.filter(st.ors);
    if (table === "sec_services") rows = rows.map((s) => shapeService(s, st.cols));
    if (table === "sec_agreements" && qs.get("role") === "society") rows = rows.filter((a) => a.organization_id === ID.soc);
    if (st.single) return rows[0] ? ok(rows[0]) : err("Not found");
    return { data: rows, error: null, count: rows.length };
  };
  const b = {
    select(c, o) { st.cols = c || "*"; st.count = !!(o && o.count); return b; },
    eq(c, v) { st.filters.push((r) => r[c] === v); return b; },
    in(c, v) { st.filters.push((r) => v.includes(r[c])); return b; },
    gte(c, v) { st.filters.push((r) => r[c] >= v); return b; },
    lte(c, v) { st.filters.push((r) => r[c] <= v); return b; },
    ilike(c, v) { const n = v.replace(/%/g, "").toLowerCase(); st.filters.push((r) => String(r[c]).toLowerCase().includes(n)); return b; },
    or(expr) { const m = expr.match(/organization_id\.in\.\(([^)]*)\)/); const ids = m ? m[1].split(",") : []; st.ors = (r) => ids.includes(r.organization_id) || r.audience === "all_churches"; return b; },
    order() { return b; }, range() { return b; }, limit() { return b; },
    single() { st.single = true; return b; },
    then(res, rej) { return Promise.resolve(run()).then(res, rej); },
  };
  return b;
}

const RPC = {
  app_context: () => ok({ app: "secretaria", user_id: uid, email: "sec@iddioakland.org", first_name: "Ana", last_name: "López", full_name: "Ana López", treatment: "hermana",
    status: "active", is_creator: P.creator, roles: P.roles, permissions: P.perms.map((p) => "secretaria." + p) }),
  set_my_name: () => ok(null),
  sec_orgs: () => ok(orgs.map((o) => ({ ...o, in_scope: P.scope.includes(o.id) }))),
  sec_service_save: (a) => {
    if (!a.p_citations.length || !a.p_citations[0].reference) return err("The first bible citation is required");
    const row = { id: a.p_id || "s-" + nid(), organization_id: a.p_org, service_date: a.p_date, service_type_id: a.p_type, preacher_name: a.p_preacher_name, title: a.p_title, notes: a.p_notes,
      status: "posted", presentation_path: a.p_presentation_path, created_at: today, topics: a.p_topics, cites: a.p_citations.map((c, i) => ({ position: i + 1, ...c })),
      ...Object.fromEntries(["men", "women", "youth", "children", "visitors"].map((k) => ["attendance_" + k, a.p_attendance[k] || 0])) };
    const i = db.sec_services.findIndex((s) => s.id === row.id); if (i >= 0) db.sec_services[i] = row; else db.sec_services.unshift(row);
    audit("sec_service_save", a); return ok(row.id);
  },
  sec_service_void: (a) => { const s = db.sec_services.find((x) => x.id === a.p_id); s.status = "voided"; s.void_reason = a.p_reason; return ok(null); },
  sec_letter_save: (a) => {
    const row = { id: a.p_id || "L-" + nid(), organization_id: a.p_org, letter_date: a.p_date, kind: a.p_kind, title: a.p_title, body: a.p_body, file_path: a.p_file_path, audience: a.p_audience,
      status: a.p_audience === "all_churches" && qs.get("role") !== "master" ? "pending_approval" : "published", created_at: today };
    db.sec_letters.unshift(row); audit("sec_letter_save", a); return ok(row.id);
  },
  sec_letter_review: (a) => { const l = db.sec_letters.find((x) => x.id === a.p_id); if (!a.p_approve && !a.p_note) return err("Enter the reason"); l.status = a.p_approve ? "published" : "rejected"; l.review_note = a.p_note; return ok(null); },
  sec_letter_void: (a) => { const l = db.sec_letters.find((x) => x.id === a.p_id); l.status = "voided"; l.void_reason = a.p_reason; return ok(null); },
  sec_document_save: (a) => { db.sec_documents.unshift({ id: "d-" + nid(), publisher_organization_id: a.p_org, title: a.p_title, kind: a.p_kind, description: a.p_description, language: a.p_language, file_path: a.p_file_path, status: "active", created_at: today, content_text: a.p_content_text }); return ok("x"); },
  sec_document_set_status: (a) => { db.sec_documents.find((d) => d.id === a.p_id).status = a.p_status; return ok(null); },
  sec_agreement_save: (a) => {
    const o = orgs.find((x) => x.id === a.p_org); const level = o.kind === "society" ? "society" : o.kind === "department" ? "department" : o.admin_level;
    const seq = db.sec_agreements.filter((x) => x.organization_id === a.p_org).length + 1;
    const pre = { international: "CI", national: "CN-USA", society: "AS", department: "AD" }[level];
    db.sec_agreements.unshift({ id: "a-" + nid(), organization_id: a.p_org, level, year: 2026, seq, number: `${pre}-2026-${String(seq).padStart(3, "0")}`, session: a.p_session, session_date: a.p_session_date, topic: a.p_topic, body: a.p_body, status: "vigente", file_path: a.p_file_path, created_at: today });
    return ok("x");
  },
  sec_agreement_set_status: (a) => { const x = db.sec_agreements.find((y) => y.id === a.p_id); x.status = a.p_status; x.status_reason = a.p_reason; return ok(null); },
  sec_circular_send: (a) => { db.sec_circulars.unshift({ id: "c-" + nid(), from_organization_id: a.p_from_org, title: a.p_title, body: a.p_body, file_path: a.p_file_path, status: "sent", sent_at: new Date().toISOString(),
    sec_circular_recipients: (a.p_targets || [ID.oak, ID.sf]).map((o) => ({ organization_id: o, acknowledged_at: null })) }); return ok("x"); },
  sec_circular_acknowledge: (a) => { db.sec_circulars.find((c) => c.id === a.p_circular).sec_circular_recipients.find((r) => r.organization_id === a.p_org).acknowledged_at = new Date().toISOString(); return ok(null); },
  sec_list_save: (a) => { const list = db["sec_" + a.p_list]; const row = { id: a.p_id || "n-" + nid(), name_es: a.p_name_es, name_en: a.p_name_en, sort: a.p_sort, active: a.p_active };
    const i = list.findIndex((x) => x.id === row.id); if (i >= 0) list[i] = row; else list.push(row); return ok(row.id); },
  sec_search: (a) => { const q = a.p_query.toLowerCase(); const out = [];
    db.sec_services.forEach((s) => { if ((s.title + s.cites.map((c) => c.reference).join(" ")).toLowerCase().includes(q)) out.push({ kind: "service", id: s.id, title: s.title, detail: s.preacher_name, organization_id: s.organization_id, item_date: s.service_date, rank: 1 }); });
    db.sec_documents.forEach((d) => { if ((d.title + d.description).toLowerCase().includes(q)) out.push({ kind: "document", id: d.id, title: d.title, detail: d.kind, organization_id: d.publisher_organization_id, item_date: d.created_at, rank: 1 }); });
    return ok(out); },
  sec_trends: () => { const s = db.sec_services.filter((x) => x.status === "posted").map((x) => shapeService(x, ""));
    const sum = (k) => s.reduce((t, x) => t + x["attendance_" + k], 0);
    return ok({ services: s.length, attendance: { men: sum("men"), women: sum("women"), youth: sum("youth"), children: sum("children"), visitors: sum("visitors"), total: sum("total"), average: s.length ? +(sum("total") / s.length).toFixed(1) : 0 },
      by_month: s.length ? [{ month: today.slice(0, 7), services: s.length, attendance: sum("total"), average: +(sum("total") / s.length).toFixed(1) }] : [],
      by_type: [{ type_es: "Servicio Matutino", type_en: "Morning Service", services: s.length, average: 34 }], topics: [{ topic_es: "Parábolas", topic_en: "Parables", services: 1 }] }); },
  app_list_access: () => ok(db.grants),
  app_grant_access: (a) => { if (!/@iddioakland\.org$/.test(a.p_email)) return err("This email domain is not approved");
    db.grants.unshift({ id: "g-" + nid(), email: a.p_email, role: a.p_role, role_name_es: a.p_role, role_name_en: a.p_role, organization_id: a.p_org, organization_name: "", active: true, last_sign_in_at: null }); return ok("x"); },
  app_set_grant_active: (a) => { db.grants.find((g) => g.id === a.p_id).active = a.p_active; return ok(null); },
};

export function createClient() {
  const listeners = [];
  return {
    auth: {
      getSession: async () => ok({ session: qs.get("out") ? null : { user: { id: uid } } }),
      onAuthStateChange: (cb) => { listeners.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
      signInWithOAuth: async () => { window.__signInCalled = true; return ok(null); },
      signOut: async () => { window.__signedOut = true; listeners.forEach((l) => l("SIGNED_OUT", null)); return ok(null); },
    },
    rpc: async (fn, args) => (RPC[fn] ? RPC[fn](args || {}) : err("mock: unknown rpc " + fn)),
    from: (t) => query(t),
    storage: { from: () => ({
      upload: async (path) => { window.__MOCK.calls.push(["upload", path]); return ok({ path }); },
      createSignedUrl: async (path) => ok({ signedUrl: "about:blank#" + path }),
    }) },
  };
}
