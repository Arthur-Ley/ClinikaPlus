import { supabase } from "../lib/supabase.js";

export async function listBuckets() {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    throw error;
  }
  return data;
}

export async function createSignedUploadUrl({ bucket, path }) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path);

  if (error) {
    throw error;
  }

  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
  return {
    ...data,
    publicUrl: publicData?.publicUrl || null,
  };
}
