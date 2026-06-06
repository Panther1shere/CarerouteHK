import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly briefInput = signal('');
  protected readonly submittedState = signal<'idle' | 'submitted'>('idle');

  protected onInputChange(value: string): void {
    this.briefInput.set(value);
    this.submittedState.set('idle');
  }

  protected clearInput(): void {
    this.briefInput.set('');
    this.submittedState.set('idle');
  }

  protected submitPolicy(): void {
    this.submittedState.set('submitted');
  }
}
