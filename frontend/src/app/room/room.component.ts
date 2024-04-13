import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { ApiService } from '../api.service';
import { Room } from '../dto/room';
import { WebSocketSubject, webSocket } from "rxjs/webSocket";
import { Message } from '../dto/message';
import { environment } from 'src/environments/environment';
import { Router } from '@angular/router';


@Component({
  selector: 'app-room',
  templateUrl: './room.component.html',
  styleUrls: ['./room.component.css']
})
export class RoomComponent implements OnInit {
  name: String = "Room";
  code: String = "code";
  title: String = "Movie";
  user: String = "";
  users: String[] = [];
  owner: boolean = false;
  ownerUsername: String = "Test";
  conn?: RTCPeerConnection;
  connections: Map<String, RTCPeerConnection> = new Map();
  subject!: WebSocketSubject<any>;
  firstPlay: boolean = true;

  config?: RTCConfiguration = undefined;

  @ViewChild('fileInput') fileInput!: ElementRef;
  @ViewChild('videoNode') videoNode!: ElementRef;

  constructor(private service: ApiService, private router: Router) { }

  ngOnInit(): void {
    let username = localStorage.getItem("username");
    if (!username) {
      this.router.navigate(["/login"]);
      return;
    }
    this.user = username;

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
    this.owner = this.user == "Test"; // TODO
    let apiUrl = environment.apiUrl.replace(/^http/, 'ws');
    this.subject = webSocket(`${apiUrl}/ws`);

    this.subject.subscribe({
      next: (msg: any) => this.onMessage(msg),
      error: (err: any) => console.log(err),
      complete: () => console.log('complete')
    });
    this.sendMessage({command: "join-room", user: this.user, room: this.code});
    if (!this.owner) {
      this.getStream(); // TODO
    }
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
    this.firstPlay = true;
  }

  onPlay() {
    if (!this.owner) {
      return;
    }
    if (!this.firstPlay) {
      return;
    }
    this.firstPlay = false;
    this.replaceStream();
  }

  // owner
  startStream(user: String): void {
    let video = this.videoNode.nativeElement;
    if (video.captureStream) {
      let stream = video.captureStream();
      console.log('Captured stream from video with captureStream', stream);
      this.tryStream(stream, user);
    }
  }

  tryStream(stream: MediaStream, user: String) {
    console.log('Starting stream');
    this.checkVideo(stream);
    let newConnection = this.createRTCConnection(user);
    stream.getTracks().forEach(track => newConnection.addTrack(track, stream));
    newConnection.onnegotiationneeded = () => {
      newConnection.createOffer()
        .then((a) => this.onCreateOfferSuccessOwner(a, user))
        .catch((e) => this.onError(e));
    }
    this.connections.set(user, newConnection);
  }

  replaceStream(): void {
    let video = this.videoNode.nativeElement;
    if (video.captureStream) {
      let stream = video.captureStream();
      console.log('Captured stream from video with captureStream', stream);
      this.tryUpdateStream(stream);
    }
  }

  tryUpdateStream(stream: MediaStream) {
    console.log('Starting stream');
    this.checkVideo(stream);
    for (let user of this.users) {
      if (user !== this.user) {
        this.tryUpdateSingleStream(stream, user);
      }
    }
  }

  tryUpdateSingleStream(stream: MediaStream, user: String) {
    let connection = this.connections.get(user);
    if (connection) {
      console.log("Connection with", user, "present");
      let senders = connection.getSenders();
      let tracks = stream.getTracks();
      for (let i = 0; i < senders.length; i++) {
        if (senders[i].track?.kind == "video") {
          senders[i].replaceTrack(stream.getVideoTracks()[0]);
        } else {
          senders[i].replaceTrack(stream.getAudioTracks()[0]);
        }
      }
    } else {
      console.log("No connection yet with", user);
      let newConnection = this.createRTCConnection(user);
      stream.getTracks().forEach(track => newConnection.addTrack(track, stream));
      newConnection.onnegotiationneeded = () => {
        newConnection.createOffer()
          .then((a) => this.onCreateOfferSuccessOwner(a, user))
          .catch((e) => this.onError(e));
      }
      this.connections.set(user, newConnection);
    }
  }

  createRTCConnection(user: String | undefined = undefined): RTCPeerConnection {
    let conn = new RTCPeerConnection(this.config);
    conn.onicecandidate = (e) => this.onIceCandidate(e, user);
    conn.oniceconnectionstatechange = (e) => this.onIceStateChange(e);
    return conn;
  }

