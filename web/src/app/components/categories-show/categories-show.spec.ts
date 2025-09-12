import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CategoriesShow } from './categories-show';

describe('CategoriesShow', () => {
  let component: CategoriesShow;
  let fixture: ComponentFixture<CategoriesShow>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoriesShow]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CategoriesShow);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
