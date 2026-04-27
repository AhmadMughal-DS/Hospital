from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class QueueTokenCreate(BaseModel):
    patient_id: str | None = None
    doctor_id: str | None = None
    is_priority: bool = False


class QueueToken(BaseModel):
    token_number: str
    patient_id: str | None = None
    doctor_id: str | None = None
    status: Literal["GENERATED", "CALLED", "IN_PROGRESS", "COMPLETED"] = "GENERATED"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class QueueState(BaseModel):
    current: QueueToken | None
    waiting_count: int
    queue: list[QueueToken]
