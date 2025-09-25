import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaymentMethodsPage } from './payment-methods.page';

describe('PaymentMethodsPage', () => {
  let component: PaymentMethodsPage;
  let fixture: ComponentFixture<PaymentMethodsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PaymentMethodsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
