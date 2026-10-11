import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:diagrid_analytics/analytics_page.dart';
import 'package:diagrid_analytics/dashboard_ui.dart';
import 'package:diagrid_analytics/main.dart';
import 'package:diagrid_analytics/analytics_insights.dart';

Map<String, dynamic> emptyData() => {
  'total_diagrams': 0,
  'project_count': 0,
  'average_per_project': 0,
  'most_used_type': null,
  'most_used_count': 0,
  'types': [],
  'projects': [],
  'series': [],
  'records': [],
  'project_options': [],
  'type_options': [],
};
void main() {
  testWidgets(
    'KPI information opens on tap and explains live values and empty averages',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final fixture = {
        ...emptyData(),
        'total_diagrams': 51,
        'project_count': 9,
        'average_per_project': 5.67,
        'most_used_type': 'erd',
        'most_used_count': 21,
      };
      await tester.pumpWidget(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: dashboardTheme(),
          home: AnalyticsPage(load: (_) async => fixture, signOut: () async {}),
        ),
      );
      await tester.pumpAndSettle();
      for (final label in [
        'Total diagrams',
        'Projects with diagrams',
        'Average diagrams per project',
        'Most-used diagram type',
      ]) {
        final info = find.byKey(ValueKey('metric-info-$label'));
        await tester.ensureVisible(info);
        await tester.tap(info);
        await tester.pumpAndSettle();
        expect(
          find.byKey(const ValueKey('metric-help-dialog')),
          findsOneWidget,
        );
        expect(find.text('// calculation'), findsOneWidget);
        if (label == 'Average diagrams per project') {
          expect(
            find.text('51 ÷ 9 = 5.67 diagrams per project.'),
            findsOneWidget,
          );
        }
        if (label == 'Most-used diagram type') {
          expect(find.text('ERD: 21 of 51 diagrams (41.2%).'), findsOneWidget);
        }
        await tester.tap(find.byTooltip('Close metric information'));
        await tester.pumpAndSettle();
        expect(find.byKey(const ValueKey('metric-help-dialog')), findsNothing);
        expect(tester.takeException(), isNull);
      }
      await tester.pumpWidget(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: dashboardTheme(),
          home: AnalyticsPage(
            key: const ValueKey('empty-help'),
            load: (_) async => emptyData(),
            signOut: () async {},
          ),
        ),
      );
      await tester.pumpAndSettle();
      final average = find.byKey(
        const ValueKey('metric-info-Average diagrams per project'),
      );
      await tester.ensureVisible(average);
      await tester.tap(average);
      await tester.pumpAndSettle();
      expect(
        find.text('No matching projects: the average is 0.00.'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'advanced analytics labels estimates and supports an evidence-based project review',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(1300, 2000));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      String? focused;
      final data = {
        'window_start': '2026-09-10',
        'window_end': '2026-10-07',
        'complete_history': true,
        'diagnostic': {
          'recent_count': 14,
          'previous_count': 6,
          'delta': 8,
          'change_pct': 133.33,
          'project_changes': [
            {
              'id': 'p1',
              'label': 'Research',
              'recent': 12,
              'previous': 4,
              'delta': 8,
            },
          ],
          'type_changes': [
            {
              'id': 'erd',
              'label': 'erd',
              'recent': 12,
              'previous': 4,
              'delta': 8,
            },
          ],
        },
        'forecast': {
          'status': 'available',
          'estimate': 5,
          'start': '2026-10-08',
          'end': '2026-10-14',
          'historical_projection': false,
          'observed_weekly_min': 2,
          'observed_weekly_max': 8,
          'backtest_estimate': 4,
          'backtest_actual': 8,
          'backtest_absolute_error': 4,
        },
        'recommendations': [
          {
            'id': 'concentration',
            'title': 'Review the dominant project',
            'detail': 'Check documentation coverage.',
            'evidence':
                'Research accounts for 80% of creations (review threshold: 60%).',
            'project_id': 'p1',
          },
        ],
      };
      await tester.pumpWidget(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: dashboardTheme(),
          home: Scaffold(
            body: SingleChildScrollView(
              child: AnalyticsInsights(
                data: data,
                focusProject: (id) => focused = id,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('6 → 14'), findsOneWidget);
      expect(find.text('≈ 5.00 diagrams'), findsOneWidget);
      expect(find.textContaining('absolute error 4 diagrams'), findsOneWidget);
      expect(find.textContaining('not a confidence interval'), findsOneWidget);
      await tester.tap(find.text('Focus on this project'));
      expect(focused, 'p1');
      await tester.binding.setSurfaceSize(const Size(390, 844));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      data['complete_history'] = false;
      data['forecast'] = {
        'status': 'insufficient_data',
        'reason': 'At least 10 matching creations are needed.',
      };
      data['recommendations'] = [];
      await tester.pumpWidget(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: dashboardTheme(),
          home: Scaffold(
            body: SingleChildScrollView(
              child: AnalyticsInsights(
                key: const ValueKey('insufficient'),
                data: data,
                focusProject: (_) {},
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('≈ 5.00 diagrams'), findsNothing);
      expect(
        find.text('At least 10 matching creations are needed.'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );
  setUpAll(() async {
    final loader = FontLoader('DashboardRoboto');
    for (final name in ['regular', 'medium', 'bold']) {
      loader.addFont(rootBundle.load('assets/fonts/roboto-$name.ttf'));
    }
    await loader.load();
    for (final family in ['SpaceGrotesk', 'JetBrainsMono']) {
      final brandFont = FontLoader(family)
        ..addFont(rootBundle.load('assets/fonts/$family.ttf'));
      await brandFont.load();
    }
    final icons = FontLoader('MaterialIcons')
      ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
    await icons.load();
  });
  testWidgets(
    'dashboard motion finishes and reduced motion shows final values immediately',
    (tester) async {
      final fixture = {...emptyData(), 'total_diagrams': 12};
      await tester.pumpWidget(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: dashboardTheme(),
          home: AnalyticsPage(load: (_) async => fixture, signOut: () async {}),
        ),
      );
      await tester.pump();
      expect(
        tester
            .widgetList<FadeTransition>(find.byType(FadeTransition))
            .any((w) => w.opacity.value < 1),
        isTrue,
      );
      await tester.pumpAndSettle();
      expect(find.text('12'), findsOneWidget);
      await tester.pumpWidget(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: dashboardTheme(),
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(disableAnimations: true),
            child: child!,
          ),
          home: AnalyticsPage(
            key: const ValueKey('reduced'),
            load: (_) async => fixture,
            signOut: () async {},
          ),
        ),
      );
      await tester.pump();
      expect(find.text('12'), findsOneWidget);
      final entranceFades = find.byKey(
        const ValueKey('dashboard-entrance-motion'),
      );
      expect(
        tester
            .widgetList<FadeTransition>(entranceFades)
            .every((w) => w.opacity.value == 1),
        isTrue,
      );
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'capture populated dashboard and sign-in at desktop and mobile sizes',
    (tester) async {
      final boundaryKey = GlobalKey();
      final fixture = {
        ...emptyData(),
        'total_diagrams': 12,
        'project_count': 3,
        'average_per_project': 4,
        'most_used_type': 'erd',
        'most_used_count': 6,
        'types': [
          {'label': 'erd', 'count': 6},
          {'label': 'flowchart', 'count': 4},
          {'label': 'dfd', 'count': 2},
        ],
        'projects': [
          {'id': 'p1', 'label': 'Inventory system', 'count': 6},
          {'id': 'p2', 'label': 'Student portal', 'count': 4},
          {'id': 'p3', 'label': 'API architecture', 'count': 2},
        ],
        'project_options': [
          {'id': 'p1', 'name': 'Inventory system'},
        ],
        'type_options': ['erd', 'flowchart', 'dfd'],
        'series': List.generate(
          7,
          (i) => {
            'date': '2026-${(i + 4).toString().padLeft(2, '0')}-01',
            'count': [1, 3, 0, 2, 4, 1, 1][i],
          },
        ),
        'records': List.generate(
          12,
          (i) => {
            'id': '$i',
            'title': 'Diagram ${i + 1}',
            'project_name': i < 6
                ? 'Inventory system'
                : i < 10
                ? 'Student portal'
                : 'API architecture',
            'type': i < 6
                ? 'erd'
                : i < 10
                ? 'flowchart'
                : 'dfd',
            'created_at':
                '2026-${[4, 5, 5, 5, 7, 7, 8, 8, 8, 8, 9, 10][i].toString().padLeft(2, '0')}-01T12:00:00Z',
            'updated_at': '2026-10-02T12:00:00Z',
          },
        ),
      };
      Future<void> capture(String name, {bool submission = false}) async {
        await tester.pumpAndSettle();
        await tester.runAsync(() async {
          final boundary =
              boundaryKey.currentContext!.findRenderObject()!
                  as RenderRepaintBoundary;
          final image = await boundary.toImage(pixelRatio: 1);
          final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
          final file = File(
            submission ? 'submission/$name.png' : '../test-results/$name.png',
          );
          await file.parent.create(recursive: true);
          await file.writeAsBytes(bytes!.buffer.asUint8List());
          image.dispose();
        });
      }

      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.binding.setSurfaceSize(const Size(1440, 1200));
      await tester.pumpWidget(
        RepaintBoundary(
          key: boundaryKey,
          child: MaterialApp(
            debugShowCheckedModeBanner: false,
            theme: dashboardTheme(),
            home: AnalyticsPage(
              load: (_) async => fixture,
              signOut: () async {},
            ),
          ),
        ),
      );
      await tester.binding.setSurfaceSize(const Size(1440, 3400));
      await capture('dashboard-complete', submission: true);
      await tester.binding.setSurfaceSize(const Size(1440, 800));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Trend KPI Cards'));
      await capture('trend-kpi-cards', submission: true);
      await tester.binding.setSurfaceSize(const Size(1440, 1200));
      await tester.pumpAndSettle();
      await capture('flutter-dashboard-desktop');
      await tester.ensureVisible(find.text('Diagram types'));
      await capture('flutter-dashboard-charts');
      await tester.binding.setSurfaceSize(const Size(1440, 650));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Diagrams created over time'));
      await tester.drag(
        find.byType(SingleChildScrollView).first,
        const Offset(0, 56),
      );
      await tester.pumpAndSettle();
      await capture('line-chart', submission: true);
      await tester.binding.setSurfaceSize(const Size(1440, 540));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Group Comparison'));
      await tester.drag(
        find.byType(SingleChildScrollView).first,
        const Offset(0, 56),
      );
      await tester.pumpAndSettle();
      await capture('group-comparison', submission: true);
      await tester.binding.setSurfaceSize(const Size(1440, 1200));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Diagram Records'));
      await capture('flutter-dashboard-records');
      await tester.binding.setSurfaceSize(const Size(390, 844));
      await tester.pumpWidget(
        RepaintBoundary(
          key: boundaryKey,
          child: MaterialApp(
            debugShowCheckedModeBanner: false,
            theme: dashboardTheme(),
            home: AnalyticsPage(
              key: const ValueKey('mobile'),
              load: (_) async => fixture,
              signOut: () async {},
            ),
          ),
        ),
      );
      await capture('flutter-dashboard-mobile');
      await tester.ensureVisible(find.text('Diagram types'));
      await capture('flutter-dashboard-mobile-chart');
      await tester.pumpWidget(
        RepaintBoundary(
          key: boundaryKey,
          child: MaterialApp(theme: dashboardTheme(), home: const SignInPage()),
        ),
      );
      await capture('flutter-login-mobile');
      await tester.binding.setSurfaceSize(const Size(1440, 1000));
      await capture('flutter-login-desktop');
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('empty analytics shows zero values and three graph sections', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1440, 2400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        home: AnalyticsPage(
          signOut: () async {},
          load: (_) async => emptyData(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('No data'), findsWidgets);
    expect(
      find.text('At least two projects with matching diagrams are needed.'),
      findsOneWidget,
    );
    expect(find.text('Diagram types'), findsOneWidget);
    expect(find.text('Diagrams created over time'), findsOneWidget);
    expect(find.text('Diagrams by project'), findsOneWidget);
    expect(find.text('0 matching records'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('database failure hides analytics and retry recovers', (
    tester,
  ) async {
    var fail = true;
    await tester.pumpWidget(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        home: AnalyticsPage(
          signOut: () async {},
          load: (_) async {
            if (fail) throw Exception('Database offline');
            return emptyData();
          },
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('Database offline'), findsOneWidget);
    expect(find.text('Total diagrams'), findsNothing);
    fail = false;
    await tester.ensureVisible(find.text('Try again'));
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();
    expect(find.text('Total diagrams'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets(
    'populated mobile layout filters the shared dataset and paginates records',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      Map<String, dynamic>? received;
      await tester.pumpWidget(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          home: AnalyticsPage(
            signOut: () async {},
            load: (filters) async {
              received = filters;
              final count = filters['search_text'] == 'Only one' ? 1 : 12;
              return {
                ...emptyData(),
                'total_diagrams': count,
                'project_count': 1,
                'average_per_project': count,
                'most_used_type': 'erd',
                'most_used_count': count,
                'types': [
                  {'label': 'erd', 'count': count},
                ],
                'projects': [
                  {'id': 'p1', 'label': 'Research', 'count': count},
                ],
                'series': [
                  {'date': '2026-10-01', 'count': count},
                ],
                'project_options': [
                  {'id': 'p1', 'name': 'Research'},
                ],
                'type_options': ['erd'],
                'records': List.generate(
                  count,
                  (i) => {
                    'id': '$i',
                    'title': 'Diagram $i',
                    'project_name': 'Research',
                    'type': 'erd',
                    'created_at': '2026-10-01T12:00:00Z',
                    'updated_at': '2026-10-02T12:00:00Z',
                  },
                ),
              };
            },
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.ensureVisible(find.text('Next'));
      await tester.tap(find.text('Next'));
      await tester.pumpAndSettle();
      expect(find.text('Page 2 of 2'), findsOneWidget);
      final search = find.byType(TextField);
      await tester.ensureVisible(search);
      await tester.enterText(search, 'Only one');
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pumpAndSettle();
      expect(received!['search_text'], 'Only one');
      expect(find.text('ERD (1)'), findsOneWidget);
      await tester.ensureVisible(find.text('Diagram Records'));
      expect(find.text('1 matching records'), findsOneWidget);
      expect(find.text('Page 1 of 1'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
