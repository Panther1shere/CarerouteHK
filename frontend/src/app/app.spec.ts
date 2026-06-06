import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { App } from './app';
import { StatusService } from './status.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        {
          provide: StatusService,
          useValue: {
            getStatus: () => of({ message: 'Hello from the PostgreSQL Database!' })
          }
        }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the connection-test headline', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Angular Frontend is running successfully!'
    );
  });
});
