# Trend Analytics Dashboard submission

The four PNG files in this folder are reproducible screenshots from the populated Flutter widget fixture. They show sample diagram data and can be regenerated with `flutter test test/widget_test.dart` from `flutter_analytics/`.

- `dashboard-complete.png`: complete dashboard
- `trend-kpi-cards.png`: four trend KPI cards
- `line-chart.png`: line chart
- `group-comparison.png`: two project counts, absolute difference, higher value

The runnable source is `../lib/main.dart` together with its imported files, especially `../lib/analytics_page.dart`, `../lib/trend_comparison.dart`, and `../lib/dashboard_ui.dart`. The app's live values come from the existing filtered Supabase analytics dataset.
