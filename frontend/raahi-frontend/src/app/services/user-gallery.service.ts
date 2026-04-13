import { Injectable } from '@angular/core';
import { supabase } from './supabaseClient';

@Injectable({
  providedIn: 'root',
})
export class UserGalleryService {

  // 📌 Upload Photo + Metadata
  async uploadPhoto(file: File, caption: string = '', hashtags: string[] = []) {
    const {
      data: { user },
      error: userErr
    } = await supabase.auth.getUser();

    if (userErr || !user) throw new Error('Not logged in');

    const userId = user.id;

    // Generate unique file name
    const fileName = `${crypto.randomUUID()}.jpg`;
    const filePath = `${userId}/${fileName}`;

    // 1️⃣ Upload to Storage
    const { error: uploadErr } = await supabase.storage
      .from('user_photos')
      .upload(filePath, file, {
        upsert: false,
        contentType: file.type,
      });

    if (uploadErr) throw uploadErr;

    // 2️⃣ Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('user_photos')
      .getPublicUrl(filePath);

    const photo_url = publicUrlData.publicUrl;

    // 3️⃣ Insert metadata into DB
    const { data, error: insertErr } = await supabase
      .from('user_gallery')
      .insert({
        user_id: userId,
        photo_url,
        path: filePath,
        caption,
        hashtags,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return data;
  }

  // 📌 Get logged-in user’s gallery
  async getMyPhotos() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return [];

    const { data } = await supabase
      .from('user_gallery')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    return data || [];
  }

  // ❌ Delete photo (storage + db)
  async deletePhoto(photoId: string, storagePath: string) {
    // Delete from storage
    await supabase.storage.from('user_photos').remove([storagePath]);

    // Delete row from DB
    await supabase
      .from('user_gallery')
      .delete()
      .eq('id', photoId);
  }
}
