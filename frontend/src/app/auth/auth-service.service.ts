import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { RegisterRequest } from './dto/register-request';
import { Observable } from 'rxjs';
import { AuthResponse } from './dto/auth-reponse';
import { AuthRequest } from './dto/auth-request';

@Injectable({
  providedIn: 'root'
})
export class AuthServiceService {
  private apiUrl: String = "http://192.168.50.212:8080";

  constructor(protected http: HttpClient) { }

  public register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, request);
  }

  public login(request: AuthRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/authenticate`, request);
  }
}
