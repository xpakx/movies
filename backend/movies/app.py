from robyn import Robyn, ALLOW_CORS, WebSocket, logger
from robyn.robyn import Request
from msgspec import json, Struct, ValidationError
from db import create_user, get_user
from models import Base, engine, Session
from datetime import datetime, timedelta
from jose import jwt
from bcrypt import hashpw, checkpw, gensalt

app = Robyn(__file__)
ALLOW_CORS(app, origins=["http://192.168.50.212:4200"])
app.add_response_header("content-type", "application/json")
websocket = WebSocket(app, "/ws")
SECRET = "secret"
Base.metadata.create_all(bind=engine)


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


class Login(Struct):
    username: str
    password: str


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
    expire = datetime.utcnow() + timedelta(minutes=15)
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
