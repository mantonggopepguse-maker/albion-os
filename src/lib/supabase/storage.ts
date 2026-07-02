'use client';

import { createClient } from '@/lib/supabase/client';

export async function uploadFile(
  bucket: string,
  file: File,
  path?: string,
): Promise<{ url: string; error: string | null }> {
  const supabase = createClient();
  const filePath = path || `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) return { url: '', error: error.message };

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return { url: urlData.publicUrl, error: null };
}
