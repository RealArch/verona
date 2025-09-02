import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoryManagerPage } from './category-manager.page';

describe('CategoryManagerPage', () => {
  let component: CategoryManagerPage;
  let fixture: ComponentFixture<CategoryManagerPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CategoryManagerPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
