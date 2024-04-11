from robyn import Robyn, ALLOW_CORS, WebSocket, WebSocketConnector, logger
from robyn.robyn import Request
from msgspec import json, Struct, ValidationError
from db import create_user, get_user
from models import Base, engine, Session
from datetime import datetime, timedelta, UTC
from jose import jwt
from bcrypt import hashpw, checkpw, gensalt
from sqids import Sqids
from typing import Dict, List, Optional, Any

app = Robyn(__file__)
ALLOW_CORS(app, origins=["http://192.168.50.212:4200"])
app.add_response_header("content-type", "application/json")
websocket = WebSocket(app, "/ws")
SECRET = "secret"
Base.metadata.create_all(bind=engine)
sqids = Sqids(min_length=6)


@app.exception
def handle_exception(error: ValidationError):
    return {"status_code": 400, "body": f"error msg: {error}", "headers": {}}


class ActiveRoom:
    id: int
    name: str
    title: str
    owner: str
    clients: List[str]


class Room(Struct):
    name: str
    title: str | None = None


class Register(Struct):
    username: str
    password: str
    passwordRe: str


class Login(Struct):
    username: str
    password: str


clients: Dict[str, str] = {}  # websocket_id -> joined room code
rooms: Dict[str, ActiveRoom] = {}  # code -> room
user_to_id: Dict[str, str] = {}  # username -> websocket_id
id_to_user: Dict[str, str] = {}  # websocket_id -> username
test_room = ActiveRoom()
test_room.id = 1
test_room.name = "A room"
test_room.title = "test movie"
test_room.owner = "Test"
test_room.clients = []
code = sqids.encode([test_room.id])
rooms[code] = test_room


@app.get("/")
async def testRoom(request) -> bytes:
    room_id = 1
    code = sqids.encode([room_id])
    return json.encode({"name": "Test", "title": "Movie", "code": code})


@app.post("/room")
async def newRoom(request: Request) -> bytes:
    room: Room = json.decode(request.body, type=Room)
    id = 1  # TODO
    code = sqids.encode([id])
    return json.encode({"name": room.name, "title": room.title, "code": code})


@app.post("/register")
async def register(request: Request) -> bytes:
    logger.info("Register")
    req: Register = json.decode(request.body, type=Register)
    if req.password != req.passwordRe:
        raise ValidationError("Passwords must match!")
    password = hashpw(req.password.encode('utf-8'), gensalt()).decode()
    with Session() as db:
        result = create_user(
                db,
                {"username": req.username, "password": password}
            )
    if result is None:
        raise Exception("User not added")
    token = create_token({"sub": result.username, "id": result.id})
    return json.encode({"username": req.username, "token": token})


@app.options("/register")
async def register_options() -> bytes:
    return json.encode({"status": "ok"})


def create_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET, algorithm="HS256")
    return encoded_jwt


@app.post("/authenticate")
async def login(request: Request) -> bytes:
    logger.info("Login")
    req: Login = json.decode(request.body, type=Login)
    with Session() as db:
        result = get_user(db, req.username)
    if result is None:
        raise Exception("No such user!")
    if checkpw(req.password.encode('utf-8'),
               result.password.encode('utf-8')):
        token = create_token({"sub": result.username, "id": result.id})
        return json.encode({"username": req.username, "token": token})
    raise Exception("Wrong password!")


@app.options("/authenticate")
async def login_options() -> bytes:
    return json.encode({"status": "ok"})


class WsMessage(Struct):
    command: str
    user: str
    room: str
    sdp: Optional[Any] = None
    candidate: Optional[Any] = None
    to: Optional[str] = None


@websocket.on("message")
def message(ws: WebSocketConnector, msg: str) -> None:
    logger.info("Msg from " + ws.id + ": " + msg)
    wsmsg: WsMessage = json.decode(msg, type=WsMessage)
    if wsmsg.command == "join-room":
        result = join(ws.id, wsmsg.room, wsmsg.user)
        if result:
            broadcast_room(ws, wsmsg.room, msg)
            logger.info("User " + wsmsg.user + " joined room " + wsmsg.room)
            ws.sync_send_to(ws.id, '{"msg": "Joined room"}')
        else:
            ws.sync_send_to(ws.id, '{"msg": "Room not created"}')
    elif wsmsg.command == "sdp" or wsmsg.command == "candidate":
        room = rooms.get(wsmsg.room)
        if room:
            owner = user_to_id.get(room.owner)
            if not owner:
                pass
            elif owner == ws.id and wsmsg.to:
                address = user_to_id.get(wsmsg.to)
                if address:
                    ws.sync_send_to(address, msg)
            elif owner != ws.id:
                ws.sync_send_to(owner, msg)
    elif wsmsg.command == "chat":
        broadcast_room(ws, wsmsg.room, msg)


@websocket.on("close")
def close(ws: WebSocketConnector):
    logger.info("User " + ws.id + " disconnected")
    code: Optional[str] = clients.pop(ws.id, None)
    if code:
        room = rooms[code]
        if room:
            room.clients.remove(ws.id)
    username = id_to_user.pop(ws.id, None)
    if username:
        user_to_id.pop(username, None)
    return '{"msg": "End of ws."}'


@websocket.on("connect")
def connect(ws: WebSocketConnector):
    logger.info("User " + ws.id + " connected")
    return '{"msg": "Connected to ws!"}'


def join(ws_id: str, room_code: str, user: str) -> bool:
    if ws_id in clients:
        code = clients[ws_id]
        room = rooms[code]
        if room:
            room.clients.remove(ws_id)
    if room_code in rooms:
        rooms[room_code].clients.append(ws_id)
        clients[ws_id] = room_code
        user_to_id[user] = ws_id
        id_to_user[ws_id] = user
        return True
    else:
        clients.pop(ws_id, None)
        return False


def broadcast_room(ws: WebSocketConnector, code: str, msg: str):
    room = rooms[code]
    if room:
        for client in room.clients:
            if client != ws.id:
                ws.sync_send_to(client, msg)


if __name__ == "__main__":
    app.start(port=8080, host="0.0.0.0")
