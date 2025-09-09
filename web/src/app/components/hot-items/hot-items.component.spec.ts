import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HotItemsComponent } from './hot-items.component';

describe('HotItemsComponent', () => {
  let component: HotItemsComponent;
  let fixture: ComponentFixture<HotItemsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HotItemsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HotItemsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
