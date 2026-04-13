import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddHiddenPlace } from './add-hidden-place';

describe('AddHiddenPlace', () => {
  let component: AddHiddenPlace;
  let fixture: ComponentFixture<AddHiddenPlace>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddHiddenPlace]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddHiddenPlace);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
