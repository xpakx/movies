from robyn import Robyn, ALLOW_CORS, WebSocket
from robyn.robyn import Request
from msgspec import json, Struct, ValidationError

app = Robyn(__file__)
ALLOW_CORS(app, origins=["http://localhost:4200"])
app.add_response_header("content-type", "application/json")
websocket = WebSocket(app, "/ws")


@app.exception
def handle_exception(error: ValidationError):
    return {"status_code": 400, "body": f"error msg: {error}", "headers": {}}


class Room(Struct):
    name: str
    title: str | None = None


@app.get("/")
async def testRoom(request) -> bytes:
    code = "bxeQrT"
    return json.encode({"name": "Test", "title": "Movie", "code": code})


@app.post("/room")
async def newRoom(request: Request) -> bytes:
    room: Room = json.decode(request.body, type=Room)
    code = "bxeQrT"
    return json.encode({"name": room.name, "title": room.title, "code": code})


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
    app.start(port=8080)
