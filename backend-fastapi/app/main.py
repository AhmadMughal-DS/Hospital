from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.queue import router as queue_router

app = FastAPI(
    title="HMS Queue Service",
    version="0.1.0",
    description="Real-time OPD queue service for Hospital Management System",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "queue"}


app.include_router(queue_router)
