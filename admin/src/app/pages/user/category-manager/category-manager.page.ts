import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonIcon, IonFab, IonFabButton, ModalController, IonList, IonItem, IonLabel, IonItemSliding, IonButton } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { create, folderOpen, trash, add, addCircle } from 'ionicons/icons';

@Component({
  selector: 'app-category-manager',
  templateUrl: './category-manager.page.html',
  styleUrls: ['./category-manager.page.scss'],
  standalone: true,
  imports: [IonButton, IonItemSliding, IonLabel, IonItem, IonList, IonFabButton, IonFab, IonIcon, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class CategoryManagerPage implements OnInit, OnDestroy {


  constructor() {
    addIcons({folderOpen,addCircle,create,trash,add});
  }

  ngOnInit() {
   
  }

  ngOnDestroy() {
  
  }

  
}