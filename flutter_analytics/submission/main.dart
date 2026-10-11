import 'dart:async';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:fl_chart/fl_chart.dart';

// Source: main.dart

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  const url = String.fromEnvironment('SUPABASE_URL');
  const key = String.fromEnvironment('SUPABASE_ANON_KEY');
  String? error;
  if (url.isEmpty || key.isEmpty) {
    error =
        'Supabase configuration is missing. Run this app using the instructions in its README.';
  } else {
    try {
      await Supabase.initialize(url: url, publishableKey: key);
    } catch (e) {
      error = 'Unable to connect: $e';
    }
  }
  runApp(AnalyticsApp(startupError: error));
}

class AnalyticsApp extends StatelessWidget {
  const AnalyticsApp({super.key, this.startupError});
  final String? startupError;
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Diagrid Trend Analytics',
    debugShowCheckedModeBanner: false,
    theme: dashboardTheme(),
    home: startupError != null
        ? Scaffold(
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(startupError!),
              ),
            ),
          )
        : const SessionGate(),
  );
}

class SessionGate extends StatelessWidget {
  const SessionGate({super.key});
  @override
  Widget build(BuildContext context) {
    final client = Supabase.instance.client;
    return StreamBuilder<AuthState>(
      stream: client.auth.onAuthStateChange,
      builder: (context, snapshot) {
        final session = client.auth.currentSession;
        if (session == null) return const SignInPage();
        return AnalyticsPage(
          key: ValueKey(session.user.id),
          email: session.user.email ?? '',
          load: (filters) => loadDiagramAnalytics(client, filters),
          signOut: () => client.auth.signOut(),
        );
      },
    );
  }
}

class SignInPage extends StatefulWidget {
  const SignInPage({super.key});
  @override
  State<SignInPage> createState() => _SignInPageState();
}

