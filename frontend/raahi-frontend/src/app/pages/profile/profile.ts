import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { supabase } from '../../services/supabaseClient';
import { Sidebar } from '../../components/sidebar/sidebar';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, Sidebar],
  templateUrl: './profile.html',
  styleUrls: ['./profile.css'],
})
export class Profile {
  loading = true;
  user: any = null;
  profile: any = null;
  preferences: any = null;
  savedTripsCount = 0;

  gallery: any[] = [];
  galleryLoading = false;

  selectedPhotoFile: File | null = null;
  uploadingPhoto = false;
  captionInput = '';
  hashtagsInput = '';

  avatarUploading = false;

  showPhotoModal = false;
  selectedPhoto: any = null;
  editCaption = '';
  editHashtags = '';
  showMoreMenu = false;

  constructor(private router: Router) {}

  async ngOnInit() {
    await this.loadUserData();
  }

  async loadUserData() {
    this.loading = true;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      this.router.navigate(['/auth']);
      return;
    }
    this.user = user;

    // Load profile
    let { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profileData) {
      const { data: insertedProfile } = await supabase
        .from('profiles')
        .insert({
          user_id: user.id,
          full_name: this.user.email,
          avatar_url: null,
        })
        .select()
        .single();

      profileData = insertedProfile;
    }

    this.profile = profileData;

    // Load preferences
    const { data: prefData } = await supabase
      .from('preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    this.preferences = prefData ?? null;

    // Saved trips count
    const { count } = await supabase
      .from('trips')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    this.savedTripsCount = typeof count === 'number' ? count : 0;

    // Load gallery
    await this.loadGallery(user.id);

    // 🌟 UPDATE PROFILE VIBE TAGS
    await this.saveVibeTagsToProfile();

    this.loading = false;
  }

  async loadGallery(userId: string) {
    this.galleryLoading = true;

    const { data } = await supabase
      .from('user_gallery')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (data) this.gallery = data;

    this.galleryLoading = false;
  }

  initials(name?: string) {
    const n = name || this.profile?.full_name || this.user?.email || '';
    return n
      .split(/\s+/)
      .map((s: string) => s[0]?.toUpperCase() ?? '')
      .slice(0, 2)
      .join('');
  }

  memberSince() {
    const created = this.user?.created_at || this.profile?.created_at;
    if (!created) return '—';
    return new Date(created).toLocaleDateString();
  }

  get postsCount() {
    return this.gallery?.length || 0;
  }

  goToSavedTrips() {
    this.router.navigate(['/saved-trips']);
  }

  goToEditProfile() {
    this.router.navigate(['/edit-profile']);
  }

  // --------------------------------
  // ➕ Add Hidden Place (NEW)
  // --------------------------------
  goToAddHiddenPlace() {
    this.router.navigate(['/add-hidden-place']);
  }

  // --------------------------------
  // 🌟 Extract social-media vibe tags
  // --------------------------------
  extractVibeTags(): string[] {
    const tags: Set<string> = new Set();

    for (const post of this.gallery) {
      if (post.hashtags && Array.isArray(post.hashtags)) {
        post.hashtags.forEach((h: string) => {
          const clean = h.trim().toLowerCase();
          if (clean) tags.add(clean);
        });
      }

      if (post.caption) {
        const words = post.caption
          .toLowerCase()
          .split(/[^a-zA-Z]+/)
          .filter((w: string) => w.length > 3);

        words.forEach((w: string) => tags.add(w));
      }
    }

    return Array.from(tags);
  }

  // --------------------------------
  // 🌟 Save vibe tags into profiles
  // --------------------------------
  async saveVibeTagsToProfile() {
    const vibes = this.extractVibeTags();

    await supabase
      .from('profiles')
      .update({ vibe_tags: vibes })
      .eq('user_id', this.user.id);

    if (this.profile) {
      this.profile.vibe_tags = vibes;
    }
  }

