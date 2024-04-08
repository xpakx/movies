import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { RegisterRequest } from './dto/register-request';
import { Observable } from 'rxjs';
import { AuthResponse } from './dto/auth-reponse';
import { AuthRequest } from './dto/auth-request';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthServiceService {
  private apiUrl: String = environment.apiUrl;

  constructor(protected http: HttpClient) { }

  public register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, request);
  }

  public login(request: AuthRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/authenticate`, request);
  }
}
