import { ApplicationConfig } from '@angular/core';
import { RouteReuseStrategy, provideRouter, withComponentInputBinding, withPreloading } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { IonicRouteStrategy } from '@ionic/angular';
import { PreloadAllModules } from '@angular/router';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideIonicAngular(),
    provideRouter(
      appRoutes,
      withPreloading(PreloadAllModules),
      withComponentInputBinding(),
    ),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
  ],
};
