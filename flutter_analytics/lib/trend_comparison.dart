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
