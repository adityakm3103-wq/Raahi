import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { supabase } from '../../services/supabaseClient';
import { Sidebar } from '../../components/sidebar/sidebar';

@Component({
  selector: 'app-preferences',
  standalone: true,
  imports: [CommonModule, FormsModule, Sidebar],
  templateUrl: './preferences.html',
  styleUrls: ['./preferences.css'],
})
export class Preferences {
  userId: string | null = null;

  // Main form fields
  startLocation = '';
  destination = '';
  startDate = '';
  returnDate = '';
  budget = '';
  travelType = 'Solo';
  preferences = '';

  // For group travel
  groupMembers: { name: string; interests: string }[] = [];

  loading = false;

  constructor(private router: Router) {
    this.loadUser();
  }

  async loadUser() {
    const { data } = await supabase.auth.getUser();
    this.userId = data.user?.id || null;
  }

  addGroupMember() {
    this.groupMembers.push({ name: '', interests: '' });
  }

  removeGroupMember(i: number) {
    this.groupMembers.splice(i, 1);
  }

  async savePreferences() {
    if (!this.userId) {
      alert('You must be logged in to save preferences.');
      return;
    }

    this.loading = true;

    const { error } = await supabase.from('travel_preferences').insert([
      {
        user_id: this.userId,
        start_location: this.startLocation,
        destination: this.destination,
        start_date: this.startDate,
        return_date: this.returnDate,
        budget: this.budget,
        travel_type: this.travelType,
        preferences: this.preferences,
        group_preferences: this.travelType !== 'Solo' ? this.groupMembers : [],
      },
    ]);

    this.loading = false;

    if (error) {
      console.error(error);
      alert('Error saving preferences: ' + error.message);
    } else {
      alert('Preferences saved successfully!');
      this.router.navigate(['/plan']);
    }
  }
}
