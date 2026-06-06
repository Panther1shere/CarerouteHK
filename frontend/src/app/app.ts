import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { StatusService } from './status.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly statusService = inject(StatusService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly databaseMessage = signal('');
  protected readonly errorMessage = signal('');
  protected readonly isLoading = signal(true);

  constructor() {
    this.statusService
      .getStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ message }) => {
          this.databaseMessage.set(message);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('FastAPI could not load the database message.');
          this.isLoading.set(false);
        }
      });
  }
}
