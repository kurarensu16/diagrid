import 'dart:async';
import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'dashboard_ui.dart';
import 'analytics_insights.dart';
import 'metric_help.dart';
import 'trend_comparison.dart';

typedef AnalyticsLoader =
    Future<Map<String, dynamic>> Function(Map<String, dynamic> filters);
const chartColors = [
  Color(0xff1e5c8c),
  Color(0xffd45b33),
  Color(0xff237b65),
  Color(0xff8254a0),
  Color(0xffa27619),
  Color(0xff518caf),
  Color(0xffb25676),
  Color(0xff686d75),
  Color(0xff375641),
];

class AnalyticsPage extends StatefulWidget {
  const AnalyticsPage({
    super.key,
    required this.load,
    required this.signOut,
    this.email = '',
  });
  final AnalyticsLoader load;
  final Future<void> Function() signOut;
  final String email;
  @override
  State<AnalyticsPage> createState() => _AnalyticsPageState();
}

class _AnalyticsPageState extends State<AnalyticsPage> {
  Map<String, dynamic>? data;
  DateTime? start, end, refreshed;
  String? project, type, error;
  String bucket = 'month';
  final search = TextEditingController();
  bool loading = true, ascending = false;
  int revision = 0, page = 0, pageSize = 10, sortColumn = 3;
  Timer? debounce;
  int? hoveredType;
  List<Map<String, dynamic>> list(String key) => ((data?[key] as List?) ?? [])
      .map((r) => Map<String, dynamic>.from(r as Map))
      .toList();
  String date(DateTime? value) =>
      value == null ? '' : value.toIso8601String().substring(0, 10);
  @override
  void initState() {
    super.initState();
    fetch();
  }

  @override
  void dispose() {
    debounce?.cancel();
    search.dispose();
    super.dispose();
  }

  Future<void> fetch() async {
    final request = ++revision;
    setState(() {
      loading = true;
      error = null;
      page = 0;
    });
    if (start != null && end != null && start!.isAfter(end!)) {
      setState(() {
        loading = false;
        error = 'Choose an end date on or after the start date.';
      });
      return;
    }
    try {
      final result = await widget.load({
        'start_date': start == null ? null : date(start),
        'end_date': end == null ? null : date(end),
        'filter_project': project,
        'filter_type': type,
        'search_text': search.text.trim(),
        'bucket': bucket,
      });
      if (mounted && request == revision) {
        setState(() {
          data = result;
          refreshed = DateTime.now();
        });
      }
    } catch (e) {
      if (mounted && request == revision) {
        setState(() => error = 'Unable to load analytics: $e');
      }
    } finally {
      if (mounted && request == revision) setState(() => loading = false);
    }
  }

  void queueSearch() {
    debounce?.cancel();
    revision++;
    setState(() {
      loading = true;
      error = null;
    });
    debounce = Timer(const Duration(milliseconds: 300), fetch);
  }

