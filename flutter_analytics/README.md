# Diagrid Analytics — Flutter web

This Flutter companion uses Diagrid's actual Supabase diagram records through the
same `get_diagram_analytics_v2` RPC as the React analytics page. It includes four KPI
cards, three graphs (pie, line, horizontal bar), and searchable, sortable,
paginated records. All filters affect all outputs.

The trend KPI row compares the first and last visible line-chart buckets:
starting count, current count, percentage change, and direction. Percentage
change is N/A when the starting count is zero or fewer than two buckets exist.
The group comparison uses the two projects with the most matching diagrams,
shows their counts and absolute difference, and identifies the higher value.
With fewer than two projects, it shows an empty state. Reproducible submission
screenshots are in `submission/`.

An advanced section adds 14-day period comparisons, a guarded seven-day forecast
baseline, a held-out last-week check, and evidence-based review suggestions.
Forecasts are labelled estimates and suppressed without sufficient matching history.
See `../ANALYTICS.md` for methods, requirements, and limitations.

The interface follows Diagrid's `../design.md`: square panels, 1.5px ink borders,
solid offset shadows, flat blueprint accents, the `[+]` logo, Space Grotesk UI
text, and JetBrains Mono structural labels. The brand fonts and their OFL licenses
are bundled locally in `assets/fonts/`.
Brief section entrances, KPI count-ups, pie hover transitions, and project-bar
animations respect system reduced-motion settings.

## Setup

### Vercel CLI deployment

The compiled site has its own `vercel.json` that selects static hosting, skips
Node installation/build commands, and serves the uploaded directory. The source
copy is in `web/vercel.json` so Flutter includes it in future builds.

From the repository root:

```powershell
npx --yes vercel login
.\flutter_analytics\run-web.ps1 -Build
npx --yes vercel --cwd "C:\Users\sadia\diagrid\flutter_analytics\build\web" --local-config "C:\Users\sadia\diagrid\flutter_analytics\build\web\vercel.json" --prod
```

On the first deployment, select your Vercel account/team and create a separate
analytics project. For later deployments, select that same analytics project if
Flutter has regenerated the build directory and removed its local `.vercel` link.
Keep the main React application's project/configuration separate.
Always pass `--local-config` to avoid selecting the parent React configuration.
The Flutter policy allows CanvasKit downloads and WebAssembly execution without
enabling general JavaScript `unsafe-eval`.

### Supabase configuration

First apply `../supabase/migrations/20261007000000_diagram_analytics.sql` to
Diagrid's Supabase database. Sign in using an existing Diagrid administrator.
Then apply `../supabase/migrations/20261008000000_advanced_diagram_analytics.sql`
to enable the additional insights. The existing page stays usable if only the
original migration has been applied.
Non-admin accounts cannot access the analytics RPC.

From the repository root on Windows:

```powershell
.\flutter_analytics\run-web.ps1
```

This reads the parent `.env` public Supabase URL and anonymous key. It does not
print or copy credentials into source files. To build using that configuration:

```powershell
.\flutter_analytics\run-web.ps1 -Build
```

Alternatively, inside this directory:

```sh
flutter pub get
flutter run -d chrome --dart-define=SUPABASE_URL=YOUR_URL --dart-define=SUPABASE_ANON_KEY=YOUR_PUBLIC_KEY
flutter analyze
flutter test
flutter build web --dart-define=SUPABASE_URL=YOUR_URL --dart-define=SUPABASE_ANON_KEY=YOUR_PUBLIC_KEY
```

Use only a public anonymous/publishable key. The browser authenticates each user;
the database independently enforces administrator access. Production output is
`build/web/`. Building without configuration displays a setup message.

See `../ANALYTICS.md` for the rubric mapping, calculation definitions, UTC date
rules, database setup, and verification commands. The app never falls back to
invented analytical values.
