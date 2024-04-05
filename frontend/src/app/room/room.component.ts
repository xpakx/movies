import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';

@Component({
  selector: 'app-room',
  templateUrl: './room.component.html',
  styleUrls: ['./room.component.css']
})
export class RoomComponent implements OnInit {
  name: String = "Room";
  code: String = "code"

  @ViewChild('fileInput') fileInput!: ElementRef;
  @ViewChild('videoNode') videoNode!: ElementRef;

  constructor() { }

  ngOnInit(): void {
  }

  openMovieChoice(): void {
    this.fileInput?.nativeElement.click();
  }

  loadMovie(event: Event): void {
    const element = event.currentTarget as HTMLInputElement;
    let files: FileList | null = element.files;
    if (!files || files.length < 1) {
      return;
    }
    var file = files[0];
    var canPlay = this.videoNode.nativeElement.canPlayType(file.type);

    if (canPlay === 'no' || canPlay == '') {
      return;
    }

    this.videoNode.nativeElement.src = URL.createObjectURL(file);

  }


}
