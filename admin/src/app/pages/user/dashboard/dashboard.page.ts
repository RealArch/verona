import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonIcon, IonGrid, IonRow, IonCol } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { layers, people, statsChart } from 'ionicons/icons';
import { Metadata, Counters } from 'src/app/services/metadata';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [IonIcon, IonGrid, IonRow, IonCol, IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class DashboardPage implements OnInit, OnDestroy {
  private metadata = inject(Metadata);
  private destroy$ = new Subject<void>();

  counters = signal<Counters | null>(null);

  constructor() {
    addIcons({ statsChart, layers, people });
  }

  ngOnInit() {
    this.metadata.getCounters()
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => this.counters.set(data));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