  Future<void> pickDate(bool from) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: (from ? start : end) ?? DateTime.now(),
      firstDate: DateTime(1970),
      lastDate: DateTime(2100),
    );
    if (picked != null) {
      setState(() {
        if (from) {
          start = picked;
        } else {
          end = picked;
        }
      });
      fetch();
    }
  }

  Widget panel(String title, Widget child, {String? subtitle}) =>
      DashboardSurface(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                letterSpacing: -.3,
              ),
            ),
            if (subtitle != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  subtitle,
                  style: const TextStyle(color: mutedInk, fontSize: 12),
                ),
              ),
            const SizedBox(height: 24),
            child,
          ],
        ),
      );
  Widget dropdown(
    String label,
    String? value,
    List<DropdownMenuItem<String>> items,
    void Function(String?) onChange,
  ) => DropdownButtonFormField<String>(
    initialValue: value,
    key: ValueKey('$label-$value'),
    isExpanded: true,
    decoration: InputDecoration(labelText: label),
    items: items,
    onChanged: onChange,
  );

  void clearFilters() {
    debounce?.cancel();
    setState(() {
      start = null;
      end = null;
      project = null;
      type = null;
      bucket = 'month';
      search.clear();
    });
    fetch();
  }

  Widget filtersPanel() => panel(
    'Filters',
    LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 850
            ? 3
            : constraints.maxWidth >= 500
            ? 2
            : 1;
        final width = (constraints.maxWidth - (columns - 1) * 16) / columns;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 16,
              runSpacing: 16,
              children: [
                SizedBox(
                  width: width,
                  child: OutlinedButton.icon(
                    onPressed: () => pickDate(true),
                    icon: const Icon(Icons.calendar_today_outlined, size: 17),
                    label: Text(
                      'Created from: ${start == null ? 'Any date' : date(start)}',
                      style: const TextStyle(fontSize: 13),
                    ),
                  ),
                ),
                SizedBox(
                  width: width,
                  child: OutlinedButton.icon(
                    onPressed: () => pickDate(false),
                    icon: const Icon(Icons.calendar_today_outlined, size: 17),
                    label: Text(
                      'Created through: ${end == null ? 'Any date' : date(end)}',
                      style: const TextStyle(fontSize: 13),
                    ),
                  ),
                ),
                SizedBox(
                  width: width,
                  child: dropdown(
                    'Project',
                    project,
                    [
                      const DropdownMenuItem(
                        value: null,
                        child: Text('All projects'),
                      ),
                      ...list('project_options').map(
                        (p) => DropdownMenuItem(
                          value: p['id'] as String,
                          child: Text(
                            p['name'] as String,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ),
                    ],
                    (v) {
                      setState(() => project = v);
                      fetch();
                    },
                  ),
                ),
                SizedBox(
                  width: width,
                  child: dropdown(
                    'Diagram type',
                    type,
                    [
                      const DropdownMenuItem(
                        value: null,
                        child: Text('All types'),
                      ),
                      ...((data?['type_options'] as List?) ?? []).map(
                        (t) => DropdownMenuItem(
                          value: t as String,
                          child: Text(t.toUpperCase()),
                        ),
                      ),
                    ],
                    (v) {
                      setState(() => type = v);
                      fetch();
                    },
                  ),
                ),
                SizedBox(
                  width: width,
                  child: dropdown(
                    'Time grouping',
                    bucket,
                    ['day', 'week', 'month']
                        .map(
                          (b) => DropdownMenuItem(
                            value: b,
                            child: Text(
                              {
                                'day': 'Daily',
                                'week': 'Weekly',
                                'month': 'Monthly',
                              }[b]!,
                            ),
                          ),
                        )
                        .toList(),
                    (v) {
                      setState(() => bucket = v!);
                      fetch();
                    },
                  ),
                ),
                SizedBox(
                  width: width,
                  child: TextField(
                    controller: search,
                    onChanged: (_) => queueSearch(),
                    decoration: const InputDecoration(
                      labelText: 'Search records',
                      hintText: 'Title, project, or type',
                      prefixIcon: Icon(Icons.search_rounded, size: 20),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 16,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                TextButton.icon(
                  onPressed: clearFilters,
                  icon: const Icon(Icons.restart_alt_rounded, size: 17),
                  label: const Text('Clear filters'),
                ),
                const Text(
                  'One set of filters. Every card, chart, and record.',
                  style: TextStyle(color: mutedInk, fontSize: 12),
                ),
              ],
            ),
          ],
        );
      },
    ),
    subtitle: 'Narrow your view by creation date, project, or diagram type.',
  );

  Widget metrics() => LayoutBuilder(
    builder: (context, constraints) {
      final columns = constraints.maxWidth >= 1000
          ? 4
          : constraints.maxWidth >= 550
          ? 2
          : 1;
      final values = [
        MetricCard(
          label: 'Total diagrams',
          value: data!['total_diagrams'] as num,
          icon: Icons.description_outlined,
          color: blueprint,
          detail: 'Diagrams matching your filters',
          explanation: MetricHelp(
            summary:
                'Number of currently saved diagrams that match your filters.',
            calculation: 'Count of matching diagram records.',
            current:
                '${data!['total_diagrams']} matching records = ${data!['total_diagrams']} diagrams.',
            note:
                'Includes every matching record, not just the current table page. Deleted diagrams are not included.',
          ),
        ),
        MetricCard(
          label: 'Projects with diagrams',
          value: data!['project_count'] as num,
          icon: Icons.folder_open_rounded,
          color: const Color(0xff318675),
          detail: 'Projects represented in this view',
          explanation: MetricHelp(
            summary:
                'Number of distinct projects with at least one matching diagram.',
            calculation: 'Count distinct project IDs in the matching records.',
            current:
                '${data!['total_diagrams']} matching diagrams span ${data!['project_count']} distinct projects.',
            note:
                'Empty projects and projects with no diagrams matching the filters are not counted.',
          ),
        ),
        MetricCard(
          label: 'Average diagrams per project',
          value: data!['average_per_project'] as num,
          decimals: 2,
          icon: Icons.stacked_bar_chart_rounded,
          color: signal,
          detail: 'Across projects with matching diagrams',
          explanation: MetricHelp(
            summary:
                'Average number of matching diagrams per represented project.',
            calculation:
                'Total matching diagrams ÷ projects with matching diagrams.',
            current: (data!['project_count'] as num) == 0
                ? 'No matching projects: the average is 0.00.'
                : '${data!['total_diagrams']} ÷ ${data!['project_count']} = ${(data!['average_per_project'] as num).toStringAsFixed(2)} diagrams per project.',
            note:
                'Rounded to two decimal places. Returns 0.00 when no projects match; empty projects do not contribute to the denominator.',
          ),
        ),
        MetricCard(
          label: 'Most-used diagram type',
          value: data!['most_used_count'] as num,
          textValue: data!['most_used_type'] == null
              ? 'No data'
              : '${(data!['most_used_type'] as String).toUpperCase()} (${data!['most_used_count']})',
          icon: Icons.category_outlined,
          color: const Color(0xff8064ac),
          detail: 'Most frequent format in this view',
          explanation: MetricHelp(
            summary:
                'Diagram type with the largest number of matching records.',
            calculation:
                'Group the records by diagram type, count each group, and select the largest.',
            current:
                data!['most_used_type'] == null ||
                    (data!['total_diagrams'] as num) == 0
                ? 'No matching records: no diagram type can be ranked.'
                : '${(data!['most_used_type'] as String).toUpperCase()}: ${data!['most_used_count']} of ${data!['total_diagrams']} diagrams (${((data!['most_used_count'] as num) / (data!['total_diagrams'] as num) * 100).toStringAsFixed(1)}%).',
            note:
                'The number in parentheses is that type’s count. Ties are resolved alphabetically by diagram type. Shows “No data” when no records match.',
          ),
        ),
      ];
      return Wrap(
        spacing: 16,
        runSpacing: 16,
        children: List.generate(
          values.length,
          (i) => SizedBox(
            width: (constraints.maxWidth - (columns - 1) * 16) / columns,
            child: Entrance(delay: i * 65, child: values[i]),
          ),
        ),
      );
    },
  );

  Widget trendMetrics() {
    final series = list('series');
    final trend = TrendSummary.fromSeries(series);
    final hasValues = series.isNotEmpty;
    final startingDate = hasValues
        ? '${series.first['date']}'
        : 'No time buckets';
    final currentDate = hasValues
        ? '${series.last['date']}'
        : 'No time buckets';
    final change = trend.percentageChange;
    final cards = [
      MetricCard(
        label: 'Starting Value',
        value: trend.starting,
        textValue: hasValues ? null : 'No data',
        icon: Icons.first_page_rounded,
        color: blueprint,
        detail: '$startingDate · diagrams created',
        explanation: MetricHelp(
          summary: 'Diagrams created in the first visible $bucket bucket.',
          calculation: 'Use the first point in the filtered line chart.',
          current: hasValues
              ? '$startingDate: ${trend.starting.toInt()} diagrams.'
              : 'No time buckets are available.',
          note: 'The chart uses UTC creation dates and the selected grouping.',
        ),
      ),
      MetricCard(
        label: 'Current Value',
        value: trend.current,
        textValue: hasValues ? null : 'No data',
        icon: Icons.last_page_rounded,
        color: const Color(0xff318675),
        detail: '$currentDate · diagrams created',
        explanation: MetricHelp(
          summary: 'Diagrams created in the last visible $bucket bucket.',
          calculation: 'Use the last point in the filtered line chart.',
          current: hasValues
              ? '$currentDate: ${trend.current.toInt()} diagrams.'
              : 'No time buckets are available.',
          note: 'The last bucket may still be in progress.',
        ),
      ),
      MetricCard(
        label: 'Percentage Change',
        value: change ?? 0,
        textValue: change == null
            ? 'N/A'
            : '${change > 0 ? '+' : ''}${change.toStringAsFixed(2)}%',
        icon: Icons.percent_rounded,
        color: signal,
        detail: 'First to last chart bucket',
        explanation: MetricHelp(
          summary: 'Change between the first and last visible chart buckets.',
          calculation: '(Current − starting) ÷ starting × 100.',
          current: change == null
              ? 'N/A: at least two buckets and a nonzero starting value are needed.'
              : '${change.toStringAsFixed(2)}% change.',
          note: 'This compares bucket counts, not the total diagram count.',
        ),
      ),
      MetricCard(
        label: 'Trend',
        value: 0,
        textValue: trend.trend,
        icon: Icons.trending_up_rounded,
        color: const Color(0xff8064ac),
        detail: 'First to last chart bucket',
        explanation: MetricHelp(
          summary:
              'Direction of change between the first and last visible chart buckets.',
          calculation:
              'Current > starting: Up; current < starting: Down; equal: Stable.',
          current: trend.hasTrend
              ? '${trend.starting.toInt()} → ${trend.current.toInt()}: ${trend.trend}.'
              : 'N/A: at least two buckets are needed.',
          note: 'Intermediate chart points do not determine this direction.',
        ),
      ),
    ];
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 1000
            ? 4
            : constraints.maxWidth >= 550
            ? 2
            : 1;
        return Wrap(
          spacing: 16,
          runSpacing: 16,
          children: List.generate(
            cards.length,
            (i) => SizedBox(
              width: (constraints.maxWidth - (columns - 1) * 16) / columns,
              child: Entrance(delay: i * 65, child: cards[i]),
            ),
          ),
        );
      },
    );
  }

  Widget groupComparison() {
    final comparison = GroupComparison.fromProjects(list('projects'));
    return panel(
      'Group Comparison',
      comparison == null
          ? const Text(
              'At least two projects with matching diagrams are needed.',
              style: TextStyle(color: mutedInk),
            )
          : LayoutBuilder(
              builder: (context, constraints) {
                Widget result(String label, String value) => SizedBox(
                  width: constraints.maxWidth >= 700
                      ? (constraints.maxWidth - 16) / 2
                      : constraints.maxWidth,
                  child: Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: paper,
                      border: Border.all(color: borderLine),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          label,
                          style: monoStyle.copyWith(color: blueprint),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          value,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
                return Wrap(
                  spacing: 16,
                  runSpacing: 16,
                  children: [
                    result(
                      comparison.firstName,
                      comparison.firstValue.toStringAsFixed(0),
                    ),
                    result(
                      comparison.secondName,
                      comparison.secondValue.toStringAsFixed(0),
                    ),
                    result(
                      'Difference',
                      comparison.difference.toStringAsFixed(2),
                    ),
                    result('Higher Value', comparison.higherValue),
                  ],
                );
              },
            ),
      subtitle:
          'Two projects with the most matching diagrams · absolute difference',
    );
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, viewport) => Scaffold(
      appBar: AppBar(
        toolbarHeight: 76,
        titleSpacing: 24,
        title: Row(
          children: [
            const BrandMark(),
            const SizedBox(width: 12),
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'diagrid',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -.7,
                  ),
                ),
                Text(
                  'ANALYTICS',
                  style: TextStyle(
                    fontSize: 9,
                    letterSpacing: 2.2,
                    color: mutedInk,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          if (viewport.maxWidth > 750) ...[
            const StatusPill('Admin workspace', icon: Icons.shield_outlined),
            const SizedBox(width: 16),
          ],
          IconButton(
            tooltip: 'Refresh',
            onPressed: loading ? null : fetch,
            icon: const Icon(Icons.refresh_rounded, size: 21),
          ),
          IconButton(
            tooltip: 'Sign out',
            onPressed: () async {
              try {
                await widget.signOut();
              } catch (e) {
                if (mounted) setState(() => error = 'Unable to sign out: $e');
              }
            },
            icon: const Icon(Icons.logout_rounded, size: 21),
          ),
          const SizedBox(width: 16),
        ],
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(viewport.maxWidth < 600 ? 16 : 32),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1320),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Entrance(
                  child: Container(
                    padding: const EdgeInsets.only(bottom: 24),
                    decoration: const BoxDecoration(
                      border: Border(bottom: BorderSide(color: borderLine)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Diagrid Trend Analytics',
                          style: TextStyle(
                            fontSize: viewport.maxWidth < 600 ? 28 : 34,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -.8,
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          '// diagram records, project metrics, and creation trends',
                          style: monoStyle,
                        ),
                        const SizedBox(height: 16),
                        Wrap(
                          spacing: 18,
                          runSpacing: 8,
                          children: [
                            const Text(
                              'Dates & chart buckets in UTC',
                              style: monoStyle,
                            ),
                            if (refreshed != null)
                              Text(
                                'Last refreshed: ${refreshed!.toLocal().toString().substring(11, 19)}',
                                style: monoStyle,
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                Entrance(delay: 60, child: filtersPanel()),
                const SizedBox(height: 24),
                if (error != null)
                  panel(
                    'Analytics unavailable',
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(
                          Icons.cloud_off_outlined,
                          color: signal,
                          size: 32,
                        ),
                        const SizedBox(height: 12),
                        Text(error!, style: const TextStyle(color: mutedInk)),
                        const SizedBox(height: 16),
                        FilledButton.icon(
                          onPressed: fetch,
                          icon: const Icon(Icons.refresh_rounded, size: 18),
                          label: const Text('Try again'),
                        ),
                      ],
                    ),
                  )
                else if (loading)
                  const Padding(
                    padding: EdgeInsets.all(48),
                    child: Column(
                      children: [
                        CircularProgressIndicator(strokeWidth: 2),
                        SizedBox(height: 16),
                        Text(
                          'Gathering your workspace insights…',
                          style: TextStyle(color: mutedInk),
                        ),
                      ],
                    ),
                  )
                else if (data != null) ...[
                  metrics(),
                  const SizedBox(height: 28),
                  const Text(
                    'Trend KPI Cards',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'First and last buckets from the line chart below.',
                    style: TextStyle(color: mutedInk, fontSize: 13),
                  ),
                  const SizedBox(height: 18),
                  trendMetrics(),
                  const SizedBox(height: 28),
                  const Text(
                    'Explore your diagrams',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -.4,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Three perspectives on the same records.',
                    style: TextStyle(color: mutedInk, fontSize: 13),
                  ),
                  const SizedBox(height: 18),
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final width = constraints.maxWidth >= 950
                          ? (constraints.maxWidth - 24) / 2
                          : constraints.maxWidth;
                      return Wrap(
                        spacing: 24,
                        runSpacing: 24,
                        children: [
                          SizedBox(
                            width: width,
                            child: Entrance(delay: 180, child: pie()),
                          ),
                          SizedBox(
                            width: width,
                            child: Entrance(delay: 240, child: line()),
                          ),
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 24),
                  Entrance(delay: 280, child: bars()),
                  const SizedBox(height: 24),
                  Entrance(delay: 300, child: groupComparison()),
                  const SizedBox(height: 24),
                  AnalyticsInsights(
                    data: data!['insights'] == null
                        ? null
                        : Map<String, dynamic>.from(data!['insights'] as Map),
                    focusProject: (id) {
                      setState(() => project = id);
                      fetch();
                    },
                  ),
                  const SizedBox(height: 24),
                  Entrance(delay: 320, child: records()),
                  const SizedBox(height: 24),
                  const Text(
                    'Counts reflect currently saved diagrams created in the selected period.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: mutedInk, fontSize: 11),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    ),
  );

  Widget pie() {
    final types = list('types'), total = data!['total_diagrams'] as num;
    return panel(
      'Diagram types',
      total == 0
          ? const EmptyChart()
          : Column(
              children: [
                SizedBox(
                  height: 250,
                  child: PieChart(
                    PieChartData(
                      centerSpaceRadius: 0,
                      sectionsSpace: 3,
                      pieTouchData: PieTouchData(
                        touchCallback: (event, response) {
                          setState(
                            () =>
                                hoveredType = event.isInterestedForInteractions
                                ? response?.touchedSection?.touchedSectionIndex
                                : null,
                          );
                        },
                      ),
                      sections: List.generate(types.length, (i) {
                        final share = (types[i]['count'] as num) / total * 100;
                        return PieChartSectionData(
                          value: (types[i]['count'] as num).toDouble(),
                          color: chartColors[i % chartColors.length],
                          radius: hoveredType == i ? 112 : 102,
                          title: share >= 6
                              ? '${share.toStringAsFixed(1)}%'
                              : '',
                          titleStyle: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        );
                      }),
                    ),
                    duration: motionDuration(context, 300),
                    curve: Curves.easeOutCubic,
                  ),
                ),
                const SizedBox(height: 12),
                ...types.asMap().entries.map(
                  (e) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Row(
                      children: [
                        Container(
                          width: 9,
                          height: 9,
                          decoration: BoxDecoration(
                            color: chartColors[e.key % chartColors.length],
                            borderRadius: BorderRadius.zero,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            (e.value['label'] as String).toUpperCase(),
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Text(
                          '${e.value['count']}',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(width: 12),
                        SizedBox(
                          width: 58,
                          child: Text(
                            '${((e.value['count'] as num) / total * 100).toStringAsFixed(1)}%',
                            textAlign: TextAlign.right,
                            style: const TextStyle(
                              fontSize: 12,
                              color: mutedInk,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
      subtitle: 'PIE CHART · Share of matching diagrams',
    );
  }

  Widget line() {
    final series = list('series');
    final maxCount = series.fold<double>(
      1,
      (max, p) =>
          (p['count'] as num) > max ? (p['count'] as num).toDouble() : max,
    );
    return panel(
      'Diagrams created over time',
      (data!['total_diagrams'] as num) == 0
          ? const EmptyChart()
          : Column(
              children: [
                const SizedBox(height: 16),
                SizedBox(
                  height: 245,
                  child: LineChart(
                    LineChartData(
                      minX: 0,
                      maxX: series.length < 2
                          ? 1
                          : (series.length - 1).toDouble(),
                      minY: 0,
                      maxY: maxCount,
                      borderData: FlBorderData(show: false),
                      gridData: FlGridData(
                        drawVerticalLine: false,
                        horizontalInterval: maxCount <= 5
                            ? 1
                            : (maxCount / 4).ceilToDouble(),
                        getDrawingHorizontalLine: (_) => const FlLine(
                          color: Color(0xffe8eef4),
                          strokeWidth: 1,
                          dashArray: [4, 4],
                        ),
                      ),
                      lineTouchData: LineTouchData(
                        touchTooltipData: LineTouchTooltipData(
                          fitInsideHorizontally: true,
                          fitInsideVertically: true,
                          getTooltipColor: (_) => ink,
                          getTooltipItems: (spots) => spots
                              .map(
                                (spot) => LineTooltipItem(
                                  '${series[spot.spotIndex]['date']}\n${spot.y.toInt()} diagrams',
                                  const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                  ),
                                ),
                              )
                              .toList(),
                        ),
                      ),
                      titlesData: FlTitlesData(
                        topTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false),
                        ),
                        rightTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false),
                        ),
                        bottomTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false),
                        ),
                        leftTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            reservedSize: 32,
                            interval: maxCount <= 5
                                ? 1
                                : (maxCount / 4).ceilToDouble(),
                            getTitlesWidget: (value, meta) => Text(
                              value.toInt().toString(),
                              style: const TextStyle(
                                color: mutedInk,
                                fontSize: 11,
                              ),
                            ),
                          ),
                        ),
                      ),
                      lineBarsData: [
                        LineChartBarData(
                          isCurved: false,
                          color: blueprint,
                          barWidth: 3,
                          dotData: FlDotData(show: series.length <= 35),
                          belowBarData: BarAreaData(
                            show: true,
                            color: blueprint.withValues(alpha: .06),
                          ),
                          spots: series
                              .asMap()
                              .entries
                              .map(
                                (e) => FlSpot(
                                  e.key.toDouble(),
                                  (e.value['count'] as num).toDouble(),
                                ),
                              )
                              .toList(),
                        ),
                      ],
                    ),
                    duration: motionDuration(context, 450),
                    curve: Curves.easeOutCubic,
                  ),
                ),
                const SizedBox(height: 14),
                if (series.isNotEmpty)
                  LayoutBuilder(
                    builder: (context, constraints) => Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '${series.first['date']}',
                          style: const TextStyle(color: mutedInk, fontSize: 11),
                        ),
                        if (series.length > 2 && constraints.maxWidth > 400)
                          Text(
                            '${series[series.length ~/ 2]['date']}',
                            style: const TextStyle(
                              color: mutedInk,
                              fontSize: 11,
                            ),
                          ),
                        if (series.length > 1)
                          Text(
                            '${series.last['date']}',
                            style: const TextStyle(
                              color: mutedInk,
                              fontSize: 11,
                            ),
                          ),
                      ],
                    ),
                  ),
                const SizedBox(height: 12),
                Theme(
                  data: Theme.of(
                    context,
                  ).copyWith(dividerColor: Colors.transparent),
                  child: ExpansionTile(
                    tilePadding: EdgeInsets.zero,
                    title: const Text(
                      'Exact time-series values',
                      style: TextStyle(color: blueprint, fontSize: 12),
                    ),
                    children: [
                      SizedBox(
                        height: 160,
                        child: ListView(
                          children: series
                              .map(
                                (p) => ListTile(
                                  dense: true,
                                  title: Text('${p['date']}'),
                                  trailing: Text('${p['count']} diagrams'),
                                ),
                              )
                              .toList(),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
      subtitle: 'LINE CHART · Per $bucket · UTC',
    );
  }

  Widget bars() {
    final projects = list('projects'), top = list('projects').take(10).toList();
    final maxCount = top.isEmpty ? 1 : (top.first['count'] as num).toDouble();
    return panel(
      projects.length > 10
          ? 'Top 10 projects by diagram count'
          : 'Diagrams by project',
      top.isEmpty
          ? const EmptyChart()
          : Column(
              children: top.asMap().entries.map((entry) {
                final p = entry.value;
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 9),
                  child: Row(
                    children: [
                      SizedBox(
                        width: MediaQuery.sizeOf(context).width < 600
                            ? 86
                            : 170,
                        child: Tooltip(
                          message: p['label'] as String,
                          child: Text(
                            p['label'] as String,
                            style: const TextStyle(fontSize: 12),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Semantics(
                          label: '${p['label']}: ${p['count']} diagrams',
                          child: Tooltip(
                            message: '${p['label']}: ${p['count']} diagrams',
                            child: Container(
                              height: 24,
                              decoration: BoxDecoration(
                                color: paper,
                                borderRadius: BorderRadius.zero,
                                border: Border.all(color: borderLine),
                              ),
                              child: TweenAnimationBuilder<double>(
                                tween: Tween(
                                  begin: 0,
                                  end: (p['count'] as num) / maxCount,
                                ),
                                duration: motionDuration(context, 750),
                                curve: Curves.easeOutCubic,
                                builder: (context, value, _) => Align(
                                  alignment: Alignment.centerLeft,
                                  child: FractionallySizedBox(
                                    widthFactor: value,
                                    child: Container(
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.zero,
                                        color: blueprint,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      SizedBox(
                        width: 32,
                        child: Text(
                          '${p['count']}',
                          textAlign: TextAlign.right,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
      subtitle:
          'BAR CHART · Matching diagrams per project. All projects appear in the records below.',
    );
  }

  Widget records() {
    final rows = list('records');
    const keys = ['title', 'project_name', 'type', 'created_at', 'updated_at'];
    rows.sort((a, b) {
      final comparison = (a[keys[sortColumn]] as String).compareTo(
        b[keys[sortColumn]] as String,
      );
      return ascending ? comparison : -comparison;
    });
    final pageCount = (rows.length / pageSize).ceil().clamp(1, 1000000);
    final current = page.clamp(0, pageCount - 1);
    final shown = rows.skip(current * pageSize).take(pageSize).toList();
    return panel(
      'Diagram Records',
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: 12,
            runSpacing: 8,
            children: [
              StatusPill(
                '${rows.length} matching records',
                icon: Icons.table_rows_outlined,
              ),
              const StatusPill(
                'Dates in UTC',
                color: mutedInk,
                icon: Icons.schedule_outlined,
              ),
            ],
          ),
          const SizedBox(height: 18),
          LayoutBuilder(
            builder: (context, constraints) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (constraints.maxWidth < 700)
                  const Padding(
                    padding: EdgeInsets.only(bottom: 10),
                    child: Text(
                      'Swipe horizontally to see every column.',
                      style: TextStyle(color: mutedInk, fontSize: 11),
                    ),
                  ),
                ClipRRect(
                  borderRadius: BorderRadius.zero,
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: ConstrainedBox(
                      constraints: BoxConstraints(
                        minWidth: constraints.maxWidth,
                      ),
                      child: DataTable(
                        sortColumnIndex: sortColumn,
                        sortAscending: ascending,
                        showCheckboxColumn: false,
                        headingRowHeight: 48,
                        dataRowMinHeight: 56,
                        dataRowMaxHeight: 56,
                        columns: List.generate(
                          keys.length,
                          (i) => DataColumn(
                            label: Text(
                              [
                                'Diagram title',
                                'Project name',
                                'Diagram type',
                                'Created date',
                                'Last updated',
                              ][i],
                            ),
                            onSort: (column, asc) => setState(() {
                              sortColumn = column;
                              ascending = asc;
                            }),
                          ),
                        ),
                        rows: shown.asMap().entries.map((entry) {
                          final r = entry.value;
                          return DataRow(
                            key: ValueKey(r['id']),
                            color: WidgetStateProperty.resolveWith(
                              (states) => states.contains(WidgetState.hovered)
                                  ? paper
                                  : entry.key.isEven
                                  ? Colors.white
                                  : paper,
                            ),
                            cells: keys
                                .map(
                                  (k) => DataCell(
                                    k == 'type'
                                        ? StatusPill(
                                            (r[k] as String).toUpperCase(),
                                          )
                                        : Text(
                                            k.endsWith('_at')
                                                ? DateTime.parse(r[k] as String)
                                                      .toUtc()
                                                      .toString()
                                                      .substring(0, 16)
                                                : r[k] as String,
                                          ),
                                  ),
                                )
                                .toList(),
                          );
                        }).toList(),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (rows.isEmpty)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Text(
                'No diagrams match these filters.',
                style: TextStyle(color: mutedInk),
              ),
            ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 16,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              const Text(
                'Rows per page',
                style: TextStyle(color: mutedInk, fontSize: 12),
              ),
              DropdownButton<int>(
                value: pageSize,
                underline: const SizedBox(),
                items: [10, 25, 50]
                    .map((n) => DropdownMenuItem(value: n, child: Text('$n')))
                    .toList(),
                onChanged: (n) => setState(() {
                  pageSize = n!;
                  page = 0;
                }),
              ),
              TextButton(
                onPressed: current == 0
                    ? null
                    : () => setState(() => page = current - 1),
                child: const Text('Previous'),
              ),
              Text(
                'Page ${current + 1} of $pageCount',
                style: const TextStyle(fontSize: 12, color: mutedInk),
              ),
              TextButton(
                onPressed: current >= pageCount - 1
                    ? null
                    : () => setState(() => page = current + 1),
                child: const Text('Next'),
              ),
            ],
          ),
        ],
      ),
      subtitle: 'The source records behind every insight above.',
    );
  }
}
