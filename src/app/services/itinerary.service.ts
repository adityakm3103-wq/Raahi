// src/app/services/itinerary.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type Place = {
  name: string;
  circuit?: string;
};

export type PlaceExplanation = {
  placeName: string;
  shortReason: string;
};

export type DayPlan = {
  day: number;
  places: Place[];
};

export type ItineraryResult = {
  destination: string;
  days: DayPlan[];
  explanations: PlaceExplanation[];
};

@Injectable({
  providedIn: 'root',
})
export class ItineraryService {
  constructor(private http: HttpClient) {}

  private DESTINATION_MAP: Record<string, string[]> = {
  coorg: ['coorg', 'kodagu', 'madikeri'],
  chikkamagaluru: ['chikkamagaluru', 'chikmagalur'],
  bangalore: ['bengaluru', 'bangalore'],
};

private resolveSlug(dest: string): string {
  const d = dest.toLowerCase();

  for (const slug of Object.keys(this.DESTINATION_MAP)) {
    const keywords = this.DESTINATION_MAP[slug];
    if (keywords.some((k) => d.includes(k))) {
      return slug;
    }
  }

  return 'bangalore'; // fallback
}


  // Select PLACES JSON
  private placesFileFor(dest: string) {
    const slug = this.resolveSlug(dest);
return `assets/places/${slug}_places.json`;

  }

  // Select EXPLANATIONS JSON
  private explanationFileFor(dest: string) {
    const slug = this.resolveSlug(dest);
return `assets/places/${slug}_explanations.json`;

  }

  private async loadFile(path: string): Promise<any> {
    try {
      return await this.http.get(path).toPromise();
    } catch (e) {
      console.error('Missing file:', path);
      return {};
    }
  }

  // Convert circuits → list of places
  private flattenPlaces(json: any) {
    const out: Place[] = [];
    const circuits = (json && json.circuits) || {};

    Object.keys(circuits).forEach((circuitName) => {
      const placesArr = circuits[circuitName].places || [];
      placesArr.forEach((p: string) =>
        out.push({ name: p, circuit: circuitName })
      );
    });

    return out;
  }

  private shuffle<T>(array: T[]): T[] {
  let a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


  // MAIN GENERATOR
  async generateItinerary(
    destination: string,
    startDate: string,
    endDate: string,
    prefs: any = {},
    perDayCapacity = 3
  ): Promise<ItineraryResult> {

    // LOAD FILES
    const placesJson = await this.loadFile(this.placesFileFor(destination));
    const explanationJson = await this.loadFile(this.explanationFileFor(destination));

    const places = this.flattenPlaces(placesJson);

    // ----------------------------------------------------
    // ✅ CORRECT EXPLANATION MAP (Matches your JSON exactly)
    // ----------------------------------------------------
    const explanationMap: Record<string, string> = {};

    if (explanationJson && typeof explanationJson === 'object') {
      Object.keys(explanationJson).forEach((circuitName) => {
        const placeBlock = explanationJson[circuitName];

        if (placeBlock && typeof placeBlock === 'object') {
          Object.keys(placeBlock).forEach((placeName) => {
            const obj = placeBlock[placeName];
            if (obj && obj.reason) {
              explanationMap[placeName] = obj.reason;
            }
          });
        }
      });
    }

    // Compute days
    const s = new Date(startDate);
    const e = new Date(endDate);

    let days = Math.ceil((+e - +s) / 86400000) + 1;
    if (days < 1 || !isFinite(days)) days = 1;

    const maxDays = Math.ceil(places.length / perDayCapacity);
    days = Math.min(days, maxDays);

    // Remove duplicates
    const seen = new Set<string>();
    let unique = places.filter((p) => {
  if (seen.has(p.name)) return false;
  seen.add(p.name);
  return true;
});

// 🟩 NEW — randomize places to avoid repetition
unique = this.shuffle(unique);


    // SPLIT INTO DAYS
    const daysOut: DayPlan[] = [];
    let idx = 0;

    for (let d = 1; d <= days; d++) {
      const list: Place[] = [];
      for (let i = 0; i < perDayCapacity && idx < unique.length; i++) {
        list.push(unique[idx]);
        idx++;
      }
      daysOut.push({ day: d, places: list });
    }

    // BUILD FINAL EXPLANATION ARRAY
    const explanations: PlaceExplanation[] = [];

    daysOut.forEach((day) => {
      day.places.forEach((place) => {
        explanations.push({
          placeName: place.name,
          shortReason: explanationMap[place.name] || 'A recommended place to explore.',
        });
      });
    });

    return {
      destination,
      days: daysOut,
      explanations,
    };
  }
}