  // not owner
  getStream() {
    this.conn = this.createRTCConnection();
    this.conn.ontrack = (e) => {
      const stream = e.streams[0];
      console.log('Remote stream', stream);
      this.checkVideo(stream);
      let video = this.videoNode.nativeElement;
      if (!video.srcObject || video.srcObject.id !== stream.id) {
        console.log("Added stream");
        console.log(this.conn!.iceConnectionState);
        video.srcObject = stream;
        video.play();
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

  onIceCandidate(event: any, user: String | undefined ) {
    if (event.candidate) {
      if (user) {
        this.sendMessage({ 'candidate': event.candidate, 'user': this.user, 'room': this.code, 'command': 'candidate' });
      } else {
        this.sendMessage({ 'candidate': event.candidate, 'user': this.user, 'room': this.code, 'command': 'candidate', 'to': user });
      }
    }
  }

  onIceStateChange(e: any) {
    this.debugState();
  }

  onCreateOfferSuccess(desc: any) {
    this.conn!.setLocalDescription(desc)
      .then(() => this.sendMessage({ 'sdp': this.conn!.localDescription, 'user': this.user, 'room': this.code, 'command': 'sdp' }))
      .catch((e) => this.onError(e))
  }

  onCreateOfferSuccessOwner(desc: any, user: String) {
    let connection = this.connections.get(user)!;
    connection.setLocalDescription(desc)
      .then(() => this.sendMessage({ 'sdp': connection.localDescription, 'user': this.user, 'room': this.code, 'command': 'sdp', 'to': user }))
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
      if (this.owner) {
        this.onSdpMessageOwner(msg);
      } else  {
        this.onSdpMessageUser(msg);
      }
    } else if (msg.candidate) {
      console.log("candidate")
      if (this.owner) {
        console.log("for owner")
        this.onCandidateMessageOwner(msg);
      } else  {
        console.log("for user")
        this.onCandidateMessageUser(msg);
      }
    } else if (msg.command == "join-room") {
      this.users.push(msg.user);
      if (this.owner) {
        this.startStream(msg.user); // TODO
      }
    } else if (msg.command == "leave-room") {
      this.users = this.users.filter((u) => u != msg.user);
      if (msg.user == "Test") { // TODO
        this.conn!.close();
        this.conn = undefined;
      }
    } else if (msg.command == "enter-room" && msg.users) {
      this.users = msg.users;
    }
  }

  debugState() {
    if (this.owner) {
      for (let connection of this.connections) {
        console.log(connection[1].iceConnectionState);
      }
    } else {
      console.log(this.conn!.iceConnectionState);
    }
  }

  onSdpMessageUser(msg: Message) {
    console.log("user have connection")
    if (!this.conn) {
      this.getStream();
    }
    this.conn!.setRemoteDescription(new RTCSessionDescription(msg.sdp))
      .then(() => {
        console.log("offer");
        if (this.conn!.remoteDescription && this.conn!.remoteDescription.type === 'offer') {
          console.log("answering");
          this.conn!.createAnswer()
            .then((a) => this.onCreateOfferSuccess(a))
            .catch((e) => this.onError(e));
        }
      }).catch((e) => this.onError(e));

  }

  onSdpMessageOwner(msg: Message) {
    let connection = this.connections.get(msg.user)!;
    if (!connection) {
      return; // ??
    }
    connection.setRemoteDescription(new RTCSessionDescription(msg.sdp))
      .then(() => {
        console.log("offer");
      }).catch((e) => this.onError(e));
  }

  onCandidateMessageOwner(msg: Message) {
    let connection = this.connections.get(msg.user)!;
    if (!connection) {
      return; // ??
    }
    connection.addIceCandidate(
      new RTCIceCandidate(msg.candidate))
      .then(() => { })
      .catch((e) => this.onError(e))
  }

  onCandidateMessageUser(msg: Message) {
    console.log("user have candidate")
    if (!this.conn) {
      this.getStream();
    }
    this.conn!.addIceCandidate(
      new RTCIceCandidate(msg.candidate))
      .then(() => { })
      .catch((e) => this.onError(e))
  }

  isInFullScreen(): boolean {
    if (document.fullscreenElement) {
      return true;
    }
    return false;
  }

  toggleFullScreen() {
    let full = this.isInFullScreen();
    if (!full) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  @HostListener('window:keydown.o', ['$event'])
  openMovieOnKeyDown(event: KeyboardEvent) {
    event.preventDefault();
    this.openMovieChoice();
  }

  @HostListener('window:keydown.f', ['$event'])
  fullscreenOnKeyDown(event: KeyboardEvent) {
    event.preventDefault();
    this.toggleFullScreen();
  }

  @HostListener('document:fullscreenchange', ['$event']) 
  onFullScreen() {
    if (document.fullscreenElement) {
      window.scroll({top: 0, left: 0});
    }
  }

  copyLink() {
    let link = `${window.location.origin}/room/${this.code}`;
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(link)
        .then(() => console.log("copied"));
    } else {
      console.log("not secure context")
      // TODO?
    }
  }
}