import { Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { register } from 'swiper/element/bundle';
import { SiddurPdfService } from './services/siddur-pdf.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly translateService = inject(TranslateService);
  private readonly siddurPdfService = inject(SiddurPdfService);

  constructor() {
    register();
    this.title.setTitle(this.translateService.instant('app.title'));
    this.meta.updateTag({
      name: 'application-name',
      content: this.translateService.instant('app.meta.applicationName'),
    });
    this.meta.updateTag({
      name: 'apple-mobile-web-app-title',
      content: this.translateService.instant('app.meta.appleMobileWebAppTitle'),
    });
    this.siddurPdfService.prefetch();
  }
}
