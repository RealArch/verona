import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminSetupPage } from './admin-setup.page';

describe('AdminSetupPage', () => {
  let component: AdminSetupPage;
  let fixture: ComponentFixture<AdminSetupPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminSetupPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
