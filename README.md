# IDDI Secretaría (iddi-secretaria)

Sistema de Gestión Secretarial y Ministerial — Iglesia de Dios (Israelita).
Secretarial and ministerial management for the IDDI apps hub.

- **Stack:** Vercel (frontend) + GitHub + Supabase (shared project with iddi-finance).
- **Language:** Spanish first, English built in.
- **Planned address:** secretaria.iglesiadediosisraelita.org (domain later).

## What's here today
- `supabase/migrations/` — database changes for Secretaría:
  - `per_app_roles_foundation` — roles per app on the shared sign-in (**applied 18 Nov 2026**).
  - `secretaria_core` — sermons, letters, doctrinal documents, agreements, circulars, files, search, trends (**applied 18 Nov 2026**).
- `docs/` — plan and decisions.

The frontend comes next, copied from the Finance app's shell (Google sign-in, opening screen, daisyUI navy/gold, ES/EN, installable app).

## Roles (Secretaría)
| Role | Level | Assigned to |
| --- | --- | --- |
| Administrador Maestro | 6 | everything |
| Secretario Nacional | 5 | national administration |
| Secretario de Zona | 4 | zone administration |
| Encargado Local / Secretario Local | 3 | a church |
| Predicador | 2 | a church (given by zone level or above) |
| Secretario de Sociedad / de Departamento | 1 | a society or department |

Hierarchy: International → National → Zone → Local church → Society / Department (same as Finance).

## Search ("IDDI AI")
Internal only: searches the app's own records (sermons, agreements, documents, letters, circulars) with exact links to the source. No outside AI service is connected.

## Run it and test it

- It is a static site (no build step). Locally: `python3 -m http.server 8080` and open http://localhost:8080.
- Browser test with a stand-in database: `NODE_PATH=$(npm root -g) node tests/ui.test.mjs` (needs Playwright).
  It signs in as a Local Secretary, the Master Administrator and a Society Secretary and walks every section.
- Sign-in uses Google through the shared Supabase project. Add each new site address to
  Supabase → Authentication → URL Configuration → Redirect URLs.
