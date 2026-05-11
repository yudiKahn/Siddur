import { Component } from '@angular/core';
import { register } from 'swiper/element/bundle';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor() {
    // import function to register Swiper custom elements
    // register Swiper custom elements
    console.log('Registering Swiper custom elements');        
    register();
  }
}
