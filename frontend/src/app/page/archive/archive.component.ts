import { Component, OnInit } from '@angular/core';
import { Movie } from 'src/app/dto/movie';

@Component({
  selector: 'app-archive',
  templateUrl: './archive.component.html',
  styleUrls: ['./archive.component.css']
})
export class ArchiveComponent implements OnInit {
  movies: Movie[] = [];

  constructor() { }

  ngOnInit(): void {
  }

}
