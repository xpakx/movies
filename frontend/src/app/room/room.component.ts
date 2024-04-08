import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ApiService } from '../api.service';
import { Room } from '../dto/room';
import { WebSocketSubject, webSocket } from "rxjs/webSocket";
import { Message } from '../dto/message';
import { environment } from 'src/environments/environment';


@Component({
  selector: 'app-room',
  templateUrl: './room.component.html',
  styleUrls: ['./room.component.css']
})
export class RoomComponent implements OnInit {
  name: String = "Room";
  code: String = "code"
  title: String = "Movie"
  user: String = "User"
  owner: boolean = true;
  conn!: RTCPeerConnection;
  subject!: WebSocketSubject<any>;

  config?: RTCConfiguration = undefined;

  @ViewChild('fileInput') fileInput!: ElementRef;
  @ViewChild('videoNode') videoNode!: ElementRef;

  constructor(private service: ApiService) { }

  ngOnInit(): void {
    this.user = this.user + Date.now().toString();
    this.service.getRoom().subscribe({
      next: (response: Room) => this.onRoom(response),
    });
  }

  ngOnDestroy(): void {
    this.subject.complete();
  }

  onRoom(room: Room) {
    this.name = room.name;
    this.title = room.title;
    this.code = room.code;
    let apiUrl = environment.apiUrl.replace(/^http/, 'ws');
    this.subject = webSocket(`${apiUrl}/ws`);
    this.createRTCConnection();

    this.subject.subscribe({
      next: (msg: any) => this.onMessage(msg),
      error: (err: any) => console.log(err),
      complete: () => console.log('complete')
    });
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

    if (canPlay === 'no' || canPlay === '') {
      return;
    }

    this.videoNode.nativeElement.src = URL.createObjectURL(file);
  }

  // owner
  startStream(): void {
    let video = this.videoNode.nativeElement;
    if (video.captureStream) {
      let stream = video.captureStream();
      console.log('Captured stream from video with captureStream', stream);
      this.tryStream(stream);
    }
  }

  tryStream(stream: MediaStream) {
    console.log('Starting stream');
    this.checkVideo(stream);
    stream.getTracks().forEach(track => this.conn.addTrack(track, stream));
    this.conn.onnegotiationneeded = () => {
      this.conn.createOffer()
        .then((a) => this.onCreateOfferSuccess(a))
        .catch((e) => this.onError(e));
    }
  }

  createRTCConnection() {
    this.conn = new RTCPeerConnection(this.config);
    this.conn.onicecandidate = (e) => this.onIceCandidate(e);
    this.conn.oniceconnectionstatechange = (e) => this.onIceStateChange(e);
  }

  // not owner
  getStream() {
    this.conn.ontrack = (e) => {
      const stream = e.streams[0];
      console.log('Remote stream', stream);
      this.checkVideo(stream);
      let video = this.videoNode.nativeElement;
      if (!video.srcObject || video.srcObject.id !== stream.id) {
        console.log("Added stream");
        console.log(this.conn.iceConnectionState);
        video.srcObject = stream;
      }
    };
  }

  checkVideo(stream: MediaStream) {
    console.log("Video tracks:");
    this.checkTracks(stream.getVideoTracks());
    console.log("Audio tracks:");
    this.checkTracks(stream.getAudioTracks());
  }

  checkTracks(tracks: MediaStreamTrack[]) {
    console.log(`${tracks.length} tracks`)
    if (tracks.length > 0) {
      console.log(`Using track: ${tracks[0].label}`);
      console.log(tracks[0]);
    }
  }

  onIceCandidate(event: any) {
    if (event.candidate) {
      this.sendMessage({ 'candidate': event.candidate, 'user': this.user, 'room': this.code });
    }
  }

  onIceStateChange(e: any) {
    this.debugState();
  }

  onCreateOfferSuccess(desc: any) {
    this.conn.setLocalDescription(desc)
      .then(() => this.sendMessage({ 'sdp': this.conn.localDescription, 'user': this.user, 'room': this.code }))
      .catch((e) => this.onError(e))
  }

  onError(e: any) {

  }

  sendMessage(msg: Message) {
    this.subject.next(msg);
  }

  onMessage(msg: Message) {
    if (msg.user == this.user) {
      return;
    }
    console.log(msg);
    if (msg.sdp) {
      this.conn.setRemoteDescription(new RTCSessionDescription(msg.sdp))
      .then(() => {
        console.log("offer");
        if (this.conn.remoteDescription && this.conn.remoteDescription.type === 'offer') {
          console.log("answering");
          this.conn.createAnswer()
          .then((a) => this.onCreateOfferSuccess(a))
          .catch((e) => this.onError(e));
        }
      }).catch((e) => this.onError(e));
    } else if (msg.candidate) {
      this.conn.addIceCandidate(
        new RTCIceCandidate(msg.candidate))
        .then(() => {})
        .catch((e) => this.onError(e))
    }
  }

  debugState() {
    console.log(this.conn.iceConnectionState);
  }
}