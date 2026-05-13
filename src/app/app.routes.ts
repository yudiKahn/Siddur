import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  {
    path: 'home',
    loadComponent: () =>
      import('./components/home/home.page').then((component) => component.HomePage),
  },
  {
    path: 'reader/:presetId',
    loadComponent: () =>
      import('./components/reader/reader.page').then((component) => component.ReaderPage),
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./components/about/about.page').then((component) => component.AboutPage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];
