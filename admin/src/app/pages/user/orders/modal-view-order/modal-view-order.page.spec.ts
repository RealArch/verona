import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalViewOrderPage } from './modal-view-order.page';

describe('ModalViewOrderPage', () => {
  let component: ModalViewOrderPage;
  let fixture: ComponentFixture<ModalViewOrderPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ModalViewOrderPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