class _SignInPageState extends State<SignInPage> {
  final email = TextEditingController(), password = TextEditingController();
  bool busy = false;
  bool hidePassword = true;
  String? error;
  @override
  void dispose() {
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> signIn() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await Supabase.instance.client.auth.signInWithPassword(
        email: email.text.trim(),
        password: password.text,
      );
    } on AuthException catch (e) {
      if (mounted) setState(() => error = e.message);
    } catch (_) {
      if (mounted) {
        setState(
          () =>
              error = 'Unable to sign in. Check your connection and try again.',
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 525),
          child: Entrance(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    BrandMark(),
                    SizedBox(width: 9),
                    Text(
                      'diagrid',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -.7,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                const Text(
                  '// analytics workspace',
                  textAlign: TextAlign.center,
                  style: monoStyle,
                ),
                const SizedBox(height: 30),
                DashboardSurface(
                  shadowColor: ink,
                  padding: EdgeInsets.all(
                    MediaQuery.sizeOf(context).width < 600 ? 24 : 36,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text(
                        'Welcome back',
                        style: TextStyle(
                          fontSize: 25,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -.6,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        '// enter your credentials to access your analytics',
                        style: monoStyle.copyWith(fontSize: 13, height: 1.6),
                      ),
                      const SizedBox(height: 28),
                      const Text(
                        'Email Address',
                        style: TextStyle(fontSize: 13, color: mutedInk),
                      ),
                      const SizedBox(height: 9),
                      TextField(
                        controller: email,
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [AutofillHints.email],
                        decoration: const InputDecoration(
                          hintText: 'you@example.com',
                          prefixIcon: Icon(Icons.mail_outline, size: 19),
                        ),
                      ),
                      const SizedBox(height: 22),
                      const Text(
                        'Password',
                        style: TextStyle(fontSize: 13, color: mutedInk),
                      ),
                      const SizedBox(height: 9),
                      TextField(
                        controller: password,
                        obscureText: hidePassword,
                        autofillHints: const [AutofillHints.password],
                        onSubmitted: (_) {
                          if (!busy) signIn();
                        },
                        decoration: InputDecoration(
                          prefixIcon: const Icon(Icons.lock_outline, size: 19),
                          suffixIcon: IconButton(
                            tooltip: hidePassword
                                ? 'Show password'
                                : 'Hide password',
                            onPressed: () =>
                                setState(() => hidePassword = !hidePassword),
                            icon: Icon(
                              hidePassword
                                  ? Icons.visibility_outlined
                                  : Icons.visibility_off_outlined,
                              size: 19,
                            ),
                          ),
                        ),
                      ),
                      if (error != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 16),
                          child: Text(
                            error!,
                            style: const TextStyle(color: signal),
                          ),
                        ),
                      const SizedBox(height: 26),
                      FilledButton(
                        onPressed: busy ? null : signIn,
                        child: AnimatedSwitcher(
                          duration: motionDuration(context, 150),
                          child: Row(
                            key: ValueKey(busy),
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(busy ? 'SIGNING IN…' : 'SIGN IN'),
                              if (!busy) ...[
                                const SizedBox(width: 12),
                                const Icon(Icons.arrow_forward, size: 18),
                              ],
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      const Divider(color: borderLine),
                      const SizedBox(height: 12),
                      const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.shield_outlined,
                            size: 14,
                            color: mutedInk,
                          ),
                          SizedBox(width: 8),
                          Text('ADMINISTRATOR ACCESS', style: monoStyle),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 28),
                const Text(
                  'Diagrid Analytics · FRE413',
                  textAlign: TextAlign.center,
                  style: monoStyle,
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

// Source: analytics_page.dart

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

// Source: analytics_insights.dart

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

// Source: dashboard_ui.dart

const ink = Color(0xff15191c);
const mutedInk = Color(0xff4a5359);
const blueprint = Color(0xff1e5c8c);
const signal = Color(0xffd45b33);
const paper = Color(0xfff6f7f5);
const borderLine = Color(0xffd7dbd8);
const monoStyle = TextStyle(
  fontFamily: 'JetBrainsMono',
  fontSize: 11,
  color: mutedInk,
);

ThemeData dashboardTheme() => ThemeData(
  fontFamily: 'SpaceGrotesk',
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(
    seedColor: blueprint,
    surface: Colors.white,
  ),
  scaffoldBackgroundColor: paper,
  textTheme: ThemeData.light().textTheme.apply(
    fontFamily: 'SpaceGrotesk',
    bodyColor: ink,
    displayColor: ink,
  ),
  appBarTheme: const AppBarTheme(
    backgroundColor: Colors.white,
    foregroundColor: ink,
    surfaceTintColor: Colors.transparent,
    elevation: 0,
    shape: Border(bottom: BorderSide(color: borderLine)),
  ),
  inputDecorationTheme: const InputDecorationTheme(
    filled: true,
    fillColor: paper,
    labelStyle: TextStyle(color: mutedInk, fontSize: 13),
    hintStyle: TextStyle(
      fontFamily: 'JetBrainsMono',
      fontSize: 11,
      color: mutedInk,
    ),
    contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 16),
    border: OutlineInputBorder(borderRadius: BorderRadius.zero),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.zero,
      borderSide: BorderSide(color: borderLine),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.zero,
      borderSide: BorderSide(color: ink),
    ),
  ),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(
      backgroundColor: ink,
      foregroundColor: paper,
      elevation: 0,
      textStyle: const TextStyle(
        fontFamily: 'JetBrainsMono',
        fontSize: 13,
        fontWeight: FontWeight.w700,
      ),
      padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 18),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      foregroundColor: ink,
      backgroundColor: paper,
      textStyle: const TextStyle(fontFamily: 'JetBrainsMono', fontSize: 11),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 18),
      side: const BorderSide(color: borderLine),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
    ),
  ),
  textButtonTheme: TextButtonThemeData(
    style: TextButton.styleFrom(
      foregroundColor: blueprint,
      textStyle: const TextStyle(fontFamily: 'JetBrainsMono', fontSize: 11),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
    ),
  ),
  dataTableTheme: DataTableThemeData(
    headingRowColor: WidgetStateProperty.all(paper),
    headingTextStyle: const TextStyle(
      fontFamily: 'SpaceGrotesk',
      color: ink,
      fontSize: 12,
      fontWeight: FontWeight.w700,
    ),
    dataTextStyle: const TextStyle(
      fontFamily: 'SpaceGrotesk',
      color: ink,
      fontSize: 13,
    ),
    dividerThickness: 1,
    horizontalMargin: 16,
    columnSpacing: 32,
  ),
);

Duration motionDuration(BuildContext context, [int milliseconds = 450]) =>
    MediaQuery.disableAnimationsOf(context)
    ? Duration.zero
    : Duration(milliseconds: milliseconds);

class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.light = false});
  final bool light;
  @override
  Widget build(BuildContext context) => Text(
    '[+]',
    style: TextStyle(
      fontFamily: 'JetBrainsMono',
      fontSize: 25,
      fontWeight: FontWeight.w700,
      color: light ? paper : blueprint,
      letterSpacing: -2,
    ),
  );
}

class Entrance extends StatefulWidget {
  const Entrance({super.key, required this.child, this.delay = 0});
  final Widget child;
  final int delay;
  @override
  State<Entrance> createState() => _EntranceState();
}

class _EntranceState extends State<Entrance>
    with SingleTickerProviderStateMixin {
  late final AnimationController controller = AnimationController(vsync: this);
  late final animation = CurvedAnimation(
    parent: controller,
    curve: Interval(
      widget.delay / (480 + widget.delay),
      1,
      curve: Curves.easeOutCubic,
    ),
  );
  bool started = false;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      controller.value = 1;
    } else if (!started) {
      started = true;
      controller.duration = Duration(milliseconds: 480 + widget.delay);
      controller.forward();
    }
  }

  @override
  void dispose() {
    animation.dispose();
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      key: const ValueKey('dashboard-entrance-motion'),
      opacity: animation,
      child: SlideTransition(
        position: Tween(
          begin: const Offset(0, .035),
          end: Offset.zero,
        ).animate(animation),
        child: widget.child,
      ),
    );
  }
}

