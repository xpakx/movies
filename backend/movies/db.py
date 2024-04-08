from sqlalchemy.orm import Session
from .models import User


def get_user(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, user):
    db_user = User(**user)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
