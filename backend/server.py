from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import os
from pymongo import MongoClient
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
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client = MongoClient(MONGO_URL)
db = client.taxcore

# Collections
users_col = db.users
clients_col = db.clients
documents_col = db.documents
work_col = db.work
billing_col = db.billing
firm_accounts_col = db.firm_accounts
audit_logs_col = db.audit_logs
settings_col = db.settings

# Helper function to convert MongoDB _id to string
def serialize_doc(doc):
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
def read_root():
    return {"status": "ok", "message": "TaxCore API is running", "timestamp": datetime.now().isoformat()}

# =============================================================================
# USERS API
# =============================================================================

@app.get("/api/users")
def get_users():
    users = list(users_col.find({}))
    for user in users:
        serialize_doc(user)
    return {"users": users}

@app.post("/api/users")
def save_users(data: Dict[str, List[Dict]]):
    users = data.get("users", [])
    if users:
        users_col.delete_many({})
        users_col.insert_many(users)
    return {"success": True, "count": len(users)}

# =============================================================================
# CLIENTS API  
# =============================================================================

@app.get("/api/clients")
def get_clients():
    clients = list(clients_col.find({}))
    for client in clients:
        serialize_doc(client)
    return {"clients": clients}

@app.post("/api/clients")
def save_clients(data: Dict[str, List[Dict]]):
    clients = data.get("clients", [])
    if clients:
        clients_col.delete_many({})
        clients_col.insert_many(clients)
    return {"success": True, "count": len(clients)}

# =============================================================================
# DOCUMENTS API
# =============================================================================

@app.get("/api/documents")
def get_documents():
    documents = list(documents_col.find({}))
    for doc in documents:
        serialize_doc(doc)
    return {"documents": documents}

@app.post("/api/documents")
def save_documents(data: Dict[str, List[Dict]]):
    documents = data.get("documents", [])
    if documents:
        documents_col.delete_many({})
        documents_col.insert_many(documents)
    return {"success": True, "count": len(documents)}

# =============================================================================
# WORK PROCESSING API
# =============================================================================

@app.get("/api/work")
def get_work():
    work = list(work_col.find({}))
    for w in work:
        serialize_doc(w)
    return {"work": work}

@app.post("/api/work")
def save_work(data: Dict[str, List[Dict]]):
    work = data.get("work", [])
    if work:
        work_col.delete_many({})
        work_col.insert_many(work)
    return {"success": True, "count": len(work)}

# =============================================================================
# BILLING API
# =============================================================================

@app.get("/api/billing")
def get_billing():
    billing = list(billing_col.find({}))
    for b in billing:
        serialize_doc(b)
    return {"billing": billing}

@app.post("/api/billing")
def save_billing(data: Dict[str, List[Dict]]):
    billing = data.get("billing", [])
    if billing:
        billing_col.delete_many({})
        billing_col.insert_many(billing)
    return {"success": True, "count": len(billing)}

# =============================================================================
# FIRM ACCOUNTS API
# =============================================================================

@app.get("/api/firm-accounts")
def get_firm_accounts():
    accounts = list(firm_accounts_col.find({}))
    for acc in accounts:
        serialize_doc(acc)
    return {"firmAccounts": accounts}

@app.post("/api/firm-accounts")
def save_firm_accounts(data: Dict[str, List[Dict]]):
    accounts = data.get("firmAccounts", [])
    if accounts:
        firm_accounts_col.delete_many({})
        firm_accounts_col.insert_many(accounts)
    return {"success": True, "count": len(accounts)}

# =============================================================================
# AUDIT LOGS API
# =============================================================================

@app.get("/api/audit-logs")
def get_audit_logs():
    logs = list(audit_logs_col.find({}))
    for log in logs:
        serialize_doc(log)
    return {"auditLogs": logs}

@app.post("/api/audit-logs")
def save_audit_logs(data: Dict[str, List[Dict]]):
    logs = data.get("auditLogs", [])
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
def get_settings():
    settings = settings_col.find_one({"_id": "main"})
    if settings:
        serialize_doc(settings)
        return settings
    return {
        "superAdminCreated": False,
        "whatsAppSettings": None
    }

@app.post("/api/settings")
def save_settings(data: Dict[str, Any]):
    data["_id"] = "main"
    settings_col.replace_one({"_id": "main"}, data, upsert=True)
    return {"success": True}

# =============================================================================
# SYNC ALL DATA (Initial Load)
# =============================================================================

@app.get("/api/sync/all")
def sync_all():
    """Get all data in one call - for initial load"""
    return {
        "users": [serialize_doc(u) for u in users_col.find({})],
        "clients": [serialize_doc(c) for c in clients_col.find({})],
        "documents": [serialize_doc(d) for d in documents_col.find({})],
        "work": [serialize_doc(w) for w in work_col.find({})],
        "billing": [serialize_doc(b) for b in billing_col.find({})],
        "firmAccounts": [serialize_doc(f) for f in firm_accounts_col.find({})],
        "auditLogs": [serialize_doc(a) for a in audit_logs_col.find({})],
        "settings": settings_col.find_one({"_id": "main"}) or {"superAdminCreated": False, "whatsAppSettings": None}
    }

# =============================================================================
# LAST SYNC TIMESTAMP
# =============================================================================

@app.get("/api/sync/timestamp")
def get_last_sync():
    """Returns server timestamp for sync verification"""
    return {"timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
