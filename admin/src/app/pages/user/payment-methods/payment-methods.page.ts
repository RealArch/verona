import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons, IonBackButton, IonIcon, IonGrid, IonList, IonCheckbox, IonItem, IonCard, IonCardHeader, IonCardContent, IonCardTitle } from '@ionic/angular/standalone';
import { add, business, cash, logoPaypal, addCircleOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';

@Component({
  selector: 'app-payment-methods',
  templateUrl: './payment-methods.page.html',
  styleUrls: ['./payment-methods.page.scss'],
  standalone: true,
  imports: [IonCardContent, IonCard, IonItem, IonCheckbox, IonGrid, IonIcon, IonBackButton, IonButtons, IonButton, IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class PaymentMethodsPage implements OnInit {

  constructor() { 
    addIcons({logoPaypal,business,cash,addCircleOutline});
  }

  ngOnInit() {
  }

}