  // --------------------------------
  // 🔵 Avatar Upload
  // --------------------------------
  async onAvatarSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert('Please sign in.');
      return;
    }

    try {
      this.avatarUploading = true;

      const ext = file.name.split('.').pop();
      const fileName = `avatar-${Date.now()}.${ext}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('user_photos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        alert('Error uploading avatar.');
        return;
      }

      const { data } = supabase.storage
        .from('user_photos')
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);

      this.profile.avatar_url = publicUrl;
    } finally {
      this.avatarUploading = false;
      (event.target as HTMLInputElement).value = '';
    }
  }

  // --------------------------------
  // 🧡 Upload new gallery photo
  // --------------------------------
  onPhotoFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedPhotoFile = input.files?.[0] || null;
  }

  async uploadPhoto() {
    if (!this.selectedPhotoFile) {
      alert('Please choose a photo first.');
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert('Please sign in.');
      return;
    }

    try {
      this.uploadingPhoto = true;

      const file = this.selectedPhotoFile;
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}.${ext}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('user_photos')
        .upload(filePath, file);

      if (uploadError) {
        alert('Error uploading photo.');
        return;
      }

      const { data } = supabase.storage
        .from('user_photos')
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      const tags =
        this.hashtagsInput
          .split(/[,\s#]+/)
          .map((t) => t.trim())
          .filter((t) => t.length > 0) || [];

      const { data: inserted } = await supabase
        .from('user_gallery')
        .insert({
          user_id: user.id,
          photo_url: publicUrl,
          path: filePath,
          caption: this.captionInput || null,
          hashtags: tags.length ? tags : null,
        })
        .select('*')
        .single();

      this.gallery = [inserted, ...this.gallery];

      // 🌟 Update vibe tags after new upload
      await this.saveVibeTagsToProfile();

      this.selectedPhotoFile = null;
      this.captionInput = '';
      this.hashtagsInput = '';
    } finally {
      this.uploadingPhoto = false;
    }
  }

  // --------------------------------
  // 🖼 Modal open
  // --------------------------------
  openPhotoModal(photo: any) {
    this.selectedPhoto = photo;
    this.editCaption = photo.caption || '';
    this.editHashtags = (photo.hashtags || []).join(' ');
    this.showPhotoModal = true;
    this.showMoreMenu = false;
  }

  closePhotoModal() {
    this.showPhotoModal = false;
    this.selectedPhoto = null;
    this.showMoreMenu = false;
  }

  toggleMoreMenu() {
    this.showMoreMenu = !this.showMoreMenu;
  }

  // --------------------------------
  // ✏ Edit caption/hashtags
  // --------------------------------
  async savePhotoEdits() {
    if (!this.selectedPhoto) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert('Please sign in.');
      return;
    }

    const tags =
      this.editHashtags
        .split(/[,\s#]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0) || [];

    await supabase
      .from('user_gallery')
      .update({
        caption: this.editCaption || null,
        hashtags: tags.length ? tags : null,
      })
      .eq('id', this.selectedPhoto.id)
      .eq('user_id', user.id);

    this.gallery = this.gallery.map((p) =>
      p.id === this.selectedPhoto.id
        ? { ...p, caption: this.editCaption, hashtags: tags }
        : p
    );

    this.selectedPhoto.caption = this.editCaption;
    this.selectedPhoto.hashtags = tags;

    // 🌟 Update vibe tags after edits
    await this.saveVibeTagsToProfile();

    this.showMoreMenu = false;
  }

  // --------------------------------
  // 🗑 Delete photo
  // --------------------------------
  async deletePhoto() {
    if (!this.selectedPhoto) return;

    const confirmDelete = confirm('Delete this photo?');
    if (!confirmDelete) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert('Please sign in.');
      return;
    }

    const photo = this.selectedPhoto;

    await supabase
      .from('user_gallery')
      .delete()
      .eq('id', photo.id)
      .eq('user_id', user.id);

    if (photo.path) {
      await supabase.storage.from('user_photos').remove([photo.path]);
    }

    this.gallery = this.gallery.filter((p) => p.id !== photo.id);

    this.closePhotoModal();

    // 🌟 Update vibe tags after deletion
    await this.saveVibeTagsToProfile();
  }
}
