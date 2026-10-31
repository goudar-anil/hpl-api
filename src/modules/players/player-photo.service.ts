import { randomUUID } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import { ALLOWED_IMAGE_TYPES, MAX_PHOTO_SIZE } from "../../const/constant.js";
import { supabase } from "../../config/supabase.js";
import { config } from "../../config/index.js";

export async function uploadPlayerPhoto(buffer: Buffer) {
    // 1. check file size
    if (buffer.length === 0) {
        throw new Error("EMPTY_PHOTO");
    }
    if (buffer.length > MAX_PHOTO_SIZE) {
        throw new Error("PHOTO_TOO_LARGE");
    }

    // 2. Detect the actual image format using file contents
    const detectedType = await fileTypeFromBuffer(buffer);
    if (
    !detectedType ||
    !(detectedType.mime in ALLOWED_IMAGE_TYPES)
    ) {
        throw new Error("INVALID_PHOTO_TYPE");
    }

    const mimeType = detectedType.mime as keyof typeof ALLOWED_IMAGE_TYPES;
    const extension = ALLOWED_IMAGE_TYPES[mimeType];

    // 3. Generate a unique storage path
    const photoPath = `players/${randomUUID()}.${extension}`;

    // 4. Upload to Supabase Storage
    const { error } = await supabase.storage
        .from(config.supabaseStorageBucket)
        .upload(photoPath, buffer, {
        contentType: mimeType,
        upsert: false,
        });

    if (error) {
        throw new Error("PHOTO_UPLOAD_FAILED");
    }

    // 5. Generate public URL
    const { data } = supabase.storage
        .from(config.supabaseStorageBucket)
        .getPublicUrl(photoPath);

    return {
        photoPath,
        photoUrl: data.publicUrl,
    };
}

// Used to clean up a photo if player registration fails
export async function deletePlayerPhoto(photoPath: string) {
  const { error } = await supabase.storage
    .from(config.supabaseStorageBucket)
    .remove([photoPath]);

  if (error) {
    throw new Error("PHOTO_DELETE_FAILED");
  }
}
