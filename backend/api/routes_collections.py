from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend.retrieval.vectorstore import (
    list_collections,
    delete_collection,
    get_collection_files,
    delete_file_from_collection,
    get_or_create_collection,
    get_collection_chunks,
)
from backend.workspaces import DEFAULT_WORKSPACE, prefix_of, to_internal, to_display

router = APIRouter(prefix="/api/collections", tags=["collections"])


class CollectionCreate(BaseModel):
    name: str


@router.get("")
def get_collections(workspace: str = DEFAULT_WORKSPACE):
    pfx = prefix_of(workspace)
    return [
        {"name": to_display(workspace, c["name"]), "count": c["count"]}
        for c in list_collections()
        if c["name"].startswith(pfx)
    ]


@router.post("", status_code=201)
def create_collection(body: CollectionCreate, workspace: str = DEFAULT_WORKSPACE):
    get_or_create_collection(to_internal(workspace, body.name))
    return {"name": body.name, "created": True}


@router.delete("/{name}")
def remove_collection(name: str, workspace: str = DEFAULT_WORKSPACE):
    try:
        delete_collection(to_internal(workspace, name))
        return {"deleted": True}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{name}/files")
def get_files(name: str, workspace: str = DEFAULT_WORKSPACE):
    files = get_collection_files(to_internal(workspace, name))
    return {"collection": name, "files": files}


@router.get("/{name}/chunks")
def get_chunks(
    name: str,
    file: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    workspace: str = DEFAULT_WORKSPACE,
):
    try:
        result = get_collection_chunks(
            to_internal(workspace, name), source_file=file, limit=limit, offset=offset
        )
        result["collection"] = name
        return result
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{name}/files/{file_id:path}")
def remove_file(name: str, file_id: str, workspace: str = DEFAULT_WORKSPACE):
    deleted = delete_file_from_collection(to_internal(workspace, name), file_id)
    return {"deleted": deleted, "file": file_id}
