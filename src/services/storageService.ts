import { supabase, isSupabaseConfigured } from './supabase';
import { authService } from './authService';

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'];

export const storageService = {
  /**
   * Uploads an avatar image to Supabase Storage ('avatars' bucket)
   * and links it to the active user's profile.
   */
  uploadAvatar: async (file: File): Promise<{ url: string | null; error: string | null }> => {
    if (!isSupabaseConfigured()) {
      return { url: null, error: 'Supabase cloud is not configured.' };
    }

    const user = authService.getUserSync();
    if (!user) {
      return { url: null, error: 'User is not authenticated.' };
    }

    // Validate size
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      return { url: null, error: 'Image size exceeds the 2MB limit. Please choose a smaller file.' };
    }

    // Validate mime type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return { url: null, error: 'Invalid file type. Supported formats: JPEG, PNG, WebP, SVG, GIF.' };
    }

    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      // Upload to 'avatars' bucket with upsert
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError || !uploadData) {
        return { url: null, error: uploadError?.message || 'Failed to upload image.' };
      }

      // Retrieve public URL
      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      // Update user profile in public.profiles
      const updateResult = await authService.updateProfile({
        avatar: publicUrl,
        avatarType: 'custom'
      });

      if (updateResult.error) {
        return { url: publicUrl, error: updateResult.error || 'Avatar uploaded, but profile link failed.' };
      }

      return { url: publicUrl, error: null };
    } catch (err: any) {
      return { url: null, error: err?.message || 'An unexpected error occurred during upload.' };
    }
  },

  /**
   * Removes custom avatar, falling back to preset icon.
   */
  removeAvatar: async (): Promise<{ success: boolean; error: string | null }> => {
    try {
      const updateResult = await authService.updateProfile({
        avatar: undefined,
        avatarType: 'preset'
      });

      return { success: !updateResult.error, error: updateResult.error || null };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to remove avatar.' };
    }
  }
};
