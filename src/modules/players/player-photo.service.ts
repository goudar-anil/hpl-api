
import { randomUUID } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import { ALLOWED_IMAGE_TYPES, MAX_PHOTO_SIZE } from "../../const/constant.js";
import { supabase } from "../../config/supabase.js";
import { config } from "../../config/index.js";

export function getPlayerPhotoUrl(photoPath: string) {
  const { data } = supabase.storage
    .from(config.supabaseStorageBucket)
    .getPublicUrl(photoPath);

  return data.publicUrl;
}

export async function uploadPlayerPhoto(buffer: Buffer) {
  if (buffer.length === 0) {
    throw new Error("EMPTY_PHOTO");
  }

  if (buffer.length > MAX_PHOTO_SIZE) {
    throw new Error("PHOTO_TOO_LARGE");
  }

  const detectedType = await fileTypeFromBuffer(buffer);

  if (
    !detectedType ||
    !(detectedType.mime in ALLOWED_IMAGE_TYPES)
  ) {
    throw new Error("INVALID_PHOTO_TYPE");
  }

  const mimeType = detectedType.mime as keyof typeof ALLOWED_IMAGE_TYPES;
  const extension = ALLOWED_IMAGE_TYPES[mimeType];

  const photoPath = `players/${randomUUID()}.${extension}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(config.supabaseStorageBucket)
    .upload(photoPath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error("Supabase photo upload failed:", uploadError);
    throw new Error("PHOTO_UPLOAD_FAILED");
  }

  const actualPhotoPath = uploadData.path;

  const { data: publicUrlData } = supabase.storage
    .from(config.supabaseStorageBucket)
    .getPublicUrl(actualPhotoPath);

  return {
    photoPath: actualPhotoPath,
    photoUrl: publicUrlData.publicUrl,
  };
}

export async function deletePlayerPhoto(photoPath: string) {
  const { error } = await supabase.storage
    .from(config.supabaseStorageBucket)
    .remove([photoPath]);

  if (error) {
    console.error("Supabase photo deletion failed:", error);
    throw new Error("PHOTO_DELETE_FAILED");
  }
}
