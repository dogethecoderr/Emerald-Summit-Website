import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../app_state.dart';
import '../root_nav.dart';
import 'onboarding_screen.dart';
import 'sign_in_screen.dart';

/// Decides what the user sees based on auth + profile state:
///
///   no session          → [SignInScreen]
///   session, no profile → [OnboardingScreen]
///   session, onboarded  → the app ([RootNav])
///
/// Rebuilds automatically whenever the Supabase auth state changes (sign-in,
/// sign-out, token refresh). Only used when Supabase is configured; in sample
/// mode `main` shows [RootNav] directly.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<AuthState>(
      stream: Supabase.instance.client.auth.onAuthStateChange,
      builder: (context, _) {
        final session = Supabase.instance.client.auth.currentSession;
        if (session == null) return const SignInScreen();
        return const _ProfileLoader();
      },
    );
  }
}

/// Loads the signed-in user's profile, then routes to onboarding or the app.
class _ProfileLoader extends StatefulWidget {
  const _ProfileLoader();

  @override
  State<_ProfileLoader> createState() => _ProfileLoaderState();
}

class _ProfileLoaderState extends State<_ProfileLoader> {
  @override
  void initState() {
    super.initState();
    // Load once for this session; the gate remounts this widget on sign-in.
    WidgetsBinding.instance.addPostFrameCallback((_) => appState.loadProfile());
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: appState,
      builder: (context, _) {
        if (appState.profileLoading && appState.profile == null) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        if (!appState.isOnboarded) {
          return const OnboardingScreen();
        }
        return const RootNav();
      },
    );
  }
}
