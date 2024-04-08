from robyn import Robyn, ALLOW_CORS, WebSocket
from robyn.robyn import Request
from msgspec import json, Struct, ValidationError
from .db import create_user
from sqlalchemy import Session
from datetime import datetime, timedelta
from jose import jwt

app = Robyn(__file__)
ALLOW_CORS(app, origins=["http://192.168.50.212:4200"])
app.add_response_header("content-type", "application/json")
websocket = WebSocket(app, "/ws")
SECRET = "secret"


@app.exception
def handle_exception(error: ValidationError):
    return {"status_code": 400, "body": f"error msg: {error}", "headers": {}}


class Room(Struct):
    name: str
    title: str | None = None


class Register(Struct):
    username: str
    password: str
    passwordRe: str


@app.get("/")
async def testRoom(request) -> bytes:
    code = "bxeQrT"
    return json.encode({"name": "Test", "title": "Movie", "code": code})


@app.post("/room")
async def newRoom(request: Request) -> bytes:
    room: Room = json.decode(request.body, type=Room)
    code = "bxeQrT"
    return json.encode({"name": room.name, "title": room.title, "code": code})


@app.post("/register")
async def register(request: Request) -> bytes:
    req: Register = json.decode(request.body, type=Register)
    # TODO: check passwords
    # TODO: encode password
    with Session() as db:
        result = create_user(
                db,
                {"username": req.username, "password": req.password}
            )
    if result is None:
        raise Exception("User not added")
    token = create_token({"sub": result.username, "id": result.id})
    return json.encode({"username": req.username, "token": token})


def create_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET, algorithm="HS256")
    return encoded_jwt


@websocket.on("message")
def message(ws, msg: str) -> str:
    ws.sync_broadcast(msg)
    '{"msg": "End of ws."}'


@websocket.on("close")
def close():
    return '{"msg": "End of ws."}'


@websocket.on("connect")
def connect():
    return '{"msg": "Connected to ws!"}'


if __name__ == "__main__":
    app.start(port=8080, host="0.0.0.0")
