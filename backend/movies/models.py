from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.engine.url import URL

url = URL.create(
        "postgresql",
        "root",
        "password",
        "localhost",
        5432,
        "movies")
engine = create_engine(url, echo=True)
Session = sessionmaker(bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)
