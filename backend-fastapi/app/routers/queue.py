from collections import deque
from itertools import count

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.schemas import QueueState, QueueToken, QueueTokenCreate

router = APIRouter(prefix="/api/v1/queue", tags=["queue"])

_token_counter = count(1)
_waiting: deque[QueueToken] = deque()
_current: QueueToken | None = None
_connections: set[WebSocket] = set()


def _next_token_number() -> str:
    return f"Q{next(_token_counter):04d}"


async def _broadcast_state() -> None:
    if not _connections:
        return
    payload = QueueState(current=_current, waiting_count=len(_waiting), queue=list(_waiting)).model_dump_json()
    closed: list[WebSocket] = []
    for ws in _connections:
        try:
            await ws.send_text(payload)
        except RuntimeError:
            closed.append(ws)
    for ws in closed:
        _connections.discard(ws)


@router.post("/tokens/generate", response_model=QueueToken)
async def generate_token(request: QueueTokenCreate) -> QueueToken:
    token = QueueToken(
        token_number=_next_token_number(),
        patient_id=request.patient_id,
        doctor_id=request.doctor_id,
        status="GENERATED",
    )
    if request.is_priority:
        _waiting.appendleft(token)
    else:
        _waiting.append(token)
    await _broadcast_state()
    return token


@router.put("/tokens/next", response_model=QueueToken | None)
async def call_next_token() -> QueueToken | None:
    global _current
    if not _waiting:
        _current = None
        await _broadcast_state()
        return None

    _current = _waiting.popleft()
    _current.status = "CALLED"
    await _broadcast_state()
    return _current


@router.get("/tokens/current", response_model=QueueState)
async def get_current_state() -> QueueState:
    return QueueState(current=_current, waiting_count=len(_waiting), queue=list(_waiting))


@router.websocket("/live")
async def live_queue(ws: WebSocket):
    await ws.accept()
    _connections.add(ws)
    try:
        await ws.send_json(QueueState(current=_current, waiting_count=len(_waiting), queue=list(_waiting)).model_dump())
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        _connections.discard(ws)
