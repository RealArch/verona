import { Component, inject, OnInit } from '@angular/core';
import {
  IonApp, IonRouterOutlet, IonSplitPane, IonHeader, IonToolbar, IonTitle,
  IonContent, IonList, IonItem, IonLabel, IonIcon, IonMenu, IonMenuToggle
} from '@ionic/angular/standalone';
import { AuthService } from './services/auth.service';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import { speedometer, layers, logOut, cube } from 'ionicons/icons';
@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonIcon, IonLabel, IonItem, IonList, IonContent, IonTitle, IonToolbar,
    IonHeader, IonSplitPane, IonApp, IonRouterOutlet, IonMenu, IonMenuToggle,
    RouterLink
  ],
})
export class AppComponent {

}