class DashboardSurface extends StatefulWidget {
  const DashboardSurface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(24),
    this.shadowColor = blueprint,
  });
  final Widget child;
  final EdgeInsets padding;
  final Color shadowColor;
  @override
  State<DashboardSurface> createState() => _DashboardSurfaceState();
}

class _DashboardSurfaceState extends State<DashboardSurface> {
  bool hovered = false;
  @override
  Widget build(BuildContext context) => MouseRegion(
    onEnter: (_) => setState(() => hovered = true),
    onExit: (_) => setState(() => hovered = false),
    child: AnimatedContainer(
      duration: motionDuration(context, 180),
      curve: Curves.easeOut,
      padding: widget.padding,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.zero,
        border: Border.all(color: hovered ? blueprint : ink, width: 1.5),
        boxShadow: [
          BoxShadow(
            color: widget.shadowColor,
            blurRadius: 0,
            offset: const Offset(3, 3),
          ),
        ],
      ),
      child: widget.child,
    ),
  );
}

class MetricCard extends StatelessWidget {
  const MetricCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    required this.detail,
    required this.explanation,
    this.decimals = 0,
    this.textValue,
  });
  final String label, detail;
  final MetricHelp explanation;
  final num value;
  final IconData icon;
  final Color color;
  final int decimals;
  final String? textValue;
  @override
  Widget build(BuildContext context) => DashboardSurface(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: const TextStyle(color: mutedInk, fontSize: 13),
              ),
            ),
            const SizedBox(width: 8),
            Semantics(
              label: 'About $label',
              hint: explanation.summary,
              button: true,
              child: Tooltip(
                message: '${explanation.summary}\nClick or tap for details.',
                excludeFromSemantics: true,
                child: IconButton(
                  key: ValueKey('metric-info-$label'),
                  color: blueprint,
                  onPressed: () =>
                      showMetricHelp(context, label, icon, explanation),
                  icon: const Icon(Icons.info_outline, size: 18),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Semantics(
          label: '$label: ${textValue ?? value.toStringAsFixed(decimals)}',
          excludeSemantics: true,
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: value.toDouble()),
            duration: motionDuration(context, 600),
            curve: Curves.easeOutCubic,
            builder: (context, number, _) => Text(
              textValue ?? number.toStringAsFixed(decimals),
              style: const TextStyle(
                fontSize: 27,
                fontWeight: FontWeight.w700,
                letterSpacing: -.6,
              ),
            ),
          ),
        ),
        const SizedBox(height: 14),
        Text('// $detail', style: monoStyle.copyWith(fontSize: 9)),
      ],
    ),
  );
}

class StatusPill extends StatelessWidget {
  const StatusPill(this.label, {super.key, this.color = blueprint, this.icon});
  final String label;
  final Color color;
  final IconData? icon;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .09),
      borderRadius: BorderRadius.zero,
      border: Border.all(color: color.withValues(alpha: .45)),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (icon != null) ...[
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 5),
        ],
        Text(
          label,
          style: TextStyle(
            color: color,
            fontFamily: 'JetBrainsMono',
            fontSize: 10,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    ),
  );
}

class EmptyChart extends StatelessWidget {
  const EmptyChart({super.key});
  @override
  Widget build(BuildContext context) => const SizedBox(
    height: 200,
    child: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.insert_chart_outlined_rounded, size: 38, color: mutedInk),
          SizedBox(height: 14),
          Text(
            'No diagrams match these filters.',
            style: TextStyle(color: mutedInk),
          ),
        ],
      ),
    ),
  );
}

