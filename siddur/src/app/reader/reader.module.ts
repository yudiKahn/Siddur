import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ReaderPageRoutingModule } from './reader-routing.module';
import { ReaderPage } from './reader.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ReaderPageRoutingModule,
  ],
  declarations: [ReaderPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ReaderPageModule {}
