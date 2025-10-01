import { TestBed } from '@angular/core/testing';

import { Metadata } from './metadata';

describe('Metadata', () => {
  let service: Metadata;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Metadata);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
