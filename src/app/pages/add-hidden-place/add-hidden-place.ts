import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { supabase } from '../../services/supabaseClient';
import { Sidebar } from '../../components/sidebar/sidebar';

@Component({
  selector: 'app-add-hidden-place',
  standalone: true,
  imports: [CommonModule, FormsModule, Sidebar],
  templateUrl: './add-hidden-place.html',
  styleUrls: ['./add-hidden-place.css'],
})
export class AddHiddenPlace {

  userId: string | null = null;

  // Form fields
  placeName = '';
  category = '';
  district = '';
  latitude: number | null = null;
  longitude: number | null = null;
  bestSeason = '';
  description = '';

  loading = false;

  constructor(private router: Router) {
    this.loadUser();
  }

  async loadUser() {
    const { data } = await supabase.auth.getUser();
    this.userId = data.user?.id || null;
  }

  // Basic validation
  isValid() {
    return (
      this.placeName.trim().length > 0 &&
      this.category.trim().length > 0 &&
      this.district.trim().length > 0 &&
      this.latitude !== null &&
      this.longitude !== null
    );
  }

  async submitPlace() {
    if (!this.userId) {
      alert('You must be logged in.');
      return;
    }

    if (!this.isValid()) {
      alert('Please fill all required fields.');
      return;
    }

    this.loading = true;

    const { error } = await supabase.from('community_places').insert([
      {
        user_id: this.userId,
        name: this.placeName,
        category: this.category,
        district: this.district,
        latitude: this.latitude,
        longitude: this.longitude,
        best_season: this.bestSeason,
        description: this.description
      }
    ]);

    this.loading = false;

    if (error) {
      console.error(error);
      alert('Error adding place: ' + error.message);
    } else {
      alert('Hidden place added successfully!');
      this.router.navigate(['/profile']);
    }
  }

  cancel() {
    this.router.navigate(['/profile']);
  }
}
