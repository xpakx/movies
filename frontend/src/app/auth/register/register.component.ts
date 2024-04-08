import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';
import { AuthResponse } from '../dto/auth-reponse';
import { RegisterRequest } from '../dto/register-request';
import { AuthServiceService } from '../auth-service.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent implements OnInit {
  registerForm: FormGroup;

  error: boolean = false;
  errorMsg: String = "";

  constructor(private formBuilder: FormBuilder, private authService: AuthServiceService) {
    this.registerForm = this.formBuilder.group({
      username: [''],
      password: [''],
      passwordRe: ['']
    });
   }

  ngOnInit(): void {}

  register(): void {
    console.log(this.registerForm.value);
    if (this.registerForm.invalid) {
      return;
    }

    let request: RegisterRequest = {
      username: this.registerForm.value.username,
      password: this.registerForm.value.password,
      passwordRe: this.registerForm.value.passwordRe,
    };

    console.log(request);
    this.authService.register(request)
      .subscribe({
        next: (response: AuthResponse) => this.onRegister(response),
        error: (err: HttpErrorResponse) => this.onError(err)
      });
  }

  onRegister(response: AuthResponse) {
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
