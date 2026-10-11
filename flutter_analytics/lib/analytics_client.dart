import 'package:supabase_flutter/supabase_flutter.dart';

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
