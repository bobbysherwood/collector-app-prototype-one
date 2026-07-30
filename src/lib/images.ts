export function getImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/card-images/${imagePath}`;
}

export function getDm2CardImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/dm2-card-images/${imagePath}`;
}
