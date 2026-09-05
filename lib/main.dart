import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'supabase_config.dart';
import 'theme.dart';
import 'screens/auth/auth_gate.dart';
import 'screens/root_nav.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Connect to Supabase only when real credentials are present, so the app
  // still runs on sample data before the backend is wired up.
  if (SupabaseConfig.isConfigured) {
    await Supabase.initialize(
      url: SupabaseConfig.supabaseUrl,
      publishableKey: SupabaseConfig.supabasePublishableKey,
    );
  }

  runApp(const EmeraldSummitApp());
}

/// Root application widget for the Emerald Summit companion app.
class EmeraldSummitApp extends StatelessWidget {
  const EmeraldSummitApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Emerald Summit',
      debugShowCheckedModeBanner: false,
      theme: EmeraldTheme.light(),
      darkTheme: EmeraldTheme.dark(),
      themeMode: ThemeMode.light,
      builder: (context, child) {
        final mq = MediaQuery.of(context);
        return MediaQuery(
          data: mq.copyWith(
            // iOS honors the system-wide "Bold Text" accessibility toggle
            // (Settings → Display & Brightness). When it's on, Flutter renders
            // every label heavy — which is why the iPhone 14 test build looked
            // bold while Android, which has no equivalent global setting, did
            // not. Reset it so text renders at the weights the design intends.
            boldText: false,
            // iOS Dynamic Type can scale text well beyond the layout's
            // headroom, pushing labels onto a second line ("Resourc es") or
            // off-screen. Clamp the scale factor so accessibility text sizing
            // still works, but can't break the layout.
            textScaler: mq.textScaler.clamp(
              minScaleFactor: 1.0,
              maxScaleFactor: 1.3,
            ),
          ),
          child: child!,
        );
      },
      // When the backend is configured, gate the app behind sign-in. In sample
      // mode (no backend) go straight to the app on demo data.
      home: SupabaseConfig.isConfigured ? const AuthGate() : const RootNav(),
    );
  }
}
