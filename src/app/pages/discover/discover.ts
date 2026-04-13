import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Sidebar } from '../../components/sidebar/sidebar';
import { supabase } from '../../services/supabaseClient';

@Component({
  selector: 'app-discover',
  standalone: true,
  imports: [CommonModule, Sidebar],
  templateUrl: './discover.html',
  styleUrls: ['./discover.css'],
})
export class Discover implements OnInit {
  // Navigation State
  viewMode: 'cities' | 'places' | 'details' = 'cities';
  loading = false;
  
  // Selections
  selectedCity: string = '';
  selectedPlace: any = null;
  
  // Data arrays
  cities = ['Coorg', 'Chikkamagaluru', 'Bengaluru'];
  destinations: any[] = [];
  communityPhotos: any[] = [];

  // Upload state
  uploading = false;

  constructor(private router: Router) {}

  async ngOnInit() {
    // Initial view is cities
  }

  // 🌆 City Selection
  async selectCity(city: string) {
    this.selectedCity = city;
    this.viewMode = 'places';
    await this.loadDestinations(city);
  }

  // 📍 Place Selection
  async selectPlace(place: any) {
    this.selectedPlace = place;
    this.viewMode = 'details';
    await this.loadCommunityPhotos(place.name);
  }

  // ⬅ Navigation
  goBack() {
    if (this.viewMode === 'details') {
      this.viewMode = 'places';
      this.communityPhotos = [];
    } else if (this.viewMode === 'places') {
      this.viewMode = 'cities';
      this.destinations = [];
    }
  }

  // 📥 Fetch Destinations (JSON)
  async loadDestinations(city: string) {
    this.loading = true;
    try {
      const slug = this.CITY_SLUG_MAP[city];
      const res = await fetch(`/assets/places/${slug}_places.json`);
      const data = await res.json();
      this.destinations = this.extractDetailedPlaces(data);
    } catch (err) {
      console.error('Error loading destinations:', err);
      this.destinations = [];
    } finally {
      this.loading = false;
    }
  }

  // 🖼 Fetch Community Photos (Supabase)
  async loadCommunityPhotos(placeName: string) {
    this.loading = true;
    try {
      const tag = `#place:${placeName.replace(/\s+/g, '')}`;
      const { data, error } = await supabase
        .from('user_gallery')
        .select('*')
        .contains('hashtags', [tag])
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.communityPhotos = data || [];
    } catch (err) {
      console.error('Error loading community photos:', err);
      this.communityPhotos = [];
    } finally {
      this.loading = false;
    }
  }

  // 📤 Upload Photo for Place
  async onPhotoSelected(event: any) {
    const file = event.target.files[0];
    if (!file || !this.selectedPlace) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Please login to contribute photos!');
      this.router.navigate(['/auth']);
      return;
    }

    this.uploading = true;
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `community/${fileName}`;

      // 1. Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('user_photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('user_photos')
        .getPublicUrl(filePath);

      const photo_url = publicUrlData.publicUrl;

      // 3. Insert metadata with #place tag
      const placeTag = `#place:${this.selectedPlace.name.replace(/\s+/g, '')}`;
      const { data: inserted, error: insertError } = await supabase
        .from('user_gallery')
        .insert({
          user_id: user.id,
          photo_url,
          path: filePath,
          caption: `Community photo of ${this.selectedPlace.name}`,
          hashtags: [placeTag, 'community', this.selectedCity.toLowerCase()]
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (inserted) {
        this.communityPhotos = [inserted, ...this.communityPhotos];
      }
      
      alert('Photo contributed successfully!');
    } catch (err: any) {
      console.error('Upload failed:', err);
      alert('Upload failed: ' + err.message);
    } finally {
      this.uploading = false;
    }
  }

  private CITY_SLUG_MAP: Record<string, string> = {
    Coorg: 'coorg',
    Chikkamagaluru: 'chikkamagaluru',
    Bengaluru: 'bangalore',
  };

  getCityImage(city: string) {
    switch (city) {
      case 'Coorg': return 'assets/coorg.jpg';
      case 'Chikkamagaluru': return 'assets/chikkamagaluru.jpg';
      case 'Bengaluru': return 'assets/bengaluru.jpg';
      default: return 'assets/default.jpg';
    }
  }

  extractDetailedPlaces(data: any): any[] {
    const places: any[] = [];
    if (!data?.circuits) return places;

    Object.values(data.circuits).forEach((c: any) => {
      if (Array.isArray(c.places_detailed)) {
        c.places_detailed.forEach((p: any) => {
          if (p?.name) {
            places.push({
              name: p.name,
              category: p.category || 'Attraction',
              description: p.reason || 'Explore the beauty of this place.',
              latitude: p.lat,
              longitude: p.lng
            });
          }
        });
      }
    });
    return places;
  }

  goToPlan() {
    this.router.navigate(['/plan']);
  }
}

