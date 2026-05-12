import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  {
    path: 'home',
    loadComponent: () =>
      import('./home/home.page').then((component) => component.HomePage),
  },
  {
    path: 'reader/:presetId',
    loadComponent: () =>
      import('./reader/reader.page').then((component) => component.ReaderPage),
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./about/about.page').then((component) => component.AboutPage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];
