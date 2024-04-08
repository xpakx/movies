import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';
import { AuthResponse } from '../dto/auth-reponse';
import { AuthRequest } from '../dto/auth-request';
import { AuthServiceService } from '../auth-service.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;

  error: boolean = false;
  errorMsg: String = "";

  constructor(private formBuilder: FormBuilder, private authService: AuthServiceService) {
    this.loginForm = this.formBuilder.group({
      username: [''],
      password: [''],
    });
   }

  ngOnInit(): void {}

  login(): void {
    console.log(this.loginForm.value);
    if (this.loginForm.invalid) {
      return;
    }

    let request: AuthRequest = {
      username: this.loginForm.value.username,
      password: this.loginForm.value.password,
    };

    console.log(request);
    this.authService.login(request)
      .subscribe({
        next: (response: AuthResponse) => this.onLogin(response),
        error: (err: HttpErrorResponse) => this.onError(err)
      });
  }

  onLogin(response: AuthResponse) {
    this.error = false;
    localStorage.setItem('token', response.token.toString());
    localStorage.setItem('username', response.username.toString());
  }

  onError(err: HttpErrorResponse) {
    console.log(err);
    this.error = true;
    this.errorMsg = err.message;
  }
}
