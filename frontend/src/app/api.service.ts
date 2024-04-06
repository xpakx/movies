import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Room } from './dto/room';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  apiUrl = "http://localhost:8080"

  constructor(private http: HttpClient) { }

  getRoom(): Observable<Room> {
    return this.http.get<Room>(`${this.apiUrl}`);
  }
}
