import { inject, Injectable } from '@angular/core';
import { ToastController, AlertController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
@Injectable({
  providedIn: 'root'
})
export class Popups {
  toastController = inject(ToastController);
  alertController = inject(AlertController);

  constructor() {
    addIcons({ closeOutline })
  }
  async presentToast(position: 'top' | 'middle' | 'bottom', color: string, msg: string) {
    const toast = await this.toastController.create({
      message: msg,
      duration: 6000,
      position: position,
      color: color,
      swipeGesture: "vertical",
      buttons: [{
        icon: "close-outline"
      }]
    });

    await toast.present();
  }

  async presentAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header: header,
      message: message,
      buttons: ['Ok'],
      backdropDismiss: false,

    });

    await alert.present();
  }

}
