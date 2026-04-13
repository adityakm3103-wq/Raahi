import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { supabase } from '../../services/supabaseClient';
import { Sidebar } from '../../components/sidebar/sidebar';

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, Sidebar],
  templateUrl: './edit-profile.html',
  styleUrls: ['./edit-profile.css'],
})
export class EditProfile {
  user: any = null;
  full_name = '';
  loading = true;

  constructor(private router: Router) {}

  async ngOnInit() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      this.router.navigate(['/auth']);
      return;
    }
    this.user = user;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    this.full_name = data?.full_name || '';
    this.loading = false;
  }

  async saveProfile() {
    this.loading = true;

    await supabase
      .from('profiles')
      .update({ full_name: this.full_name })
      .eq('user_id', this.user.id);

    this.loading = false;
    alert('Profile updated!');
    this.router.navigate(['/profile']);
  }
}
