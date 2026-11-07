
import { randomUUID } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_PHOTO_SIZE,
} from "../../const/constant.js";
import { supabase } from "../../config/supabase.js";
import { config } from "../../config/index.js";``

export async function uploadPaymentProof(
  phone: string,
  buffer: Buffer,
) {
  // 1. Validate file size
  if (buffer.length === 0) {
    throw new Error("EMPTY_PAYMENT_PROOF");
  }

  if (buffer.length > MAX_PHOTO_SIZE) {
    throw new Error("PAYMENT_PROOF_TOO_LARGE");
  }

  // 2. Detect the actual image format
  const detectedType = await fileTypeFromBuffer(buffer);

  if (
    !detectedType ||
    !(detectedType.mime in ALLOWED_IMAGE_TYPES)
  ) {
    throw new Error("INVALID_PAYMENT_PROOF_TYPE");
  }

  const mimeType =
    detectedType.mime as keyof typeof ALLOWED_IMAGE_TYPES;

  const extension = ALLOWED_IMAGE_TYPES[mimeType];

  // 3. Generate a unique path for this player's proof
  const proofPath =
    `payments/${phone}/${randomUUID()}.${extension}`;

  // 4. Upload to the private bucket
  const { error } = await supabase.storage
    .from(config.supabasePaymentStorageBucket)
    .upload(proofPath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error("PAYMENT_PROOF_UPLOAD_FAILED");
  }

  // Return only the storage path. Never generate a public URL.
  return { proofPath };
}

// Delete a proof if the corresponding database update fails
export async function deletePaymentProof(proofPath: string) {
  const { error } = await supabase.storage
    .from(config.supabasePaymentStorageBucket)
    .remove([proofPath]);

  if (error) {
    throw new Error("PAYMENT_PROOF_DELETE_FAILED");
  }
}
