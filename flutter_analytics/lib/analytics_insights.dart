import 'package:flutter/material.dart';
import 'dashboard_ui.dart';

class AnalyticsInsights extends StatelessWidget {
  const AnalyticsInsights({
    super.key,
    required this.data,
    required this.focusProject,
  });
  final Map<String, dynamic>? data;
  final void Function(String id) focusProject;
  String signed(num value) => '${value > 0 ? '+' : ''}$value';
  Widget section(String kind, String title, List<Widget> children) =>
      DashboardSurface(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('// $kind', style: monoStyle.copyWith(color: blueprint)),
            const SizedBox(height: 10),
            Text(
              title,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 16),
            ...children,
          ],
        ),
      );
  Widget paragraph(String text) => Padding(
    padding: const EdgeInsets.only(top: 10),
    child: Text(
      text,
      style: const TextStyle(fontSize: 12, color: mutedInk, height: 1.5),
    ),
  );
  List<Widget> segments(String title, List<dynamic> rows) => [
    const SizedBox(height: 16),
    Text(
      title,
      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
    ),
    const SizedBox(height: 8),
    if (rows.isEmpty) paragraph('No matching creations in this window.'),
    ...rows
        .take(3)
        .map(
          (row) => Padding(
            padding: const EdgeInsets.symmetric(vertical: 5),
            child: Row(
              children: [
                Expanded(
                  child: Tooltip(
                    message: row['label'] as String,
                    child: Text(
                      row['label'] as String,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  '${row['previous']} → ${row['recent']} (${signed(row['delta'] as num)})',
                  style: monoStyle.copyWith(fontSize: 10),
                ),
              ],
            ),
          ),
        ),
  ];
  @override
  Widget build(BuildContext context) {
    if (data == null) {
      return section('advanced analytics', 'Enable additional insights', [
        paragraph(
          'Apply the advanced analytics migration in Supabase to enable comparisons, forecasts, and suggested actions.',
        ),
      ]);
    }
    final insight = data!,
        diagnostic = insight['diagnostic'] as Map,
        forecast = insight['forecast'] as Map;
    final complete = insight['complete_history'] == true;
    final available = forecast['status'] == 'available';
    final recommendations = insight['recommendations'] as List;
    final cards = [
      section('diagnostic', 'What changed?', [
        if (complete) ...[
          Text(
            '${diagnostic['previous_count']} → ${diagnostic['recent_count']}',
            style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700),
          ),
          paragraph('Previous 14 days → recent 14 days'),
          paragraph(
            diagnostic['change_pct'] == null
                ? 'Percentage unavailable: previous count is zero.'
                : '${signed(diagnostic['change_pct'] as num)}% change',
          ),
          ...segments(
            'Project contributions',
            diagnostic['project_changes'] as List,
          ),
          ...segments(
            'Diagram-type contributions',
            diagnostic['type_changes'] as List,
          ),
        ] else
          paragraph(
            'A full 28-day matching history is needed for a fair period comparison.',
          ),
        paragraph(
          'These differences identify segments associated with the change; they do not establish its cause.',
        ),
      ]),
      section('predictive', 'Seven-day baseline', [
        if (available) ...[
          Text(
            '≈ ${(forecast['estimate'] as num).toStringAsFixed(2)} diagrams',
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
          ),
          paragraph(
            'Estimated creations for ${forecast['start']}–${forecast['end']}${forecast['historical_projection'] == true ? ' (historical projection)' : ''}',
          ),
          paragraph(
            'Recent weekly counts: ${forecast['observed_weekly_min']}–${forecast['observed_weekly_max']}',
          ),
          paragraph(
            'Last-week check: estimated ${forecast['backtest_estimate']}, observed ${forecast['backtest_actual']}; absolute error ${forecast['backtest_absolute_error']} diagrams.',
          ),
        ] else
          paragraph(forecast['reason'] as String),
        paragraph(
          'Four-week moving average. A planning estimate, not a guarantee; the weekly range is historical variation, not a confidence interval.',
        ),
      ]),
      section('prescriptive', 'Suggested reviews', [
        if (recommendations.isEmpty)
          paragraph(
            'No rule-based review actions were triggered for this view.',
          ),
        ...recommendations.map(
          (r) => Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Divider(color: borderLine),
                Text(
                  r['title'] as String,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                paragraph(r['evidence'] as String),
                paragraph(r['detail'] as String),
                if (r['project_id'] != null)
                  TextButton(
                    onPressed: () => focusProject(r['project_id'] as String),
                    child: const Text('Focus on this project'),
                  ),
              ],
            ),
          ),
        ),
      ]),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Comparisons, forecasts & actions',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        Text(
          'Analysis window: ${insight['window_start']}–${insight['window_end']} · 28 completed UTC days · uses the current filters',
          style: monoStyle,
        ),
        const SizedBox(height: 18),
        LayoutBuilder(
          builder: (context, constraints) {
            final columns = constraints.maxWidth >= 1100 ? 3 : 1;
            return Wrap(
              spacing: 20,
              runSpacing: 20,
              children: List.generate(
                cards.length,
                (i) => SizedBox(
                  width: (constraints.maxWidth - (columns - 1) * 20) / columns,
                  child: Entrance(delay: i * 60, child: cards[i]),
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 16),
        ExpansionTile(
          tilePadding: EdgeInsets.zero,
          title: Text(
            'Calculation methods & limitations',
            style: monoStyle.copyWith(color: blueprint),
          ),
          children: [
            paragraph(
              'The analysis ends on the selected end date or yesterday UTC, whichever is earlier. Today and future records are excluded. Comparisons require 28 days of matching history; forecasts also require 10 creations during that window. The last-week check uses the preceding three weeks, so it does not train on the week being checked. Deleted diagrams are absent from retained records, and a narrow filter may leave too little history. Suggestions are transparent review rules and never automatically change a project.',
            ),
          ],
        ),
      ],
    );
  }
}
