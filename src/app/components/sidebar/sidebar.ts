import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../../services/theme.service';
import { supabase } from '../../services/supabaseClient';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css'],
})
export class Sidebar {
  constructor(
    private router: Router,
    public themeService: ThemeService
  ) {}

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  navigate(path: string) {
    this.router.navigate([path]);
  }
  
  async handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
       console.error('Logout error:', error);
       alert('Error logging out: ' + error.message);
    } else {
       this.router.navigate(['/auth']);
    }
  }
}

