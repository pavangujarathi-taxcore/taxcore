from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
import os
from pymongo import MongoClient
from pymongo.collection import Collection
from bson import ObjectId

app = FastAPI(title="TaxCore API")

# CORS - Allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB Connection
MONGO_URL: str = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client: MongoClient = MongoClient(MONGO_URL)
db = client.taxcore

# Collections
users_col: Collection = db.users
clients_col: Collection = db.clients
documents_col: Collection = db.documents
work_col: Collection = db.work
billing_col: Collection = db.billing
firm_accounts_col: Collection = db.firm_accounts
audit_logs_col: Collection = db.audit_logs
settings_col: Collection = db.settings

# Helper function to convert MongoDB _id to string
def serialize_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Convert MongoDB _id to string for JSON serialization"""
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc

# Pydantic Models
class User(BaseModel):
    id: str
    email: str
    mobile: str
    password: str
    role: str
    firmId: Optional[str] = None
    createdAt: str

class Client(BaseModel):
    id: str
    name: str
    pan: str
    mobile: str
    email: Optional[str] = ""
    clientType: str
    headOfIncome: str
    businessName: Optional[str] = ""
    taxYear: str
    dueDate: str
    clientCategory: str
    createdAt: str
    createdBy: str

class DocumentInward(BaseModel):
    id: str
    clientId: str
    receivedDate: str
    documentList: str
    status: str
    remarks: Optional[str] = ""
    createdBy: str
    createdAt: str

class WorkProcessing(BaseModel):
    id: str
    clientId: str
    dateOfFiling: Optional[str] = ""
    acknowledgementNo: Optional[str] = ""
    status: str
    refundAmount: Optional[str] = ""
    eVerificationDate: Optional[str] = ""
    eVerificationStatus: str
    createdBy: str
    createdAt: str

class Billing(BaseModel):
    id: str
    clientId: str
    invoiceNo: str
    invoiceDate: str
    amount: str
    paymentStatus: str
    paymentDate: Optional[str] = ""
    createdBy: str
    createdAt: str

class FirmAccount(BaseModel):
    id: str
    email: str
    mobile: str
    password: str
    firmName: str
    trialExpiryDate: str
    isActive: bool
    createdAt: str

class AuditLog(BaseModel):
    id: str
    userId: str
    userName: str
    action: str
    entityType: str
    entityId: str
    details: str
    timestamp: str

class WhatsAppSettings(BaseModel):
    enabled: bool
    apiKey: str
    instanceId: str

# Health Check
@app.get("/")
def read_root() -> Dict[str, str]:
    """API health check endpoint"""
    return {
        "status": "ok",
        "message": "TaxCore API is running",
        "timestamp": datetime.now().isoformat()
    }

# =============================================================================
# USERS API
# =============================================================================

@app.get("/api/users")
def get_users() -> Dict[str, List[Dict[str, Any]]]:
    """Get all users from database"""
    users: List[Dict[str, Any]] = list(users_col.find({}))
    for user in users:
        serialize_doc(user)
    return {"users": users}

@app.post("/api/users")
def save_users(data: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Union[bool, int]]:
    """Save users to database using upsert"""
    users: List[Dict[str, Any]] = data.get("users", [])
    
    existing_ids = {str(u.get("id")) for u in users_col.find({}, {"id": 1, "_id": 0})}
    incoming_ids = {str(u.get("id")) for u in users}
    
    to_delete = existing_ids - incoming_ids
    if to_delete:
        users_col.delete_many({"id": {"$in": list(to_delete)}})
    
    for user in users:
        users_col.replace_one({"id": user.get("id")}, user, upsert=True)
    
    return {"success": True, "count": len(users)}

# =============================================================================
# CLIENTS API  
# =============================================================================

@app.get("/api/clients")
def get_clients() -> Dict[str, List[Dict[str, Any]]]:
    """Get all clients from database"""
    clients: List[Dict[str, Any]] = list(clients_col.find({}))
    for client in clients:
        serialize_doc(client)
    return {"clients": clients}

@app.post("/api/clients")
def save_clients(data: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Union[bool, int]]:
    """Save clients to database using upsert (no delete-all)"""
    clients: List[Dict[str, Any]] = data.get("clients", [])
    
    # Get existing client IDs from database
    existing_ids = {str(c.get("id")) for c in clients_col.find({}, {"id": 1, "_id": 0})}
    incoming_ids = {str(c.get("id")) for c in clients}
    
    # Delete clients that are no longer in the incoming list
    to_delete = existing_ids - incoming_ids
    if to_delete:
        clients_col.delete_many({"id": {"$in": list(to_delete)}})
    
    # Upsert each client
    for client in clients:
        clients_col.replace_one({"id": client.get("id")}, client, upsert=True)
    
    return {"success": True, "count": len(clients)}

# =============================================================================
# DOCUMENTS API
# =============================================================================

@app.get("/api/documents")
def get_documents() -> Dict[str, List[Dict[str, Any]]]:
    """Get all documents from database"""
    documents: List[Dict[str, Any]] = list(documents_col.find({}))
    for doc in documents:
        serialize_doc(doc)
    return {"documents": documents}

@app.post("/api/documents")
def save_documents(data: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Union[bool, int]]:
    """Save documents to database using upsert"""
    documents: List[Dict[str, Any]] = data.get("documents", [])
    
    existing_ids = {str(d.get("id")) for d in documents_col.find({}, {"id": 1, "_id": 0})}
    incoming_ids = {str(d.get("id")) for d in documents}
    
    to_delete = existing_ids - incoming_ids
    if to_delete:
        documents_col.delete_many({"id": {"$in": list(to_delete)}})
    
    for doc in documents:
        documents_col.replace_one({"id": doc.get("id")}, doc, upsert=True)
    
    return {"success": True, "count": len(documents)}

# =============================================================================
# WORK PROCESSING API
# =============================================================================

@app.get("/api/work")
def get_work() -> Dict[str, List[Dict[str, Any]]]:
    """Get all work processing records from database"""
    work: List[Dict[str, Any]] = list(work_col.find({}))
    for w in work:
        serialize_doc(w)
    return {"work": work}

@app.post("/api/work")
def save_work(data: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Union[bool, int]]:
    """Save work processing records to database using upsert"""
    work: List[Dict[str, Any]] = data.get("work", [])
    
    existing_ids = {str(w.get("id")) for w in work_col.find({}, {"id": 1, "_id": 0})}
    incoming_ids = {str(w.get("id")) for w in work}
    
    to_delete = existing_ids - incoming_ids
    if to_delete:
        work_col.delete_many({"id": {"$in": list(to_delete)}})
    
    for w in work:
        work_col.replace_one({"id": w.get("id")}, w, upsert=True)
    
    return {"success": True, "count": len(work)}

# =============================================================================
# BILLING API
# =============================================================================

@app.get("/api/billing")
def get_billing() -> Dict[str, List[Dict[str, Any]]]:
    """Get all billing records from database"""
    billing: List[Dict[str, Any]] = list(billing_col.find({}))
    for b in billing:
        serialize_doc(b)
    return {"billing": billing}

@app.post("/api/billing")
def save_billing(data: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Union[bool, int]]:
    """Save billing records to database using upsert"""
    billing: List[Dict[str, Any]] = data.get("billing", [])
    
    existing_ids = {str(b.get("id")) for b in billing_col.find({}, {"id": 1, "_id": 0})}
    incoming_ids = {str(b.get("id")) for b in billing}
    
    to_delete = existing_ids - incoming_ids
    if to_delete:
        billing_col.delete_many({"id": {"$in": list(to_delete)}})
    
    for b in billing:
        billing_col.replace_one({"id": b.get("id")}, b, upsert=True)
    
    return {"success": True, "count": len(billing)}

# =============================================================================
# FIRM ACCOUNTS API
# =============================================================================

@app.get("/api/firm-accounts")
def get_firm_accounts() -> Dict[str, List[Dict[str, Any]]]:
    """Get all firm accounts from database"""
    accounts: List[Dict[str, Any]] = list(firm_accounts_col.find({}))
    for acc in accounts:
        serialize_doc(acc)
    return {"firmAccounts": accounts}

@app.post("/api/firm-accounts")
def save_firm_accounts(data: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Union[bool, int]]:
    """Save firm accounts to database using upsert"""
    accounts: List[Dict[str, Any]] = data.get("firmAccounts", [])
    
    existing_ids = {str(a.get("id")) for a in firm_accounts_col.find({}, {"id": 1, "_id": 0})}
    incoming_ids = {str(a.get("id")) for a in accounts}
    
    to_delete = existing_ids - incoming_ids
    if to_delete:
        firm_accounts_col.delete_many({"id": {"$in": list(to_delete)}})
    
    for acc in accounts:
        firm_accounts_col.replace_one({"id": acc.get("id")}, acc, upsert=True)
    
    return {"success": True, "count": len(accounts)}

# =============================================================================
# AUDIT LOGS API
# =============================================================================

@app.get("/api/audit-logs")
def get_audit_logs() -> Dict[str, List[Dict[str, Any]]]:
    """Get all audit logs from database"""
    logs: List[Dict[str, Any]] = list(audit_logs_col.find({}))
    for log in logs:
        serialize_doc(log)
    return {"auditLogs": logs}

@app.post("/api/audit-logs")
def save_audit_logs(data: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Union[bool, int]]:
    """Save audit logs to database (append only)"""
    logs: List[Dict[str, Any]] = data.get("auditLogs", [])
    if logs:
        # Don't delete existing logs, append only
        for log in logs:
            if not audit_logs_col.find_one({"id": log.get("id")}):
                audit_logs_col.insert_one(log)
    return {"success": True, "count": len(logs)}

# =============================================================================
# SETTINGS API
# =============================================================================

@app.get("/api/settings")
def get_settings() -> Dict[str, Any]:
    """Get application settings from database"""
    settings: Optional[Dict[str, Any]] = settings_col.find_one({"_id": "main"})
    if settings:
        serialize_doc(settings)
        return settings
    return {
        "superAdminCreated": False,
        "whatsAppSettings": None
    }

@app.post("/api/settings")
def save_settings(data: Dict[str, Any]) -> Dict[str, bool]:
    """Save application settings to database"""
    data["_id"] = "main"
    settings_col.replace_one({"_id": "main"}, data, upsert=True)
    return {"success": True}

# =============================================================================
# SYNC ALL DATA (Initial Load)
# =============================================================================

@app.get("/api/sync/all")
def sync_all() -> Dict[str, Any]:
    """Get all data in one call - for initial load and real-time sync"""
    return {
        "users": [serialize_doc(u) for u in users_col.find({})],
        "clients": [serialize_doc(c) for c in clients_col.find({})],
        "documents": [serialize_doc(d) for d in documents_col.find({})],
        "work": [serialize_doc(w) for w in work_col.find({})],
        "billing": [serialize_doc(b) for b in billing_col.find({})],
        "firmAccounts": [serialize_doc(f) for f in firm_accounts_col.find({})],
        "auditLogs": [serialize_doc(a) for a in audit_logs_col.find({})],
        "settings": settings_col.find_one({"_id": "main"}) or {
            "superAdminCreated": False,
            "whatsAppSettings": None
        }
    }

# =============================================================================
# LAST SYNC TIMESTAMP
# =============================================================================

@app.get("/api/sync/timestamp")
def get_last_sync() -> Dict[str, str]:
    """Returns server timestamp for sync verification"""
    return {"timestamp": datetime.now().isoformat()}

# =============================================================================
# EXPORT STATUS API
# =============================================================================

@app.get("/api/exports/status")
def get_export_status() -> Dict[str, Any]:
    """Get status of automated exports"""
    import glob
    
    export_dir: str = "/app/exports"
    if not os.path.exists(export_dir):
        return {"enabled": True, "exports": 0, "latest": None}
    
    # Get all export files
    export_files: List[str] = glob.glob(os.path.join(export_dir, "TaxCore_AutoExport_*.xlsx"))
    export_files.sort(reverse=True)
    
    latest_export: Optional[Dict[str, Union[str, int]]] = None
    if export_files:
        latest_file: str = export_files[0]
        file_stat = os.stat(latest_file)
        latest_export = {
            "filename": os.path.basename(latest_file),
            "size": file_stat.st_size,
            "created": datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
        }
    
    return {
        "enabled": True,
        "schedule": "Daily at 10:00 PM (22:00)",
        "export_count": len(export_files),
        "latest_export": latest_export,
        "retention_days": 30,
        "export_directory": export_dir,
    }

@app.get("/api/exports/list")
def list_exports() -> Dict[str, Any]:
    """List all available export files"""
    import glob
    
    export_dir: str = "/app/exports"
    if not os.path.exists(export_dir):
        return {"exports": []}
    
    export_files: List[str] = glob.glob(os.path.join(export_dir, "TaxCore_AutoExport_*.xlsx"))
    export_files.sort(reverse=True)
    
    exports: List[Dict[str, Union[str, int, float]]] = []
    for filepath in export_files[:30]:  # Last 30 exports
        file_stat = os.stat(filepath)
        exports.append({
            "filename": os.path.basename(filepath),
            "size": file_stat.st_size,
            "size_kb": round(file_stat.st_size / 1024, 2),
            "created": datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
            "download_url": f"/api/exports/download/{os.path.basename(filepath)}",
        })
    
    return {"exports": exports, "total": len(exports)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
