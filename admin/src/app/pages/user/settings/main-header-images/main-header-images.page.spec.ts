import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MainHeaderImagesPage } from './main-header-images.page';

describe('MainHeaderImagesPage', () => {
  let component: MainHeaderImagesPage;
  let fixture: ComponentFixture<MainHeaderImagesPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MainHeaderImagesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
