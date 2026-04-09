from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.user import User
from app.auth.dependencies import get_current_active_user
from app.services.stats_service import StatsService

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/overview")
async def get_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return StatsService(db).get_overview(current_user)


@router.get("/recent-plans")
async def get_recent_plans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return StatsService(db).get_recent_plans(current_user)


@router.get("/incomplete-plans")
async def get_incomplete_plans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return StatsService(db).get_incomplete_plans(current_user)


@router.get("/classification-distribution")
async def get_classification_distribution(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return StatsService(db).get_classification_distribution(current_user)
