import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface StatusResponse {
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class StatusService {
  private readonly http = inject(HttpClient);

  getStatus(): Observable<StatusResponse> {
    return this.http.get<StatusResponse>('/api/status');
  }
}
