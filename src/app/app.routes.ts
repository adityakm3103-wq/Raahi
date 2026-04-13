import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home').then(m => m.Home) },
  { path: 'auth', loadComponent: () => import('./pages/auth/auth').then(m => m.Auth) },
  { path: 'preferences', loadComponent: () => import('./pages/preferences/preferences').then(m => m.Preferences) },
  { path: 'plan', loadComponent: () => import('./pages/plan-trip/plan-trip').then(m => m.PlanTrip) },
  { path: 'saved-trips', loadComponent: () => import('./pages/saved-trips/saved-trips').then(m => m.SavedTrips) },
  { path: 'profile', loadComponent: () => import('./pages/profile/profile').then(m => m.Profile) },
  { path: 'add-hidden-place', loadComponent: () => import('./pages/add-hidden-place/add-hidden-place').then(m => m.AddHiddenPlace) },


  // ⭐ ADDED THIS (nothing else changed)
  { path: 'edit-profile', loadComponent: () => import('./pages/edit-profile/edit-profile').then(m => m.EditProfile) },

  { path: 'discover', loadComponent: () => import('./pages/discover/discover').then(m => m.Discover) },
  { path: '**', loadComponent: () => import('./pages/not-found/not-found').then(m => m.NotFound) }
];
