from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from backend.retrieval.vectorstore import (
    list_collections,
    delete_collection,
    get_collection_files,
    delete_file_from_collection,
    get_or_create_collection,
)

router = APIRouter(prefix="/api/collections", tags=["collections"])


class CollectionCreate(BaseModel):
    name: str


@router.get("")
def get_collections():
    return list_collections()


@router.post("", status_code=201)
def create_collection(body: CollectionCreate):
    get_or_create_collection(body.name)
    return {"name": body.name, "created": True}


@router.delete("/{name}")
def remove_collection(name: str):
    try:
        delete_collection(name)
        return {"deleted": True}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{name}/files")
def get_files(name: str):
    files = get_collection_files(name)
    return {"collection": name, "files": files}


@router.delete("/{name}/files/{file_id:path}")
def remove_file(name: str, file_id: str):
    deleted = delete_file_from_collection(name, file_id)
    return {"deleted": deleted, "file": file_id}
