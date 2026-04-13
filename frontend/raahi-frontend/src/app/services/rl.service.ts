/* -------------------------------------------------------
   Raahi 2.0 — Reinforcement Learning Service
   Tracks: LIKE, SKIP, RATING
   Provides: popularity, ratings, social signals, ordering
   NOTE: Hidden Gems here are KEPT but NOT recommended
         for Smart Suggestion or itinerary logic
-------------------------------------------------------- */

import { Injectable } from '@angular/core';
import { supabase } from './supabaseClient';

interface UserAction {
  user_id: string;
  place_name: string;
  action_type: string;
  rating?: number;
  inserted_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class RLService {

  /* ---------------------------------------------------
     DESTINATION → PLACE FILE MAPPING
     (kept as-is, will be generalized later)
  --------------------------------------------------- */

  private destinationToFile(dest: string): string {
    const d = dest.toLowerCase();
    if (d.includes("coorg") || d.includes("kodagu") || d.includes("madikeri"))
      return "assets/places/coorg_places.json";
    if (d.includes("chikk") || d.includes("chikmagalur"))
      return "assets/places/chikkamagaluru_places.json";
    return "assets/places/bangalore_places.json";
  }

  private async loadDestinationPlaces(dest: string): Promise<string[]> {
    try {
      const file = this.destinationToFile(dest);
      const response = await fetch(file);
      const json = await response.json();

      let names: string[] = [];
      Object.values(json.circuits).forEach((c: any) => {
        if (Array.isArray(c.places)) {
          names = names.concat(c.places);
        }
      });

      return names;
    } catch (e) {
      console.error("Failed loading destination places:", e);
      return [];
    }
  }

  /* ---------------------------------------------------
     1. RECORD USER ACTIONS (UNCHANGED)
  --------------------------------------------------- */

  async recordLike(placeName: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('user_actions').insert({
      user_id: user.id,
      place_name: placeName,
      action_type: 'like',
    });
  }

  async recordSkip(placeName: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('user_actions').insert({
      user_id: user.id,
      place_name: placeName,
      action_type: 'skip',
    });
  }

  async recordRating(placeName: string, rating: number) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('user_actions').insert({
      user_id: user.id,
      place_name: placeName,
      action_type: 'rate',
      rating: rating,
    });
  }

  /* ---------------------------------------------------
     2. SMART SUGGESTION SIGNALS (CORRECT & CLEAN)
  --------------------------------------------------- */

  /** 👍 TOP LIKED PLACES — for Smart Suggestion box */
  async getTopLikedPlaces(destination: string) {
    const destPlaces = await this.loadDestinationPlaces(destination);

    const { data, error } = await supabase
      .from('user_actions')
      .select('*')
      .eq('action_type', 'like');

    if (error || !data) return [];

    const counts: Record<string, number> = {};

    (data as UserAction[]).forEach(row => {
      if (destPlaces.includes(row.place_name)) {
        counts[row.place_name] = (counts[row.place_name] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([place, score]) => ({ place, score }))
      .slice(0, 3);
  }

  /** ⭐ TOP RATED PLACES — for Smart Suggestion box */
  async getTopRatedPlaces(destination: string) {
    const destPlaces = await this.loadDestinationPlaces(destination);

    const { data, error } = await supabase
      .from('user_actions')
      .select('place_name, rating')
      .eq('action_type', 'rate');

    if (error || !data) return [];

    const ratingMap: Record<string, number[]> = {};

    (data as UserAction[]).forEach(row => {
      if (
        row.rating &&
        destPlaces.includes(row.place_name)
      ) {
        if (!ratingMap[row.place_name]) {
          ratingMap[row.place_name] = [];
        }
        ratingMap[row.place_name].push(row.rating);
      }
    });

    return Object.entries(ratingMap)
      .map(([place, ratings]) => ({
        place,
        avgRating:
          ratings.reduce((a, b) => a + b, 0) / ratings.length,
        count: ratings.length
      }))
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, 3);
  }

  /* ---------------------------------------------------
     3. SOCIAL / COLLABORATIVE SIGNALS
  --------------------------------------------------- */

  /** 👥 SIMILAR TRAVELLER SUGGESTIONS */
  async getSimilarTravellerSuggestions(userId: string, destination: string) {
    const destPlaces = await this.loadDestinationPlaces(destination);

    const { data: myData } = await supabase
      .from('user_actions')
      .select('place_name')
      .eq('user_id', userId)
      .eq('action_type', 'like');

    const myLikes = (myData?.map(x => x.place_name) || [])
      .filter(p => destPlaces.includes(p));

    if (myLikes.length === 0) return [];

    const { data: others } = await supabase
      .from('user_actions')
      .select('user_id, place_name')
      .neq('user_id', userId)
      .in('place_name', myLikes)
      .eq('action_type', 'like');

    const similarUsers = [...new Set(others?.map(x => x.user_id) || [])];

    if (similarUsers.length === 0) return [];

    const { data: recommendations } = await supabase
      .from('user_actions')
      .select('place_name')
      .in('user_id', similarUsers)
      .eq('action_type', 'like');

    const recSet = new Set(
      (recommendations?.map(x => x.place_name) || [])
        .filter(p => !myLikes.includes(p))
        .filter(p => destPlaces.includes(p))
    );

    return [...recSet].slice(0, 3);
  }

  /* ---------------------------------------------------
     4. HIDDEN GEMS (KEPT — BUT NOT FOR SMART SUGGESTION)
     ⚠️ Recommendation:
     Use JSON-defined hidden gems for itinerary
  --------------------------------------------------- */

  async getHiddenGems(destination: string) {
    const destPlaces = await this.loadDestinationPlaces(destination);

    const { data } = await supabase
      .from('user_actions')
      .select('place_name, rating');

    const ratingMap: Record<string, number[]> = {};

    (data as UserAction[]).forEach(row => {
      if (row.rating && destPlaces.includes(row.place_name)) {
        if (!ratingMap[row.place_name]) ratingMap[row.place_name] = [];
        ratingMap[row.place_name].push(row.rating);
      }
    });

    const hidden: { place: string; avg: number; count: number }[] = [];

    Object.entries(ratingMap).forEach(([place, ratings]) => {
      const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;

      if (avg >= 4 && ratings.length < 10) {
        hidden.push({ place, avg, count: ratings.length });
      }
    });

    return hidden.slice(0, 5);
  }

  /* ---------------------------------------------------
     5. VISIT ORDER OPTIMIZATION (UNCHANGED)
  --------------------------------------------------- */

  async getTopVisitOrder(destination: string): Promise<string[]> {
    const destPlaces = await this.loadDestinationPlaces(destination);

    const { data, error } = await supabase
      .from("user_actions")
      .select("user_id, place_name, inserted_at")
      .order("inserted_at", { ascending: true });

    if (error || !data) return [];

    const sequences: Record<string, string[]> = {};

    data.forEach((row: any) => {
      if (!destPlaces.includes(row.place_name)) return;

      const uid = row.user_id;
      if (!sequences[uid]) sequences[uid] = [];
      if (!sequences[uid].includes(row.place_name)) {
        sequences[uid].push(row.place_name);
      }
    });

    const orderScore: Record<string, number> = {};

    Object.values(sequences).forEach(seq => {
      seq.forEach((p, index) => {
        orderScore[p] = (orderScore[p] || 0) + (seq.length - index);
      });
    });

    return Object.entries(orderScore)
      .sort((a, b) => b[1] - a[1])
      .map(([place]) => place);
  }
}
