import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
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
  code: String = "code"
  title: String = "Movie"
  user: String = ""
  owner: boolean = false;
  conn!: RTCPeerConnection;
  connections: Map<String, RTCPeerConnection> = new Map();
  subject!: WebSocketSubject<any>;

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
    let newConnection = this.createRTCConnection();
    stream.getTracks().forEach(track => newConnection.addTrack(track, stream));
    newConnection.onnegotiationneeded = () => {
      newConnection.createOffer()
        .then((a) => this.onCreateOfferSuccessOwner(a, user))
        .catch((e) => this.onError(e));
    }
    this.connections.set(user, newConnection);
  }

  createRTCConnection(): RTCPeerConnection {
    let conn = new RTCPeerConnection(this.config);
    conn.onicecandidate = (e) => this.onIceCandidate(e);
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
        console.log(this.conn.iceConnectionState);
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

  onIceCandidate(event: any) {
    if (event.candidate) {
      this.sendMessage({ 'candidate': event.candidate, 'user': this.user, 'room': this.code, 'command': 'candidate' });
    }
  }

  onIceStateChange(e: any) {
    this.debugState();
  }

  // TODO
  onCreateOfferSuccess(desc: any) {
    this.conn.setLocalDescription(desc)
      .then(() => this.sendMessage({ 'sdp': this.conn.localDescription, 'user': this.user, 'room': this.code, 'command': 'sdp' }))
      .catch((e) => this.onError(e))
  }

  // TODO
  onCreateOfferSuccessOwner(desc: any, user: String) {
    let connection = this.connections.get(user)!;
    connection.setLocalDescription(desc)
      .then(() => this.sendMessage({ 'sdp': connection.localDescription, 'user': this.user, 'room': this.code, 'command': 'sdp' }))
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
    } else if (msg.command == "join-room" && this.owner) {
      this.startStream(msg.user); // TODO
    }
  }

  debugState() {
    if (this.owner) {
      for (let connection of this.connections) {
        console.log(connection[1].iceConnectionState); // TODO
      }
    } else {
      console.log(this.conn.iceConnectionState); // TODO
    }
  }

  onSdpMessageUser(msg: Message) {
    console.log("user have connection")
    if (!this.conn) {
      this.getStream();
    console.log("stream")
    }
    console.log("desc")
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

  }

  onSdpMessageOwner(msg: Message) {
    let connection = this.connections.get(msg.user)!;
    if (!connection) {
      return; // ??
    }
    connection.setRemoteDescription(new RTCSessionDescription(msg.sdp))
      .then(() => {
        console.log("offer");
        if (connection.remoteDescription && connection.remoteDescription.type === 'offer') {
          console.log("answering");
          this.conn.createAnswer()
            .then((a) => this.onCreateOfferSuccessOwner(a, msg.user))
            .catch((e) => this.onError(e));
        }
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
    this.conn.addIceCandidate(
      new RTCIceCandidate(msg.candidate))
      .then(() => { })
      .catch((e) => this.onError(e))
  }
}