import { supabase, isSupabaseConfigured } from './supabase';
import { mockDb, type Template, TEMPLATES } from './mockDb';

export interface DbTemplate {
  id: string;
  title: string;
  description?: string;
  type: Template['type'];
  content: any;
  is_featured?: boolean;
  is_system?: boolean;
  created_at?: string;
  updated_at?: string;
}

export const templateService = {
  /**
   * Fetches all templates hybridly (Supabase DB + Built-in Presets fallback).
   */
  getTemplates: async (): Promise<Template[]> => {
    if (!isSupabaseConfigured()) {
      return mockDb.getTemplates();
    }

    try {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: true });

      if (error || !data || data.length === 0) {
        return mockDb.getTemplates();
      }

      // Convert DB templates into Template objects
      const dbTemplates: Template[] = data.map((t: DbTemplate) => ({
        id: t.id,
        title: t.title,
        type: t.type,
        content: typeof t.content === 'string' ? t.content : JSON.stringify(t.content)
      }));

      // Merge with any built-in templates not yet in the DB
      const existingIds = new Set(dbTemplates.map(t => t.id));
      const builtInMissing = TEMPLATES.filter(t => !existingIds.has(t.id));

      return [...dbTemplates, ...builtInMissing];
    } catch (err) {
      console.warn('[templateService] Error fetching templates from Supabase, using local fallback:', err);
      return mockDb.getTemplates();
    }
  },

  /**
   * Fetches a specific template by ID.
   */
  getTemplate: async (id: string): Promise<Template | undefined> => {
    const all = await templateService.getTemplates();
    return all.find(t => t.id === id);
  },

  /**
   * Fetches templates matching a given diagram type.
   */
  getTemplatesByType: async (type: Template['type']): Promise<Template[]> => {
    const all = await templateService.getTemplates();
    return all.filter(t => t.type === type);
  }
};
