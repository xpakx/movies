import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Room } from './dto/room';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getRoom(): Observable<Room> {
    return this.http.get<Room>(`${this.apiUrl}`);
  }
}
