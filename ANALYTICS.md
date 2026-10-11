# Diagrid Analytics / FRE413

The React page at `/admin/analytics` and the Flutter web companion in
`flutter_analytics/` use the same administrator-only Supabase RPC,
`get_diagram_analytics_v2`. Measured values come from actual records; forecast
estimates and review rules are explicitly labelled.

## Additional analytics

The four KPI cards, exactly three descriptive graphs, and source records remain.
An additional section provides:

- **Diagnostic comparisons:** recent 14-day creations versus the preceding
  14 days, with project/type count changes that sum to the overall change.
  These are segment associations, not proven causal explanations.
- **Predictive baseline:** average creation count across four consecutive,
  completed seven-day blocks, projected into the next seven-day block. This
  assumes recent creation rates remain representative; it is not machine learning.
  A held-out last-week check trains on only the preceding three weeks and shows
  estimate, actual count, and absolute error. One check is not a calibrated
  accuracy score. The observed weekly min/max is historical variation, not a
  forecast confidence interval.
- **Prescriptive review rules:** suggest checking a project after creation
  activity declines (previous period at least five creations), or when a project
  accounts for at least 60% of at least ten window creations. These thresholds
  are transparent review heuristics, not learned or optimized policies. Suggestions
  offer a project filter and never modify data automatically.

The analysis window is 28 days ending at the earlier of the selected end date
and yesterday UTC. Current/future days are excluded. Comparisons require a
matching retained record on or before the window start and a selected range that
contains the full window; forecasts additionally require ten window creations.
Missing days count as zero. Past-date projections are labelled historical.
All insight calculations consume the exact records already returned by the
descriptive RPC; they do not read a different dataset or leak unfiltered history.
Creation timestamps describe retained records, so deletions can change the
apparent history. This is not a reconstruction of all past activity.

## Required outputs

Each KPI has an information button: hover/focus shows a short definition, and
click/tap opens a keyboard-accessible dialog with its formula, current calculation,
filter scope, and edge cases. The card itself remains a readable summary.

| PDF component | Implementation |
| --- | --- |
| KPI cards (30 points) | Total diagrams, projects with diagrams, average diagrams per represented project, most-used type and count |
| Graphs (35 points) | Pie: diagram types; line: diagrams created per time bucket; horizontal bar: diagram counts by project |
| Records (20 points) | Diagram title, project name, diagram type, creation date, last update; search, sort, pagination |
| UI (15 points) | Responsive cards and charts, consistent filters, readable labels, loading/empty/error states |

## Enable the shared backend

Apply `supabase/migrations/20261007000000_diagram_analytics.sql` to the same
Supabase project used by Diagrid. For an existing hosted project, execute this
file in its SQL editor after the existing schema/security migrations are applied.
The migration is additive and replaces only its own analytics function.
It has **not** been applied automatically to the hosted database.

Then apply `supabase/migrations/20261008000000_advanced_diagram_analytics.sql`.
Existing deployments can run this second file alone once the original analytics
function is installed. It adds a V2 wrapper and a private calculation helper;
it leaves the original RPC available. Both clients fall back to that original
RPC only if V2 is missing, and show a migration notice instead of invented insights.

Both clients require an authenticated Diagrid administrator. The function checks
`auth.uid()` and `is_admin()` before reading records and denies anonymous callers.
Flutter uses the public Supabase key, never a service-role key.

## Calculation contract

- Every KPI, graph, and record uses one matching dataset within one SQL statement.
- Filters: inclusive UTC creation-date range, project ID, diagram type, and
  case-insensitive literal search across title/project/type. A blank range means all dates.
- Grouping: daily, weekly (Monday), or monthly UTC buckets. Missing buckets have
  zero counts. When a range is supplied, buckets span that range.
- Counts describe **currently saved** diagrams by creation date; deleted diagrams
  are not included. This is not an historical audit-event count.
- Average = matching diagrams / distinct represented projects. Empty projects
  do not contribute to the denominator. Empty results return zero and no most-used type.
- Most-used ties use alphabetical type order, consistently in both apps.
- Pie and line counts sum to the total diagram KPI. Project counts also sum to it,
  although only the top 10 project bars are displayed when there are more projects.
- Records pagination/sorting changes displayed rows only, never aggregate values.
- Query failures show an error, not demo values or a stale analytics panel.

The RPC returns `total_diagrams`, `project_count`, `average_per_project`,
`most_used_type`, `most_used_count`, `types`, `projects`, `series`, `records`,
`project_options`, `type_options`, `timezone`, and `bucket`. It returns the full
matching records to avoid PostgREST row-limit truncation; for very large future
datasets, introduce server pagination with the same snapshot contract.

## Verification

React: `npm run build` and `npx playwright test tests/e2e/analytics.spec.ts`.
Flutter: `flutter analyze`, `flutter test`, and `flutter build web` inside its directory.
Database: `supabase test db` with a running local Supabase stack and migrations applied.
`supabase/tests/database/diagram_analytics.test.sql` checks actual aggregation,
UTC boundaries, zero buckets, combined filters, empty results, and admin authorization.

The existing admin overview is separate from this new rubric page and still
contains legacy generated telemetry. Use **Analytics** for the FRE413 demonstration.
