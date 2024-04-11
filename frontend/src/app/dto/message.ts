export interface Message {
    user: String,
    room: String,
    sdp?: any,
    candidate?: any,
    command: String;
}