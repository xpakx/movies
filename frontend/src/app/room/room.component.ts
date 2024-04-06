import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';

@Component({
  selector: 'app-room',
  templateUrl: './room.component.html',
  styleUrls: ['./room.component.css']
})
export class RoomComponent implements OnInit {
  name: String = "Room";
  code: String = "code"
  title: String = "Movie"
  owner: boolean = true;
  conn!: RTCPeerConnection;

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

    this.conn = new RTCPeerConnection(undefined);
    this.conn.onicecandidate = (e) => this.onIceCandidate(e);
    this.conn.onnegotiationneeded = () => {
      this.conn.createOffer()
        .then((a) => this.onCreateOfferSuccess(a))
        .catch((e) => this.onError(e));
    }
    this.conn.oniceconnectionstatechange = (e) => this.onIceStateChange(e);
    stream.getTracks().forEach(track => this.conn.addTrack(track, stream));
  }

  // not owner
  getStream() {
    this.conn = new RTCPeerConnection(undefined);
    this.conn.onicecandidate = (e) => this.onIceCandidate(e);
    this.conn.onnegotiationneeded = () => {
      this.conn.createOffer()
        .then((a) => this.onCreateOfferSuccess(a))
        .catch((e) => this.onError(e));
    }
    this.conn.oniceconnectionstatechange = (e) => this.onIceStateChange(e);
    this.conn.ontrack = (e) => {
      const stream = e.streams[0];
      let video = this.videoNode.nativeElement;
      if (!video.srcObject || video.srcObject.id !== stream.id) {
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
      this.sendMessage({ 'candidate': event.candidate });
    }
  }

  onIceStateChange(e: any) {

  }

  onCreateOfferSuccess(desc: any) {
    this.conn.setLocalDescription(desc)
      .then(() => this.sendMessage({ 'sdp': this.conn.localDescription }))
      .catch((e) => this.onError(e))
  }

  onError(e: any) {

  }

  sendMessage(e: any) {
    // TODO: Send to signalling server
  }

  // TODO: message from signalling server
  onMessage(msg: any) {
    if (msg.sdp) {
      this.conn.setRemoteDescription(new RTCSessionDescription(msg.sdp))
      .then(() => {
        if (this.conn.remoteDescription && this.conn.remoteDescription.type === 'offer') {
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
}