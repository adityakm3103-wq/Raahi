// src/app/pages/plan-trip/plan-trip.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';
import { supabase } from '../../services/supabaseClient';
import { Sidebar } from '../../components/sidebar/sidebar';
import { ItineraryService } from '../../services/itinerary.service';
import { SocialService } from '../../services/social.service';

// ⭐ RL SERVICE IMPORT
import { RLService } from '../../services/rl.service';


@Component({
  selector: 'app-plan-trip',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, Sidebar],
  templateUrl: './plan-trip.html',
  styleUrls: ['./plan-trip.css'],
})
export class PlanTrip {
  loading = false;
  itinerary: any = null;
  explanations: any[] = [];
  preferences: any = null;
  tripName = '';

  startTime: string = '';
  cutoffTime: string = '';
  placeData: any = null;

  // Base flat list of all places (in original order)
  baseSequence: {
    name: string;
    reason: string;
    detail: any;
    isHiddenGem?: boolean;
  }[] = [];

  // How many days the itinerary has BEFORE any delay (baseline)
  baselineDays: number = 0;

  // Delay UI state
  showDelayPopup = false;
  delayInput: number | null = null;
  delayUnit: 'min' | 'hr' = 'min';
  delayTargetIndex: number | null = null;
  lastDelayTargetName: string | null = null;
  lastDelayConfig: { startIndex: number; minutes: number } | null = null;

  // Skip UI state
  showSkipPopup = false;
  overflowActivities: { baseIndex: number; name: string }[] = [];
  skipSelection: number[] = [];

  // ⭐ RL SUGGESTION ARRAYS
  topLiked: any[] = [];
  similarTraveller: any[] = [];
  hiddenGems: any[] = [];
  topOrder: string[] = [];
  socialRecommendations: any[] = [];
  topRated: any[] = [];   // ⭐ Top rated places for Smart Suggestions

  dragging = false;
  dragOffset = { x: 0, y: 0 };
  dragPos = { x: 1000, y: 150 };
  


    // ----------------------------------
  // 🔹 PHASE 2 — SMART FILTERS STATE
  // ----------------------------------

  selectedAgeGroup: string = '';        // child | adult | senior
  selectedInterests: string[] = [];     // temple, nature, trekking...
  selectedBudget: string = '';          // low | medium | high
  sortNearbyFirst: boolean = false;


  constructor(
    private router: Router,
    private itineraryService: ItineraryService,
    private rl: RLService,// ⭐ injected RL service
    private social: SocialService
  ) {}

  async ngOnInit() {
    this.preferences = history.state.preferences;

    if (!this.preferences) {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          alert('Please sign in to plan your trip.');
          this.router.navigate(['/auth']);
          return;
        }

        const { data } = await supabase
          .from('travel_preferences')
          .select('*')
          .eq('user_id', user.id)
          .order('inserted_at', { ascending: false })
          .limit(1)
          .single();

        this.preferences = data;
      } catch {
        alert('Please set your travel preferences first.');
        this.router.navigate(['/preferences']);
        return;
      }
    }

    if (!this.preferences?.destination) {
      alert('Please select a destination.');
      this.router.navigate(['/preferences']);
      return;
    }

    const start =
      this.preferences.start_date || this.preferences.startDate || '';
    const end =
      this.preferences.return_date ||
      this.preferences.returnDate ||
      this.preferences.endDate ||
      '';

    this.tripName = `${this.preferences.destination} Trip${
      start && end ? ` (${start} → ${end})` : ''
    }`;
  }

  private DESTINATION_MAP: Record<string, string[]> = {
  coorg: ['coorg', 'kodagu', 'madikeri'],
  chikkamagaluru: ['chikkamagaluru', 'chikmagalur', 'chikk', 'chikm'],
  bangalore: ['bangalore', 'bengaluru'],
};

