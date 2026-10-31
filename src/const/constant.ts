export const VALIDATION_ERROR = 'VALIDATION ERROR';
export const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export const MAX_PHOTO_SIZE = 5 * 1024 * 1024;