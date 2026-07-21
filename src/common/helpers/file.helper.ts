const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

export function validateFile(mimetype: string, size: number) {
  if (!ALLOWED_TYPES.includes(mimetype)) {
    return { valid: false, error: 'Only JPEG, PNG, and WebP files are allowed' };
  }
  if (size > MAX_SIZE) {
    return { valid: false, error: 'File size must be less than 5MB' };
  }
  return { valid: true };
}