private resolveSlug(dest: string): string {
  const d = dest.toLowerCase();

  for (const slug of Object.keys(this.DESTINATION_MAP)) {
    const keywords = this.DESTINATION_MAP[slug];
    if (keywords.some(k => d.includes(k))) {
      return slug;
    }
  }

  return 'bangalore'; // fallback
}



  // Load JSON place data
  async loadPlaceData(destination: string) {
  const slug = this.resolveSlug(destination);
  const response = await fetch(`/assets/places/${slug}_places.json`);
  this.placeData = await response.json();
}


  // Helper functions
  toMinutes(timeStr: string): number {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }

  fromMinutes(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m
      .toString()
      .padStart(2, '0')}`;
  }

  distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) ** 2;

    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  estimateSpeedKmH(destination: string): number {
  const slug = this.resolveSlug(destination);

  if (slug === 'bangalore') return 28;
  if (slug === 'coorg') return 20;
  if (slug === 'chikkamagaluru') return 22;

  return 25; // default
}
    // ----------------------------------
  // 🔹 PHASE 2 — APPLY SMART FILTERS
  // ----------------------------------
  applySmartFilters(places: any[]): any[] {
    let filtered = [...places];

    // Interest filter
    if (this.selectedInterests.length > 0) {
      filtered = filtered.filter(p =>
        this.selectedInterests.includes(
          (p.category || '').toLowerCase()
        )
      );
    }

    // Budget filter
    if (this.selectedBudget) {
      filtered = filtered.filter(p =>
        (p.budget || '').toLowerCase() === this.selectedBudget
      );
    }

    // Age group filter
    if (this.selectedAgeGroup) {
      filtered = filtered.filter(p => {
        const ages: string[] = p.suitableFor || [];
        return ages.includes(this.selectedAgeGroup);
      });
    }

    return filtered;
  }
  // ----------------------------------
// 🔹 PHASE 2 — INTEREST TOGGLE
// ----------------------------------
toggleInterest(value: string, checked: boolean) {
  if (checked) {
    if (!this.selectedInterests.includes(value)) {
      this.selectedInterests.push(value);
    }
  } else {
    this.selectedInterests = this.selectedInterests.filter(
      v => v !== value
    );
  }
}



  travelMinutesBetween(p1: any, p2: any, speed: number): number {
    if (!p1 || !p2) return 0;
    const km = this.distanceKm(p1.lat, p1.lng, p2.lat, p2.lng);
    return Math.round((km / speed) * 60);
  }

  /**
   * Build itinerary from baseSequence, optionally applying delay.
   * Returns plan, totalDays, and overflowActivities.
   */
  buildItineraryWithDelay(delayConfig?: {
    startIndex: number;
    minutes: number;
  }) {
    if (!this.baseSequence || this.baseSequence.length === 0) {
      return {
        plan: [],
        totalDays: 0,
        overflowActivities: [] as { baseIndex: number; name: string }[],
      };
    }

    const destination = this.preferences.destination;
    const speed = this.estimateSpeedKmH(destination);

    const startMinutes = this.toMinutes(this.startTime);
    const cutoffMinutes = this.toMinutes(this.cutoffTime);

    let itineraryDays: any[] = [];
    let currentDay = 1;
    let currentTime = startMinutes;
    let previousPlaceDetail: any = null;

    let delayApplied = false;

    itineraryDays[currentDay] = {
      day: currentDay,
      title: `Day ${currentDay} in ${destination}`,
      activities: [],
    };

    this.baseSequence.forEach((item, index) => {
      const detail = item.detail;

      const travelMinutes = previousPlaceDetail
        ? this.travelMinutesBetween(previousPlaceDetail, detail, speed)
        : 0;

      let effectiveCurrentTime = currentTime;

      if (
        delayConfig &&
        !delayApplied &&
        index >= delayConfig.startIndex
      ) {
        effectiveCurrentTime += delayConfig.minutes;
        delayApplied = true;
      }

      let start = effectiveCurrentTime + travelMinutes;
      let end = start + detail.durationMinutes;

      if (end > cutoffMinutes) {
        currentDay++;
        itineraryDays[currentDay] = {
          day: currentDay,
          title: `Day ${currentDay} in ${destination}`,
          activities: [],
        };

        currentTime = startMinutes;
        previousPlaceDetail = null;

        let effectiveCurrentTime2 = currentTime;
        if (
          delayConfig &&
          !delayApplied &&
          index >= delayConfig.startIndex
        ) {
          effectiveCurrentTime2 += delayConfig.minutes;
          delayApplied = true;
        }

        const travel2 = 0;
        start = effectiveCurrentTime2 + travel2;
        end = start + detail.durationMinutes;
      }

      itineraryDays[currentDay].activities.push({
        name: item.name,
        reason: item.reason,
        travelMinutes,
        startTime: this.fromMinutes(start),
        endTime: this.fromMinutes(end),
        durationMinutes: detail.durationMinutes,
        baseIndex: index,
        isHiddenGem: item.isHiddenGem === true,
        lat: detail.lat,
        lng: detail.lng,

      });

      previousPlaceDetail = detail;
      currentTime = end;
    });

    const plan = Object.values(itineraryDays);
    const totalDays = plan.length;

    const overflowActivities: { baseIndex: number; name: string }[] =
      [];

    if (this.baselineDays && totalDays > this.baselineDays) {
      for (let d = this.baselineDays; d < plan.length; d++) {
        const day: any = plan[d];
        day.activities.forEach((act: any) => {
          overflowActivities.push({
            baseIndex: act.baseIndex,
            name: act.name,
          });
        });
      }
    }

    return { plan, totalDays, overflowActivities };
  }

  // Generate itinerary (initial, no delay)
  async generateTrip() {
    this.loading = true;

    try {
      if (!this.startTime || !this.cutoffTime) {
        alert('Please select both start time and cutoff time.');
        this.loading = false;
        return;
      }

      const destination = this.preferences.destination;
      const startDate =
        this.preferences.start_date || this.preferences.startDate;
      const endDate =
        this.preferences.return_date ||
        (this.preferences as any).returnDate ||
        this.preferences.endDate;

      const prefs = {
        interests: this.preferences.preferences || '',
        preferredCircuit: '',
      };

      await this.loadPlaceData(destination);

      // 🔹 Hidden gems come from "Hidden_Offbeat_Places" circuit
const hiddenGemSet = new Set<string>();

const hiddenCircuit = this.placeData?.circuits?.['Hidden_Offbeat_Places'];
if (hiddenCircuit?.places_detailed) {
  hiddenCircuit.places_detailed.forEach((p: any) => {
    hiddenGemSet.add(p.name);
  });
}


      // ✅ Calculate number of trip days from start & end date (inclusive)
      const startMs = new Date(startDate).getTime();
      const endMs = new Date(endDate).getTime();
      const diffMs = endMs - startMs;
      const tripDays = Math.max(
        1,
        Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1
      );

      // 🔹 Call service WITHOUT misusing tripDays as per-day capacity
      const result = await this.itineraryService.generateItinerary(
        destination,
        startDate,
        endDate,
        prefs
      );

      const explanationMap: Record<string, string> = {};
      result.explanations.forEach((e: any) => {
        explanationMap[e.placeName] = e.shortReason;
      });

      this.baseSequence = [];

// Collect all detailed places
let allDetailedPlaces: any[] = [];

for (const circuit of Object.values(this.placeData.circuits)) {
  const c: any = circuit as any;
  if (c.places_detailed) {
    allDetailedPlaces.push(...c.places_detailed);
  }
}

// Apply smart filters
let filteredPlaces = this.applySmartFilters(allDetailedPlaces);

// Fallback if too few results
if (filteredPlaces.length < 5) {
  filteredPlaces = allDetailedPlaces;
  alert('Not enough places match your filters. Showing closest matches.');
}

for (const day of result.days) {
  for (const place of day.places) {

    const foundDetail = filteredPlaces.find(
      (p: any) => p.name === place.name
    );

    if (!foundDetail) continue;

    this.baseSequence.push({
      name: place.name,
      reason:
        explanationMap[place.name] ||
        'A recommended place to explore.',
      detail: foundDetail,
      isHiddenGem: hiddenGemSet.has(place.name)
    });
  }
}


/* ---------------------------------------------------
   🔹 Ensure minimum 2 hidden gems in itinerary
--------------------------------------------------- */
/* ---------------------------------------------------
   🔹 Ensure hidden gems are DISTRIBUTED in itinerary
--------------------------------------------------- */

/* ---------------------------------------------------
   🔹 Ensure 1 hidden gem per day (max)
--------------------------------------------------- */

const totalDays = tripDays; // already computed earlier
const hiddenInBase = this.baseSequence.filter(p => p.isHiddenGem);



if (hiddenCircuit?.places_detailed) {

  const alreadyAdded = new Set(this.baseSequence.map(p => p.name));

  // Maximum hidden gems allowed = number of days
  const maxHiddenAllowed = totalDays;

  const needed = Math.max(
    0,
    maxHiddenAllowed - hiddenInBase.length
  );

  if (needed > 0) {

    const candidates = hiddenCircuit.places_detailed
      .filter((p: any) => !alreadyAdded.has(p.name))
      .slice(0, needed);

    candidates.forEach((p: any, idx: number) => {

      // Spread hidden gems across the itinerary
      const insertAt = Math.min(
        Math.floor(
          (idx + 1) * this.baseSequence.length / totalDays
        ),
        this.baseSequence.length
      );

      this.baseSequence.splice(insertAt, 0, {
        name: p.name,
        reason: 'A lesser-known offbeat place worth exploring.',
        detail: p,
        isHiddenGem: true
      });
    });
  }
}



// ⭐ STEP 5 — RL Sorting of visit order

      if (this.topOrder && this.topOrder.length > 0) {
        this.baseSequence.sort((a, b) => {
          const ai = this.topOrder.indexOf(a.name);
          const bi = this.topOrder.indexOf(b.name);
          return ai - bi;
        });
      }

      const built = this.buildItineraryWithDelay();

      // ✅ Limit itinerary days to tripDays based on dates
      const maxDays = tripDays;
      const trimmedPlan =
        built.plan.length > maxDays
          ? built.plan.slice(0, maxDays)
          : built.plan;

      this.baselineDays = maxDays;

      this.itinerary = {
        destination,
        plan: trimmedPlan,
      };

      // ⭐ LOAD RL SUGGESTIONS
      this.loadRLSuggestions();

    } catch (err) {
      console.error(err);
      alert('Failed to generate itinerary.');
    } finally {
      this.loading = false;
    }
  }

  // Delay popup handlers
  openDelayPopup(baseIndex: number, name: string) {
    this.delayTargetIndex = baseIndex;
    this.lastDelayTargetName = name;
    this.delayInput = null;
    this.delayUnit = 'min';
    this.showDelayPopup = true;
  }

  cancelDelay() {
    this.showDelayPopup = false;
    this.delayInput = null;
    this.delayTargetIndex = null;
    this.lastDelayTargetName = null;
    this.lastDelayConfig = null;
  }

  applyDelay() {
    if (this.delayTargetIndex === null) {
      alert('No activity selected for delay.');
      return;
    }
    if (this.delayInput === null || this.delayInput <= 0) {
      alert('Please enter a valid delay value.');
      return;
    }

    let minutes = this.delayInput;
    if (this.delayUnit === 'hr') {
      minutes = minutes * 60;
    }

    const delayConfig = {
      startIndex: this.delayTargetIndex,
      minutes,
    };
    this.lastDelayConfig = delayConfig;

    const built = this.buildItineraryWithDelay(delayConfig);
    const newDays = built.totalDays;

    if (
      this.baselineDays &&
      newDays > this.baselineDays &&
      built.overflowActivities.length > 0
    ) {
      this.overflowActivities = built.overflowActivities;
      this.skipSelection = [];
      this.showSkipPopup = true;
    } else {
      this.itinerary = {
        destination: this.preferences.destination,
        plan: built.plan,
      };
    }

    this.showDelayPopup = false;
    this.delayInput = null;
    this.delayTargetIndex = null;
  }

  // Skip popup UI helpers
  toggleSkipSelection(baseIndex: number, checked: boolean) {
    if (checked) {
      if (!this.skipSelection.includes(baseIndex)) {
        this.skipSelection.push(baseIndex);
      }
    } else {
      this.skipSelection = this.skipSelection.filter(
        (i) => i !== baseIndex
      );
    }
  }

  cancelSkip() {
    this.showSkipPopup = false;
    this.skipSelection = [];
    this.overflowActivities = [];
  }

  applySkip() {
    if (!this.lastDelayConfig) {
      this.showSkipPopup = false;
      return;
    }

    if (!this.skipSelection || this.skipSelection.length === 0) {
      alert('Please select at least one activity to skip.');
      return;
    }

    const skipSet = new Set(this.skipSelection);
    this.baseSequence = this.baseSequence.filter(
      (_item, idx) => !skipSet.has(idx)
    );

    let newStartIndex = 0;
    if (this.lastDelayTargetName) {
      const idx = this.baseSequence.findIndex(
        (item) => item.name === this.lastDelayTargetName
      );
      newStartIndex = idx >= 0 ? idx : 0;
    } else {
      newStartIndex = Math.min(
        this.lastDelayConfig.startIndex,
        this.baseSequence.length - 1
      );
    }

    const newDelayConfig = {
      startIndex: newStartIndex,
      minutes: this.lastDelayConfig.minutes,
    };

    const built = this.buildItineraryWithDelay(newDelayConfig);

    this.itinerary = {
      destination: this.preferences.destination,
      plan: built.plan,
    };

    this.showSkipPopup = false;
    this.skipSelection = [];
    this.overflowActivities = [];
    this.lastDelayConfig = null;
    this.lastDelayTargetName = null;
  }

  async saveTrip() {
    if (!this.itinerary) {
      alert('Generate an itinerary first.');
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      alert('Please sign in.');
      this.router.navigate(['/auth']);
      return;
    }

    const payload = {
      user_id: user.id,
      plan: {
        tripName: this.tripName,
        destination: this.preferences.destination,
        startDate:
          this.preferences.start_date || this.preferences.startDate,
        endDate:
          this.preferences.return_date ||
          (this.preferences as any).returnDate ||
          this.preferences.endDate,
          startTime: this.startTime,
    cutoffTime: this.cutoffTime,
        itinerary: this.itinerary.plan,
      },
    };

    const { error } = await supabase.from('trips').insert(payload);
    if (error) {
      alert('Error saving trip.');
      return;
    }

    alert('Trip saved successfully!');
    this.router.navigate(['/saved-trips']);
  }

  goHome() {
    this.router.navigate(['/']);
  }

  openDirections(lat: number, lng: number, placeName: string) {
  if (!lat || !lng) {
    alert('Navigation unavailable for this place');
    return;
  }

  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

  window.open(url, '_blank');
}



  // ----------------------------------
// 🗺️ PHASE 3 — OPEN MAP & TRACK USER
// ----------------------------------



  // -------------------------------
  // 🔥 RL FUNCTIONS (Existing)
  // -------------------------------

  async markLike(placeName: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("Sign in first");

    await supabase.from("user_actions").insert({
      user_id: user.id,
      place_name: placeName,
      action_type: "like"
    });

    alert(`❤️ Liked ${placeName}`);
  }

  async markSkip(placeName: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("Sign in first");

    await supabase.from("user_actions").insert({
      user_id: user.id,
      place_name: placeName,
      action_type: "skip"
    });

    alert(`🚫 Marked ${placeName} as skipped`);
  }

  async ratePlace(placeName: string, rating: number) {
    if (!rating) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("Sign in first");

    await supabase.from("user_actions").insert({
      user_id: user.id,
      place_name: placeName,
      action_type: "rate",
      rating: Number(rating)
    });

    alert(`⭐ Rated ${placeName}: ${rating} stars`);
  }

  // -------------------------------
  // ⭐ NEW RL SUGGESTION LOADER
  // -------------------------------
  async loadRLSuggestions() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const dest = this.preferences.destination;

   this.topLiked = await this.rl.getTopLikedPlaces(dest);
   this.topRated = await this.rl.getTopRatedPlaces(dest);  // ⭐ ADD

this.similarTraveller = await this.rl.getSimilarTravellerSuggestions(user.id, dest);
//this.hiddenGems = await this.rl.getHiddenGems(dest);
this.topOrder = await this.rl.getTopVisitOrder(dest);
   // ⭐ ADD THIS
   this.socialRecommendations = await this.social.getSocialSuggestions(
      user.id,
      dest
    );

  }
  // ------------------------------------------------------
// ⭐ DRAGGABLE SMART SUGGESTIONS — HANDLERS
// ------------------------------------------------------
startDrag(event: any) {
  this.dragging = true;

  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;

  this.dragOffset.x = clientX - this.dragPos.x;
  this.dragOffset.y = clientY - this.dragPos.y;

  window.addEventListener('mousemove', this.onDragMove);
  window.addEventListener('mouseup', this.endDrag);
  window.addEventListener('touchmove', this.onDragMove);
  window.addEventListener('touchend', this.endDrag);
}

onDragMove = (event: any) => {
  if (!this.dragging) return;

  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;

  this.dragPos.x = clientX - this.dragOffset.x;
  this.dragPos.y = clientY - this.dragOffset.y;
};

endDrag = () => {
  this.dragging = false;

  window.removeEventListener('mousemove', this.onDragMove);
  window.removeEventListener('mouseup', this.endDrag);
  window.removeEventListener('touchmove', this.onDragMove);
  window.removeEventListener('touchend', this.endDrag);
};

}
