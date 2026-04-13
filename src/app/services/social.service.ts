import { Injectable } from '@angular/core';
import { supabase } from './supabaseClient';

@Injectable({
  providedIn: 'root',
})
export class SocialService {
  constructor() {}

  // ---------------------------------------------------------
  // ⭐ Mapping Vibe Tags → Place Keywords
  // ---------------------------------------------------------
  private vibeToPlaceKeywords: Record<string, string[]> = {
    nature: ["nature", "forest", "green", "greenery", "greenary", "scenic", "hill", "mountain", "view", "viewpoint", "park"],
    temple: ["temple", "religious", "spiritual", "pilgrimage", "holy"],
    adventure: ["trek", "hike", "offroad", "adventure", "peak"],
    waterfall: ["waterfall", "falls"],
    lake: ["lake", "dam", "reservoir", "backwater"],
    heritage: ["heritage", "fort", "palace", "monument", "historic", "village"],
    wildlife: ["wildlife", "safari", "elephant", "sanctuary"],
    viewpoint: ["viewpoint", "view", "sunset"],
  };

  // ---------------------------------------------------------
  // ⭐ Load correct places.json file based on destination
  // ---------------------------------------------------------
  async loadPlacesJson(destination: string): Promise<any> {
    let fileName = '';

    if (destination.toLowerCase().includes('bangalore')) {
      fileName = 'bangalore_places.json';
    } else if (destination.toLowerCase().includes('coorg')) {
      fileName = 'coorg_places.json';
    } else if (
      destination.toLowerCase().includes('chikk') ||
      destination.toLowerCase().includes('chikm') ||
      destination.toLowerCase().includes('malnad')
    ) {
      fileName = 'chikkamagaluru_places.json';
    } else {
      fileName = 'bangalore_places.json';
    }

    const response = await fetch(`/assets/places/${fileName}`);
    return await response.json();
  }

  // ---------------------------------------------------------
  // ⭐ Load explanations.json (if needed)
  // ---------------------------------------------------------
  async loadExplanationsJson(destination: string): Promise<any[]> {
    let fileName = '';

    if (destination.toLowerCase().includes('bangalore')) {
      fileName = 'bangalore_explanations.json';
    } else if (destination.toLowerCase().includes('coorg')) {
      fileName = 'coorg_explanations.json';
    } else if (
      destination.toLowerCase().includes('chikk') ||
      destination.toLowerCase().includes('chikm')
    ) {
      fileName = 'chikkamagaluru_explanations.json';
    } else {
      fileName = 'bangalore_explanations.json';
    }

    const response = await fetch(`/assets/explanations/${fileName}`);
    return await response.json();
  }

  // ---------------------------------------------------------
  // ⭐ Extract visited vibes from user's gallery (hashtags)
  // ---------------------------------------------------------
  extractVisitedPlacesFromGallery(gallery: any[]): Set<string> {
    const visited = new Set<string>();

    gallery.forEach((post) => {
      if (post.hashtags && Array.isArray(post.hashtags)) {
        post.hashtags.forEach((tag: string) => {
          visited.add(tag.trim().toLowerCase());
        });
      }
    });

    return visited;
  }

  // ---------------------------------------------------------
  // ⭐ MAIN: Social Suggestions
  // ---------------------------------------------------------
  async getSocialSuggestions(userId: string, destination: string) {
    // 1️⃣ Fetch profile → vibe_tags
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('vibe_tags')
      .eq('user_id', userId)
      .single();

    if (error || !profile) return [];
    const vibeTags: string[] = profile.vibe_tags || [];
    if (vibeTags.length === 0) return [];

    // 2️⃣ Load gallery → extract visited tags (hashtags)
    const { data: gallery } = await supabase
      .from('user_gallery')
      .select('*')
      .eq('user_id', userId);

    const visited = this.extractVisitedPlacesFromGallery(gallery || []);

    // 3️⃣ Load places.json → collect all places
    const placesJson = await this.loadPlacesJson(destination);

    let allPlaces: any[] = [];
    for (const circuit of Object.values(placesJson.circuits)) {
      const c: any = circuit as any;
      allPlaces = [...allPlaces, ...c.places_detailed];
    }

    // 4️⃣ Score each place using vibeTags → keyword mapping
    const scored: { place: any; score: number }[] = [];

    for (const place of allPlaces) {
      const name = place.name.toLowerCase();
      const category = place.category?.toLowerCase() || '';
      const circuitDesc = ''; // no circuit desc in data, keeping hook for future
      const nameWords = name
  .split(/[^a-zA-Z]+/)
  .filter((w: string) => w.length > 2);


      let score = 0;

      // ❌ remove visited places
      for (const v of visited) {
        if (name.includes(v)) score = -999;
      }
      if (score === -999) continue;

      // Loop all vibe tags
      for (const tag of vibeTags) {
        const vibe = tag.toLowerCase();
        const keywords = this.vibeToPlaceKeywords[vibe] || [];

        for (const key of keywords) {

          // ✔ match place name
          if (name.includes(key)) score += 3;

          // ✔ match category
          if (category.includes(key)) score += 3;

          // ✔ match category words (e.g. "waterfall", "trek")
          if (place.category?.toLowerCase().includes(key)) score += 2;

          // ✔ match name keywords
         if (nameWords.some((w: string) => w.includes(key))) score += 2;


        }
      }

      if (score > 0) {
        scored.push({ place, score });
      }
    }

    // 5️⃣ Sort by score DESC
    scored.sort((a, b) => b.score - a.score);

    // 6️⃣ Return TOP 2 WITH score
    return scored.slice(0, 2).map((s) => ({
      place: s.place.name,
      score: s.score,
    }));
  }
}
