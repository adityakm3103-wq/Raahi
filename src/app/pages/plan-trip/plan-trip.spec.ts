import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlanTrip } from './plan-trip';

describe('PlanTrip', () => {
  let component: PlanTrip;
  let fixture: ComponentFixture<PlanTrip>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlanTrip]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlanTrip);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
