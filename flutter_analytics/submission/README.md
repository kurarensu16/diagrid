# Trend Analytics Dashboard submission

The four PNG files in this folder are reproducible screenshots from the populated Flutter widget fixture. They show sample diagram data and can be regenerated with `flutter test test/widget_test.dart` from `flutter_analytics/`.

- `dashboard-complete.png`: complete dashboard
- `trend-kpi-cards.png`: four trend KPI cards
- `line-chart.png`: line chart
- `group-comparison.png`: two project counts, absolute difference, higher value

`main.dart` in this folder is the complete single-file Dart source for submission. It combines the Flutter source modules, including the comparison calculation and dashboard UI. It requires the packages and font assets declared in the project `../pubspec.yaml` to run with the same appearance. The app's live values come from the existing filtered Supabase analytics dataset.
