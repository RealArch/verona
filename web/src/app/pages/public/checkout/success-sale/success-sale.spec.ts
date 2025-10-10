import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SuccessSale } from './success-sale';

describe('SuccessSale', () => {
  let component: SuccessSale;
  let fixture: ComponentFixture<SuccessSale>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SuccessSale]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SuccessSale);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
