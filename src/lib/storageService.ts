import { supabase } from '@/integrations/supabase/client';

const STORAGE_BUCKET = 'public-assets';

export interface UploadImageParams {
  file: File;
  folder: 'avatars' | 'events' | 'badges';
  userId: string;
}

/**
 * Uploads an image file to Supabase storage with automatic path generation
 * @param file - The image file to upload
 * @param folder - Storage folder ('avatars', 'events', or 'badges')
 * @param userId - User ID for unique file naming
 * @returns Object with public URL, file path, and error (if any)
 */
export async function uploadImage({ file, folder, userId }: UploadImageParams) {
  try {
    // Validate file type (strict: JPEG/PNG only)
    const allowedTypes = ['image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Only JPEG and PNG images are allowed');
    }

    // Validate file size (strict: max 2MB)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      throw new Error('File size must be less than 2MB');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}_${Date.now()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    return { url: urlData.publicUrl, path: filePath, error: null };
  } catch (error) {
    console.error('Error uploading image:', error);
    return { url: null, path: null, error: error as Error };
  }
}

/**
 * Compresses an image file to reduce size while maintaining quality
 * @param file - The image file to compress
 * @param maxWidth - Maximum width in pixels (default: 1200)
 * @param quality - JPEG quality from 0 to 1 (default: 0.8)
 * @returns Promise resolving to compressed File object
 */
export async function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Canvas to Blob conversion failed'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}
