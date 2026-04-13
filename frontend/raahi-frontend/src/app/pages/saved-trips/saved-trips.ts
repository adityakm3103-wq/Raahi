import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { supabase } from '../../services/supabaseClient';
import { Sidebar } from '../../components/sidebar/sidebar';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-saved-trips',
  standalone: true,
  imports: [CommonModule,FormsModule ,Sidebar],
  templateUrl: './saved-trips.html',
  styleUrls: ['./saved-trips.css'],
})
export class SavedTrips implements OnInit {

  loading = true;
  trips: any[] = [];

  // Modal State
  selectedTrip: any = null;
  showModal = false;

  // Delay / Skip State (Copied from Plan-Trip)
  showDelayPopup = false;
  delayInput: number | null = null;
  delayUnit: 'min' | 'hr' = 'min';
  delayTargetIndex: number | null = null;
  lastDelayTargetName: string | null = null;
  lastDelayConfig: { startIndex: number; minutes: number } | null = null;

  showSkipPopup = false;
  overflowActivities: { baseIndex: number; name: string }[] = [];
  skipSelection: number[] = [];

  baselineDays: number = 0;
  startTime!: string;
cutoffTime!: string;


  constructor(private router: Router) {}

  async ngOnInit() {
    await this.loadTrips();
  }

  // Load all saved trips
  async loadTrips() {
    this.loading = true;

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      this.router.navigate(['/auth']);
      return;
    }

    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error) {
      this.trips = data || [];
    }

    this.loading = false;
  }

  // OPEN trip modal
  viewTrip(trip: any) {
    this.openTripModal(trip.plan);
  }

  openTripModal(plan: any) {
    this.selectedTrip = JSON.parse(JSON.stringify(plan)); // deep copy
    this.startTime  = plan.startTime  || '09:00';
  this.cutoffTime = plan.cutoffTime || '19:00';
    this.baselineDays = this.selectedTrip.itinerary.length;
    this.showModal = true;
  }

  // CLOSE trip modal
  closeModal() {
    this.showModal = false;
    this.selectedTrip = null;
  }

  // DELETE trip
  async deleteTrip(id: string) {
    const { error } = await supabase
      .from('trips')
      .delete()
      .eq('id', id);

    if (!error) {
      this.trips = this.trips.filter(t => t.id !== id);
      alert('Trip deleted successfully!');
    }
  }

  

toMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
}

  /* --------------------------------------------------------------------------
     DELAY LOGIC (Copied fully from Plan-Trip, adapted for saved itinerary)
  ---------------------------------------------------------------------------*/

  buildItineraryWithDelay(delayConfig?: { startIndex:number; minutes:number }) {

  const plan = JSON.parse(JSON.stringify(this.selectedTrip.itinerary));
if (!plan || plan.length === 0) {
  return {
    plan: [],
    totalDays: this.baselineDays,
    overflowActivities: []
  };
}

  const dayStart  = this.toMinutes(this.startTime || '09:00');
  const cutoff    = this.toMinutes(this.cutoffTime || '19:00');

  let overflow:any[] = [];
  let delayApplied = false;

  plan.forEach((day:any) => {

    let currentTime = dayStart;

    day.activities.forEach((act:any) => {

      // apply delay ONLY ONCE — from this activity onward
      if (delayConfig && !delayApplied && act.baseIndex >= delayConfig.startIndex) {
        currentTime += delayConfig.minutes;
        delayApplied = true;
      }

      const duration =
        this.toMinutes(act.endTime) -
        this.toMinutes(act.startTime);

      let start = currentTime;
      let end   = start + duration;

      // If exceeds cutoff → push overflow & DO NOT SCHEDULE
      if (end > cutoff) {
        overflow.push({ baseIndex: act.baseIndex, name: act.name });
        return;
      }

      act.startTime = this.fromMinutes(start);
      act.endTime   = this.fromMinutes(end);

      currentTime = end;
    });

  });

  return {
    plan,
    totalDays: this.baselineDays,
    overflowActivities: overflow
  };
}




  

  openDelayPopup(act: any) {
    this.delayTargetIndex = act.baseIndex;
    this.lastDelayTargetName = act.name;
    this.delayInput = null;
    this.delayUnit = 'min';
    this.showDelayPopup = true;
  }

  applyDelay() {

  if (this.delayInput === null || this.delayInput <= 0) {
    alert("Please enter valid delay");
    return;
  }

  let minutes = this.delayInput;
  if (this.delayUnit === "hr") minutes *= 60;

  const delayConfig = {
    startIndex: this.delayTargetIndex!,
    minutes
  };

  this.lastDelayConfig = delayConfig;

 const built = this.buildItineraryWithDelay(delayConfig);
if (!built) return;   // <-- add this line

if (built.totalDays > this.baselineDays &&
    built.overflowActivities.length > 0) {


    this.overflowActivities = built.overflowActivities;
    this.showSkipPopup = true;

  } else {
    this.selectedTrip.itinerary = built.plan;
  }

  this.showDelayPopup = false;
}


  toggleSkipSelection(baseIndex: number, checked: boolean) {
    if (checked) this.skipSelection.push(baseIndex);
    else this.skipSelection = this.skipSelection.filter(i => i !== baseIndex);
  }

  applySkip() {
    const skipSet = new Set(this.skipSelection);

    const flat = this.selectedTrip.itinerary
      .flatMap((d: any) => d.activities)
      .filter((a: any) => !skipSet.has(a.baseIndex));

    // rebuild in simple one-day format
    let currentDay = 1;
    this.selectedTrip.itinerary = [
      {
        day: 1,
        title: `Day 1 in ${this.selectedTrip.destination}`,
        activities: flat
      }
    ];

    this.showSkipPopup = false;
    this.skipSelection = [];
    this.overflowActivities = [];
  }


  /* --------------------------------------------------------------------------
     LIKE / SKIP / RATE ACTIONS (Copied from Plan-Trip)
  ---------------------------------------------------------------------------*/

  async likePlace(name: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("Login required");

    await supabase.from("user_actions").insert({
      user_id: user.id,
      place_name: name,
      action_type: "like"
    });

    alert(`❤️ Liked ${name}`);
  }

  async skipPlace(name: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("Login required");

    await supabase.from("user_actions").insert({
      user_id: user.id,
      place_name: name,
      action_type: "skip"
    });

    alert(`🚫 Skipped ${name}`);
  }

  async ratePlace(name: string, rating: number) {
    if (!rating) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("Login required");

    await supabase.from("user_actions").insert({
      user_id: user.id,
      place_name: name,
      action_type: "rate",
      rating
    });

    alert(`⭐ Rated ${name}: ${rating}`);
  }

  // ----------------------------------
// 🧭 OPEN DIRECTIONS (Saved Trips)
// ----------------------------------
openDirections(lat: number, lng: number, placeName: string) {
  if (!lat || !lng) {
    alert('Navigation unavailable for this place');
    return;
  }

  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  window.open(url, '_blank');
}


}
