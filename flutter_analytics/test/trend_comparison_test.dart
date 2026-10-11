import 'package:flutter_test/flutter_test.dart';
import 'package:diagrid_analytics/trend_comparison.dart';

void main() {
  test('comparison reports absolute difference and higher group', () {
    const a = GroupComparison('Section A', 88, 'Section B', 84);
    const b = GroupComparison('Section A', 84, 'Section B', 88);
    const tie = GroupComparison('Section A', 88, 'Section B', 88);
    expect(a.difference.toStringAsFixed(2), '4.00');
    expect(a.higherValue, 'Section A');
    expect(b.higherValue, 'Section B');
    expect(tie.higherValue, 'Equal');
  });

  test('comparison picks the two largest filtered project groups', () {
    final result = GroupComparison.fromProjects([
      {'label': 'Third', 'count': 2},
      {'label': 'Second', 'count': 8},
      {'label': 'First', 'count': 12},
    ]);
    expect(result!.firstName, 'First');
    expect(result.secondName, 'Second');
    expect(result.difference, 4);
    expect(GroupComparison.fromProjects([]), isNull);
  });

  test('trend handles growth, zero baseline and missing buckets', () {
    final growth = TrendSummary.fromSeries([
      {'count': 4},
      {'count': 6},
    ]);
    expect(growth.percentageChange, 50);
    expect(growth.trend, 'Up');
    final zero = TrendSummary.fromSeries([
      {'count': 0},
      {'count': 6},
    ]);
    expect(zero.percentageChange, isNull);
    expect(zero.trend, 'Up');
    expect(TrendSummary.fromSeries([]).trend, 'N/A');
  });
}
