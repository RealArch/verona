import { TestBed } from '@angular/core/testing';

import { Popups } from './popups';

describe('Popups', () => {
  let service: Popups;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Popups);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
