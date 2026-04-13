import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { supabase } from '../../services/supabaseClient';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './auth.html',
  styleUrls: ['./auth.css'],
})
export class Auth {
  mode: 'signin' | 'signup' = 'signin';
  loading = false;
  email = '';
  password = '';
  fullName = '';

  constructor(private router: Router) {}

  toggleMode() {
    this.mode = this.mode === 'signin' ? 'signup' : 'signin';
  }

  async handleAuth() {
    if (!this.email || !this.password || (this.mode === 'signup' && !this.fullName)) {
      alert('Please fill in all fields.');
      return;
    }

    this.loading = true;

    try {
      if (this.mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: this.email,
          password: this.password,
          options: {
            data: { full_name: this.fullName },
            emailRedirectTo: `${window.location.origin}/preferences`,
          },
        });

        if (error) throw error;
        alert('Account created successfully! Set up your preferences next.');
        this.router.navigate(['/preferences']);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: this.email,
          password: this.password,
        });
        if (error) throw error;

        const userId = data.user?.id;
        if (!userId) throw new Error('User not found.');

        // Always redirect to preferences as requested by user
        alert('Access granted! Please set up your preferences.');
        this.router.navigate(['/preferences']);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      alert('Error: ' + err.message);
    } finally {
      this.loading = false;
    }
  }
}
