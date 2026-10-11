import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'analytics_page.dart';
import 'dashboard_ui.dart';
import 'analytics_client.dart';

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
