import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { environment } from './environments/environment';

const registerServiceWorker = async (): Promise<void> => {
  if (!environment.production || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    const serviceWorkerUrl = new URL('service-worker.js', document.baseURI).toString();
    void navigator.serviceWorker.register(serviceWorkerUrl);
  });
};

bootstrapApplication(AppComponent, appConfig).catch((error) =>
  console.error(error),
);

void registerServiceWorker();
