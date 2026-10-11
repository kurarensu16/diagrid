import 'package:flutter/material.dart';
import 'metric_help.dart';

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
