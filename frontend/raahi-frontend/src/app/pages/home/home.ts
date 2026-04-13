import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Sidebar } from '../../components/sidebar/sidebar';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, Sidebar],
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
})
export class Home {
  user = false; // Replace with real auth state later
}
