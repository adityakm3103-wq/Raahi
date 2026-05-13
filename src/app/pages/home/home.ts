import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { supabase } from '../../services/supabaseClient';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
})
export class Home implements OnInit {
  isLoggedIn = false;

  async ngOnInit() {
    const { data: { user } } = await supabase.auth.getUser();
    this.isLoggedIn = !!user;

    supabase.auth.onAuthStateChange((event, session) => {
      this.isLoggedIn = !!session?.user;
    });
  }
}
