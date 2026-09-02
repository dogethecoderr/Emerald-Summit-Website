import 'package:flutter_test/flutter_test.dart';

import 'package:emerald_summit/main.dart';

void main() {
  testWidgets('Starts on My Day with an empty plan',
      (WidgetTester tester) async {
    await tester.pumpWidget(const EmeraldSummitApp());

    expect(find.text('Your day is a blank slate'), findsOneWidget);
    expect(find.text('Browse sessions'), findsOneWidget);
  });

  testWidgets('Discover tab shows the six disciplines',
      (WidgetTester tester) async {
    await tester.pumpWidget(const EmeraldSummitApp());

    await tester.tap(find.text('Discover'));
    await tester.pumpAndSettle();

    expect(find.text('TechVerse'), findsOneWidget);
    expect(find.text('RoboSphere'), findsOneWidget);
    expect(find.text('MathVerse'), findsOneWidget);
  });
}
