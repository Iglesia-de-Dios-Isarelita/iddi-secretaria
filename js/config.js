// Public configuration. The publishable key is designed to be public; access is enforced by the database.
// NEVER put a service-role key or any secret in this file.
export const SUPABASE_URL = "https://kzaqibqbskoucabnaabf.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_lFGziyIHHuG1RuXSxFeyOw_zTewNB3s";
export const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

// This app's code in the shared database (roles, permissions and access belong to an app).
export const APP = "secretaria";

export const HERO_IMAGE =
  "https://rayrtuqztdc8phcw.public.blob.vercel-storage.com/website/bg-hero-home-IDI-sfOcMjNX6V706uKIUE87EGyxu46Ju1.webp";
export const CHURCH_SITE = "https://www.iglesiadediosisraelita.org/";
export const PAGE_SIZE = 50;
// Presentations and documents: no video, about 50 slides at most.
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const FILE_TYPES = ".pdf,.pptx,.ppt,.docx,.doc,.jpg,.jpeg,.png,.webp";
// Needed by util.js (shared with Finance); Secretaría shows no money.
export const CURRENCY = "USD";
