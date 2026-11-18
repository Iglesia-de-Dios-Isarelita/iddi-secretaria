import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_JS, APP, PAGE_SIZE } from "./config.js";
import { uuid, safeFileName } from "./util.js";

// Every call below goes through the signed-in person's session, so the database access rules decide what
// comes back and what can be saved. Nothing here is trusted to enforce permissions.
const { createClient } = await import(SUPABASE_JS);

export const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const must = ({ data, error }) => { if (error) throw error; return data; };
const rpc = async (fn, args) => must(await sb.rpc(fn, args));
const byOrg = (q, ids, col = "organization_id") => (ids && ids.length ? (ids.length === 1 ? q.eq(col, ids[0]) : q.in(col, ids)) : q);

export const auth = {
  session: async () => must(await sb.auth.getSession()).session,
  onChange: (cb) => sb.auth.onAuthStateChange((event, session) => cb(event, session)),
  signIn: () => sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: "select_account" } } }),
  signOut: () => sb.auth.signOut(),
};

// ---- who is signed in, and the church structure ----
export const context = () => rpc("app_context", { p_app: APP });
export const orgs = () => rpc("sec_orgs");
export const setMyName = (first, last, treatment) => rpc("set_my_name", { p_first: first, p_last: last, p_treatment: treatment });

// ---- lists (service types, topics) ----
export const serviceTypes = async () => must(await sb.from("sec_service_types").select("id,name_es,name_en,sort,active").order("sort").order("name_es"));
export const topics = async () => must(await sb.from("sec_topics").select("id,name_es,name_en,sort,active").order("sort").order("name_es"));
export const listSave = (list, id, nameEs, nameEn, sort, active) =>
  rpc("sec_list_save", { p_list: list, p_id: id || null, p_name_es: nameEs, p_name_en: nameEn, p_sort: sort, p_active: active });

// ---- sermons ----
export async function services(orgIds, f = {}, page = 0) {
  let q = byOrg(sb.from("sec_services").select("id,organization_id,service_date,service_type_id,preacher_name,title,attendance_total,status,presentation_path,sec_service_topics(topic_id)", { count: "exact" }), orgIds);
  if (f.from) q = q.gte("service_date", f.from);
  if (f.to) q = q.lte("service_date", f.to);
  if (f.type) q = q.eq("service_type_id", f.type);
  if (!f.voided) q = q.eq("status", "posted");
  if (f.text) q = q.ilike("title", `%${f.text.replace(/[%_]/g, "")}%`);
  q = q.order("service_date", { ascending: false }).order("created_at", { ascending: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: f.topic ? data.filter((r) => r.sec_service_topics.some((x) => x.topic_id === f.topic)) : data, count };
}
export const service = async (id) => must(await sb.from("sec_services").select("*,sec_service_citations(position,reference,comment),sec_service_topics(topic_id)").eq("id", id).single());
export const serviceSave = (p) => rpc("sec_service_save", {
  p_id: p.id || null, p_org: p.org, p_date: p.date, p_type: p.type, p_title: p.title, p_preacher_name: p.preacher, p_preacher_user: null,
  p_notes: p.notes || null, p_attendance: p.attendance, p_topics: p.topics, p_citations: p.citations, p_presentation_path: p.file || null,
});
export const serviceVoid = (id, reason) => rpc("sec_service_void", { p_id: id, p_reason: reason });

// ---- letters ----
export async function letters(orgIds) {
  let q = sb.from("sec_letters").select("id,organization_id,letter_date,kind,title,audience,status,file_path,created_at").order("letter_date", { ascending: false }).order("created_at", { ascending: false }).limit(300);
  if (orgIds && orgIds.length) q = q.or(`organization_id.in.(${orgIds.join(",")}),audience.eq.all_churches`);
  return must(await q);
}
export const letter = async (id) => must(await sb.from("sec_letters").select("*").eq("id", id).single());
export const letterSave = (p) => rpc("sec_letter_save", { p_id: p.id || null, p_org: p.org, p_date: p.date, p_kind: p.kind, p_title: p.title, p_body: p.body || null, p_audience: p.audience, p_file_path: p.file || null });
export const letterReview = (id, approve, note) => rpc("sec_letter_review", { p_id: id, p_approve: approve, p_note: note || null });
export const letterVoid = (id, reason) => rpc("sec_letter_void", { p_id: id, p_reason: reason });

// ---- doctrinal documents ----
export const documents = async () => must(await sb.from("sec_documents").select("id,publisher_organization_id,title,kind,description,language,file_path,status,created_at").order("created_at", { ascending: false }).limit(500));
export const documentOne = async (id) => must(await sb.from("sec_documents").select("*").eq("id", id).single());
export const documentSave = (p) => rpc("sec_document_save", { p_id: p.id || null, p_org: p.org, p_title: p.title, p_kind: p.kind, p_description: p.description || null, p_language: p.language, p_file_path: p.file || null, p_content_text: p.content || null });
export const documentSetStatus = (id, status) => rpc("sec_document_set_status", { p_id: id, p_status: status });

// ---- agreements (conciliar and society/department) ----
export async function agreements(levels) {
  return must(await sb.from("sec_agreements").select("id,organization_id,level,number,session,session_date,topic,status,file_path,created_at,year,seq")
    .in("level", levels).order("year", { ascending: false }).order("seq", { ascending: false }).limit(500));
}
export const agreement = async (id) => must(await sb.from("sec_agreements").select("*").eq("id", id).single());
export const agreementSave = (p) => rpc("sec_agreement_save", { p_id: p.id || null, p_org: p.org, p_session: p.session || null, p_session_date: p.sessionDate || null, p_topic: p.topic, p_body: p.body, p_file_path: p.file || null });
export const agreementSetStatus = (id, status, reason) => rpc("sec_agreement_set_status", { p_id: id, p_status: status, p_reason: reason || null, p_replaced_by: null });

// ---- circulars ----
export const circulars = async () => must(await sb.from("sec_circulars").select("id,from_organization_id,title,body,file_path,status,sent_at,sec_circular_recipients(organization_id,acknowledged_at)").order("sent_at", { ascending: false }).limit(300));
export const circularSend = (p) => rpc("sec_circular_send", { p_from_org: p.from, p_title: p.title, p_body: p.body || null, p_file_path: p.file || null, p_targets: p.targets || null });
export const circularAck = (id, org) => rpc("sec_circular_acknowledge", { p_circular: id, p_org: org });

// ---- trends and search ----
export const trends = (org, from, to) => rpc("sec_trends", { p_org: org, p_from: from, p_to: to });
export const search = (q) => rpc("sec_search", { p_query: q, p_limit: 50 });

// ---- access ----
export const roles = async () => must(await sb.from("roles").select("id,code,display_name_es,display_name_en,scope_level,rank,min_inviter_rank").eq("app_code", APP).order("rank", { ascending: false }));
export const listAccess = () => rpc("app_list_access", { p_app: APP });
export const grantAccess = (email, role, org) => rpc("app_grant_access", { p_app: APP, p_email: email, p_role: role, p_org: org || null });
export const setGrantActive = (id, active) => rpc("app_set_grant_active", { p_id: id, p_active: active });

// ---- files (private bucket; links last 5 minutes) ----
export async function upload(category, orgId, file) {
  const path = `${category}/${orgId}/${uuid()}-${safeFileName(file.name)}`;
  must(await sb.storage.from("secretaria").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false }));
  return path;
}
export async function fileUrl(path) {
  const { data, error } = await sb.storage.from("secretaria").createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}