Future<void> showMetricHelp(
  BuildContext context,
  String label,
  IconData icon,
  MetricHelp help,
) => showDialog<void>(
  context: context,
  builder: (context) => Dialog(
    key: const ValueKey('metric-help-dialog'),
    backgroundColor: Colors.transparent,
    elevation: 0,
    insetPadding: const EdgeInsets.all(24),
    child: ConstrainedBox(
      constraints: BoxConstraints(
        maxWidth: 520,
        maxHeight: MediaQuery.sizeOf(context).height * .85,
      ),
      child: DashboardSurface(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(icon, size: 20, color: blueprint),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    label,
                    style: const TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                IconButton(
                  autofocus: true,
                  tooltip: 'Close metric information',
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close, size: 20),
                ),
              ],
            ),
            const Divider(color: borderLine),
            const SizedBox(height: 12),
            Flexible(
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      help.summary,
                      style: const TextStyle(fontSize: 14, height: 1.5),
                    ),
                    const SizedBox(height: 22),
                    Text(
                      '// calculation',
                      style: monoStyle.copyWith(color: blueprint),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      help.calculation,
                      style: const TextStyle(fontSize: 13, height: 1.5),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      help.current,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 22),
                    Text(
                      '// reading this value',
                      style: monoStyle.copyWith(color: blueprint),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      help.note,
                      style: const TextStyle(fontSize: 13, height: 1.5),
                    ),
                    const SizedBox(height: 20),
                    const Divider(color: borderLine),
                    const SizedBox(height: 10),
                    const Text(
                      'Creation date (UTC), project, diagram type, and search affect this value. Time grouping changes chart buckets only. Table sorting and pagination do not change the KPI. These cards describe your full filtered dataset, rather than the advanced section’s 28-day analysis window.',
                      style: TextStyle(
                        fontSize: 12,
                        color: mutedInk,
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  ),
);

// Source: analytics_client.dart

Future<Map<String, dynamic>> loadDiagramAnalytics(
  SupabaseClient client,
  Map<String, dynamic> filters,
) async {
  try {
    return Map<String, dynamic>.from(
      await client.rpc('get_diagram_analytics_v2', params: filters) as Map,
    );
  } on PostgrestException catch (error) {
    if (error.code != 'PGRST202' && error.code != '42883') rethrow;
    // Keep the original outputs usable until the additive migration is applied.
    return Map<String, dynamic>.from(
      await client.rpc('get_diagram_analytics', params: filters) as Map,
    );
  }
}

// Source: metric_help.dart
class MetricHelp {
  const MetricHelp({
    required this.summary,
    required this.calculation,
    required this.current,
    required this.note,
  });
  final String summary, calculation, current, note;
}

// Source: trend_comparison.dart
class TrendSummary {
  const TrendSummary(this.starting, this.current, this.bucketCount);

  final double starting;
  final double current;
  final int bucketCount;

  bool get hasTrend => bucketCount >= 2;
  double? get percentageChange =>
      hasTrend && starting != 0 ? (current - starting) / starting * 100 : null;
  String get trend => !hasTrend
      ? 'N/A'
      : current > starting
      ? 'Up'
      : current < starting
      ? 'Down'
      : 'Stable';

  static TrendSummary fromSeries(List<Map<String, dynamic>> series) =>
      series.isEmpty
      ? const TrendSummary(0, 0, 0)
      : TrendSummary(
          (series.first['count'] as num).toDouble(),
          (series.last['count'] as num).toDouble(),
          series.length,
        );
}

class GroupComparison {
  const GroupComparison(
    this.firstName,
    this.firstValue,
    this.secondName,
    this.secondValue,
  );

  final String firstName;
  final double firstValue;
  final String secondName;
  final double secondValue;

  double get difference => (firstValue - secondValue).abs();
  String get higherValue => firstValue > secondValue
      ? firstName
      : secondValue > firstValue
      ? secondName
      : 'Equal';

  static GroupComparison? fromProjects(List<Map<String, dynamic>> projects) {
    if (projects.length < 2) return null;
    final ranked = [...projects]
      ..sort((a, b) {
        final byCount = (b['count'] as num).compareTo(a['count'] as num);
        return byCount != 0
            ? byCount
            : (a['label'] as String).compareTo(b['label'] as String);
      });
    return GroupComparison(
      ranked[0]['label'] as String,
      (ranked[0]['count'] as num).toDouble(),
      ranked[1]['label'] as String,
      (ranked[1]['count'] as num).toDouble(),
    );
  }
}

