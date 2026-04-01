from fastapi import HTTPException
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Response, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.units import mm
from io import BytesIO
from openpyxl import Workbook
import math
import smtplib
from email.message import EmailMessage
from fastapi.responses import StreamingResponse
import io
import csv
from typing import Optional, List
from reportlab.pdfgen import canvas

DEVICE_LOCK_HOURS = 24
KICKOUT_HOURS = 3
MAX_BCRYPT_BYTES = 72

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))
SMTP_USERNAME = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASS", "")
SMTP_FROM_EMAIL = os.environ.get("SMTP_FROM", "")
ROGER_ALERT_EMAIL = os.environ.get("ROGER_ALERT_EMAIL", "")
SMTP_USE_TLS = os.environ.get("SMTP_USE_TLS", "true").lower() == "true"

app = FastAPI()

def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()

def parse_iso(dt_str: Optional[str]) -> Optional[datetime]:
    if not dt_str:
        return None
    try:
        # fromisoformat handles offsets like +00:00
        return datetime.fromisoformat(dt_str)
    except Exception:
        return None

def password_byte_len(pw: str) -> int:
    return len(pw.encode("utf-8"))

@app.get("/")
def root():
    return {"status": "ok"}

@app.get("/health")
def health():
    return {"status": "ok"}
api_router = APIRouter(prefix="/api")

# ===== MODELS =====
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    full_name: str
    role: str
    company_id: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    session_id: Optional[str] = None
    lockout_until: Optional[str] = None  # keep if you already use it
    
    # NEW: device lock + kickout
    device_id: Optional[str] = None
    device_locked_until: Optional[str] = None
    kickout_until: Optional[str] = None
    status: Optional[str] = "ACTIVE"
    lockout_count: Optional[int] = 0

    password_hash: Optional[str] = None

    password_setup_token: Optional[str] = None
    password_setup_expires_at: Optional[str] = None

class UserRole(str):
    MANAGER = "MANAGER"
    PROCUREMENT = "PROCUREMENT"
    QUOTING_STAFF = "QUOTING_STAFF"
    CEO = "CEO"

class QtyDriver(str):
    SQM = "SQM"
    HOURS = "HOURS"
    PER_JOB = "PER_JOB"

class LineType(str):
    MATERIAL = "MATERIAL"
    INK = "INK"
    SPRAY_CONSUMABLE = "SPRAY_CONSUMABLE"
    LABOUR = "LABOUR"
    SPRAY_LABOUR = "SPRAY_LABOUR"
    INSTALL = "INSTALL"
    TRAVEL = "TRAVEL"

class ApprovalStatus(str):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

# Auth Model
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    company_name: str
    full_name: str
    role: str = "MANAGER"
    device_id: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    device_id: str

class PlatformAdminLoginRequest(BaseModel):
    email: EmailStr
    password: str

class SupportRequest(BaseModel):
    email: EmailStr
    reason: str
    device_id: str
    message: Optional[str] = None
    full_name: Optional[str] = None
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    role: Optional[str] = None
    current_device_id: Optional[str] = None
    current_lockout_until: Optional[str] = None
    current_device_lock_until: Optional[str] = None

class AdminSupportActionRequest(BaseModel):
    action: str
    resolved_by: Optional[str] = None

class SupportRequestRecord(BaseModel):
    id: str
    support_case_id: Optional[str] = None
    email: EmailStr
    full_name: Optional[str] = None
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    role: Optional[str] = None
    reason: str
    requested_device_id: Optional[str] = None
    current_device_id: Optional[str] = None
    current_lockout_until: Optional[str] = None
    current_device_lock_until: Optional[str] = None
    message: Optional[str] = None
    created_at: str
    status: str
    resolved_at: Optional[str] = None
    resolution_action: Optional[str] = None
    resolved_by: Optional[str] = None

class CompanySuspensionNoteUpdateRequest(BaseModel):
    suspension_comment: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    full_name: str
    role: str
    company_id: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    session_id: Optional[str] = None  # Current active session
    lockout_until: Optional[str] = None  # Account lockout timestamp

class AdminCompanySummary(BaseModel):
    company_id: str
    company_name: str
    status: str = "ACTIVE"
    user_count: int = 0
    total_lockout_count: int = 0

class AdminCompanyUserRecord(BaseModel):
    user_id: str
    email: EmailStr
    full_name: Optional[str] = None
    role: Optional[str] = None
    status: str = "ACTIVE"
    device_id: Optional[str] = None
    device_lock_until: Optional[str] = None
    lockout_until: Optional[str] = None
    lockout_count: int = 0

class AdminCompanyDetail(BaseModel):
    company_id: str
    company_name: str
    status: str = "ACTIVE"
    user_count: int = 0
    total_lockout_count: int = 0
    users: List[AdminCompanyUserRecord]

class AdminUserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    status: Optional[str] = None

class CsvUserRow(BaseModel):
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    user_id: Optional[str] = None
    full_name: Optional[str] = None
    email: EmailStr
    role: Optional[str] = None
    status: Optional[str] = "ACTIVE"
    device_id: Optional[str] = None
    device_lock_until: Optional[str] = None
    lockout_until: Optional[str] = None
    lockout_count: Optional[int] = None

class CsvImportResult(BaseModel):
    created: int = 0
    updated: int = 0
    skipped: int = 0
    errors: List[str] = []

class AdminCreateUserRequest(BaseModel):
    full_name: str
    email: EmailStr
    role: str
    status: Optional[str] = "ACTIVE"

# Company Models
class Company(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone_number: Optional[str] = None
    vat_number: Optional[str] = None
    address: Optional[str] = None
    billing_email: Optional[EmailStr] = None
    billing_start_date: Optional[str] = None
    status: str = "ACTIVE"
    suspension_comment: Optional[str] = None
    suspension_date: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class BillingSeatLine(BaseModel):
    user_id: str
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    seat_price_ex_vat: float = 0.0


class BillingRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    company_name: str
    billing_email: Optional[EmailStr] = None
    billing_start_date: Optional[str] = None
    seat_lines: List[BillingSeatLine] = []
    subtotal_ex_vat: float = 0.0
    vat_amount: float = 0.0
    total_incl_vat: float = 0.0
    status: str = "ACTIVE"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class BillingSeatLineUpdate(BaseModel):
    user_id: str
    seat_price_ex_vat: float = 0.0


class BillingRecordUpsertRequest(BaseModel):
    company_id: str
    billing_email: Optional[EmailStr] = None
    billing_start_date: Optional[str] = None
    seat_lines: List[BillingSeatLineUpdate] = []

class CompanyBillTrackingRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    company_name: str
    company_status: str = "ACTIVE"
    suspension_comment: Optional[str] = None
    suspension_date: Optional[str] = None
    total_invoice_amount: float = 0.0
    month_1_name: str
    month_1_status: str = "UNPAID"
    month_1_amount: float = 0.0
    month_2_name: str
    month_2_status: str = "UNPAID"
    month_2_amount: float = 0.0
    month_3_name: str
    month_3_status: str = "UNPAID"
    month_3_amount: float = 0.0
    total_amount_due: float = 0.0
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CompanyBillTrackingUpdateRequest(BaseModel):
    company_id: str
    company_status: str = "ACTIVE"
    suspension_comment: Optional[str] = None
    total_invoice_amount: float = 0.0
    month_1_status: str
    month_1_amount: float = 0.0
    month_2_status: str
    month_2_amount: float = 0.0
    month_3_status: str
    month_3_amount: float = 0.0

class CompanyBillTrackingHistoryEntry(BaseModel):
    month_name: str
    status: str = "UNPAID"
    amount: float = 0.0
    updated_at: str


class CompanyBillTrackingHistoryResponse(BaseModel):
    company_id: str
    company_name: str
    months: List[CompanyBillTrackingHistoryEntry] = []

# Material Models
class MaterialCreate(BaseModel):
    name: str
    material_type: str  # SHEET, ROLL, BOARD, UNIT
    width: Optional[float] = None  # Width in mm (for SHEET, ROLL, BOARD)
    height: Optional[float] = None  # Height/Length in mm (for SHEET, ROLL, BOARD)
    thickness: Optional[float] = None
    sqm_price: Optional[float] = None  # Cost per 1 square meter (for area-based)
    unit_price: Optional[float] = None  # Cost per unit (for UNIT type)
    supplier: Optional[str] = None
    material_grade: Optional[str] = None
    product_specs: Optional[str] = None
    waste_default_percent: float = 10.0

class Material(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    name: str
    material_type: str
    width: Optional[float] = None
    height: Optional[float] = None
    thickness: Optional[float] = None
    total_sqm: Optional[float] = None  # Calculated: (width * height) / 1,000,000
    sqm_price: Optional[float] = None
    unit_price: Optional[float] = None
    supplier: Optional[str] = None
    material_grade: Optional[str] = None
    product_specs: Optional[str] = None
    waste_default_percent: float
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# Ink Profile Models
class InkProfileCreate(BaseModel):
    name: str
    ink_type: str  # e.g., UV, Solvent, Latex
    supplier: Optional[str] = None
    quantity_liters: float
    price_per_unit: float
    price_per_sqm_coverage: float

class InkProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    name: str
    ink_type: str
    supplier: Optional[str] = None
    quantity_liters: float
    price_per_unit: float
    price_per_sqm_coverage: float
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# Labour Type Models
class LabourTypeCreate(BaseModel):
    name: str
    rate_per_hour: float  # in ZAR
    number_of_people: int

class LabourType(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    name: str
    rate_per_hour: float
    number_of_people: int
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# Install Type Models
class InstallTypeCreate(BaseModel):
    name: str
    quantity_of_people: int
    rate_per_hour: float  # in ZAR
    tools_required: Optional[str] = None
    equipment: Optional[str] = None
    equipment_supplier: Optional[str] = None
    equipment_rate: float = 0.0

class InstallType(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    name: str
    quantity_of_people: int
    rate_per_hour: float
    tools_required: Optional[str] = None
    equipment: Optional[str] = None
    equipment_supplier: Optional[str] = None
    equipment_rate: float
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# Travel Settings Models (now per-quote)
class QuoteTravelCreate(BaseModel):
    rate_per_km: float  # in ZAR
    vehicle_type: str
    toll_gates: float
    subsistence: float
    accommodation: float

class QuoteTravel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    rate_per_km: float
    vehicle_type: str
    toll_gates: float
    subsistence: float
    accommodation: float

# Installation per quote
class QuoteInstallationCreate(BaseModel):
    install_type_id: str
    hours: float
    notes: Optional[str] = None

class QuoteInstallation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    install_type_id: str
    install_type_name: str
    quantity_of_people: int
    rate_per_hour: float
    hours: float
    equipment_rate: float
    total_cost: float
    notes: Optional[str] = None

# Labour per quote
class QuoteLabourCreate(BaseModel):
    labour_type_id: str
    hours: float
    notes: Optional[str] = None

class QuoteLabour(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    labour_type_id: str
    labour_type_name: str
    number_of_people: int
    rate_per_hour: float
    hours: float
    total_cost: float
    notes: Optional[str] = None

# Recipe Models
class RecipeLineCreate(BaseModel):
    line_type: str
    reference_id: Optional[str] = None
    qty_driver: str
    multiplier: float = 1.0
    waste_percent: float = 0.0
    default_markup_percent: float = 30.0
    markup_allowed: bool = True
    override_requires_approval: bool = False
    custom_name: Optional[str] = None

class RecipeLine(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    line_type: str
    reference_id: Optional[str] = None
    qty_driver: str
    multiplier: float
    waste_percent: float
    default_markup_percent: float
    markup_allowed: bool
    override_requires_approval: bool
    custom_name: Optional[str] = None

class RecipeCreate(BaseModel):
    name: str
    lines: List[RecipeLineCreate]

class Recipe(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    name: str
    version: int = 1
    lines: List[RecipeLine]
    archived_at: Optional[str] = None
    created_by: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# Quote Models
class QuoteLineCreate(BaseModel):
    recipe_id: str
    width_mm: float
    height_mm: float
    quantity: int
    markup_override: Optional[float] = None

class QuoteLine(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    recipe_id: str
    recipe_name: str
    width_mm: float
    height_mm: float
    quantity: int
    calculated_sqm: float
    line_items: List[dict]
    subtotal: float
    markup_applied: float
    total: float
    markup_override: Optional[float] = None
    approval_required: bool = False
    approval_status: Optional[str] = None

class QuoteCreate(BaseModel):
    client_name: str
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    client_address: Optional[str] = None
    description: Optional[str] = None

class Quote(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    created_by: str
    created_by_name: str
    client_name: str
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    client_address: Optional[str] = None
    description: Optional[str] = None
    lines: List[QuoteLine] = []
    labour_items: List[QuoteLabour] = []
    installation_items: List[QuoteInstallation] = []
    travel: Optional[QuoteTravel] = None
    blueprint: Optional[dict] = None  # Internal blueprint with full cost details
    total_amount: float = 0.0
    quote_status: str = "DRAFT"
    quote_approval_status: str = "PENDING"  # PENDING, APPROVED, REJECTED
    approved_by: Optional[str] = None
    approved_by_name: Optional[str] = None
    approved_at: Optional[str] = None
    rejection_reason: Optional[str] = None
    job_ticket_number: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ApprovalRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    quote_id: str
    quote_line_id: str
    requested_by: str
    requested_by_name: str
    original_markup: float
    requested_markup: float
    approval_status: str = "PENDING"
    approved_by: Optional[str] = None
    approved_by_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    resolved_at: Optional[str] = None

# ===== ESTIMATION DASHBOARD MODELS =====

class CustomLineItem(BaseModel):
    """Custom line item for random quoting needs - costs stay in blueprint only"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    description: str
    quantity: float = 1.0
    cost: float = 0.0  # Internal cost - NOT shown to client
    markup_percent: float = 0.0  # Internal markup
    selling_price: float = 0.0  # What client sees

class SignEstimate(BaseModel):
    """Individual sign estimate with full blueprint data"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sign_name: str = ""  # Optional name for the sign
    width_mm: float
    height_mm: float
    calculated_sqm: float = 0.0
    
    # Recipe/Sign Type
    recipe_id: str
    recipe_name: str = ""
    recipe_breakdown: List[dict] = []  # Detailed cost breakdown from recipe
    recipe_cost: float = 0.0
    recipe_selling: float = 0.0
    
    # Labour
    labour_type_id: Optional[str] = None
    labour_type_name: str = ""
    labour_hours: float = 0.0
    labour_cost: float = 0.0  # Internal
    labour_selling: float = 0.0
    
    # Installation/Machinery
    install_type_id: Optional[str] = None
    install_type_name: str = ""
    install_hours: float = 0.0
    install_cost: float = 0.0  # Internal
    install_selling: float = 0.0
    
    # Travel
    travel_km: float = 0.0
    travel_rate_per_km: float = 0.0
    travel_cost: float = 0.0  # Internal
    travel_selling: float = 0.0
    
    # Accommodation (days)
    accommodation_days: float = 0.0
    accommodation_rate_per_day: float = 0.0  # From recipe or config
    accommodation_cost: float = 0.0  # Internal
    accommodation_selling: float = 0.0
    
    # Custom items (costs hidden from client)
    custom_items: List[CustomLineItem] = []
    custom_total_cost: float = 0.0  # Internal
    custom_total_selling: float = 0.0
    
    # Totals
    total_cost: float = 0.0  # Internal total - blueprint only
    total_selling: float = 0.0  # Client-facing total
    profit_margin: float = 0.0  # Internal
    
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class SignEstimateCreate(BaseModel):
    """Create/update a sign estimate"""
    sign_name: Optional[str] = ""
    width_mm: float
    height_mm: float
    recipe_id: str
    labour_type_id: Optional[str] = None
    labour_hours: float = 0.0
    install_type_id: Optional[str] = None
    install_hours: float = 0.0
    travel_km: float = 0.0
    accommodation_days: float = 0.0
    custom_items: List[dict] = []  # [{description, quantity, cost, markup_percent, selling_price}]

class QuoteBlueprint(BaseModel):
    """Internal quote blueprint with full cost details - not shown to client"""
    model_config = ConfigDict(extra="ignore")
    signs: List[SignEstimate] = []
    total_cost: float = 0.0
    total_selling: float = 0.0
    total_profit: float = 0.0
    profit_margin_percent: float = 0.0

# ===== AUTH HELPERS =====

def hash_password(password: str) -> str:
    # bcrypt only supports 72 bytes; reject longer to avoid silent truncation
    if password is None:
        raise HTTPException(status_code=400, detail="Password is required")

    if len(password.encode("utf-8")) > 72:
        raise HTTPException(
            status_code=400,
            detail="Password too long (max 72 bytes). Use a shorter password."
        )

    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

SESSION_LOCKOUT_HOURS = 3  # Lockout duration when switching devices

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        session_id: str = payload.get("session_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Check if session is still valid (not terminated by another login)
        if session_id and user.get("session_id") != session_id:
            raise HTTPException(status_code=401, detail="Session terminated - logged in from another device")
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_manager(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != UserRole.MANAGER:
        raise HTTPException(status_code=403, detail="Manager access required")
    return user

async def require_procurement(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] not in [UserRole.PROCUREMENT, UserRole.CEO]:
        raise HTTPException(status_code=403, detail="Procurement access required")
    return user

async def require_quoting_staff(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] not in [UserRole.QUOTING_STAFF, UserRole.CEO]:
        raise HTTPException(status_code=403, detail="Quoting staff access required")
    return user

async def require_ceo(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != UserRole.CEO:
        raise HTTPException(status_code=403, detail="CEO access required")
    return user

async def can_view_materials(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] not in [UserRole.PROCUREMENT, UserRole.MANAGER, UserRole.CEO]:
        raise HTTPException(status_code=403, detail="Access denied")
    return user

async def can_edit_materials(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] not in [UserRole.PROCUREMENT, UserRole.CEO]:
        raise HTTPException(status_code=403, detail="Edit access denied")
    return user

def send_email_alert(subject: str, body: str, to_email: str):
    if not SMTP_HOST or not SMTP_USERNAME or not SMTP_PASSWORD or not SMTP_FROM_EMAIL or not to_email:
        print("Email alert skipped: SMTP settings incomplete")
        return

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM_EMAIL
    msg["To"] = to_email
    msg.set_content(body)

    if SMTP_PORT == 465:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            if SMTP_USE_TLS:
                server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)

def send_password_setup_email(to_email: str, full_name: str, setup_link: str):
    subject = "Set up your Signomics password"
    body = f"""Hello {full_name or "User"},

Your seat details were updated in Signomics.

Please use the link below to set your password for future login:

{setup_link}

If you were not expecting this email, please contact support.

Regards,
Signomics Support
"""
    send_email_alert(subject=subject, body=body, to_email=to_email)

# ===== AUTH ROUTES =====

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(req: RegisterRequest):
    existing = await db.users.find_one({"email": req.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    company = Company(name=req.company_name)
    await db.companies.insert_one(company.model_dump())
    
    # Create new session for the user
    new_session_id = str(uuid.uuid4())

    user = User(
        email=req.email,
        full_name=req.full_name,
        role=req.role,  # Use the role from request
        company_id=company.id,
        session_id=new_session_id
    )
    user_dict = user.model_dump()

    # bcrypt cannot hash passwords longer than 72 bytes
    if len(req.password.encode("utf-8")) > 72:
        raise HTTPException(
            status_code=400,
            detail="Password too long. Maximum length is 72 bytes."
        )

    user_dict["password_hash"] = hash_password(req.password)

    await db.users.insert_one(user_dict)

    access_token = create_access_token(data={"sub": user.id, "session_id": new_session_id})

    user_response = user.model_dump()
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )

@api_router.post("/platform-admin/login")
async def platform_admin_login(req: PlatformAdminLoginRequest):
    allowed_emails_raw = os.environ.get("PLATFORM_ADMIN_EMAILS", "")
    allowed_emails = [
        email.strip().lower()
        for email in allowed_emails_raw.split(",")
        if email.strip()
    ]

    admin_password = os.environ.get("PLATFORM_ADMIN_PASSWORD", "")

    if not allowed_emails or not admin_password:
        raise HTTPException(status_code=500, detail="Platform admin login is not configured")

    if req.email.strip().lower() not in allowed_emails:
        raise HTTPException(status_code=403, detail="Not authorized for platform admin")

    if req.password != admin_password:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")

    return {
        "message": "Platform admin login successful",
        "email": req.email,
        "is_platform_admin": True
    }

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email}, {"_id": 0})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    now = datetime.now(timezone.utc)

    # Check if account is currently locked out
    if user.get("lockout_until"):
        lockout_time = datetime.fromisoformat(user["lockout_until"].replace("Z", "+00:00"))
        if now < lockout_time:
            remaining = lockout_time - now
            hours = int(remaining.total_seconds() // 3600)
            minutes = int((remaining.total_seconds() % 3600) // 60)
            raise HTTPException(
                status_code=403,
                detail=f"Account locked. Try again in {hours}h {minutes}m."
            )
        else:
            # Expired lockout: clear lockout and previous device claim
            await db.users.update_one(
                {"id": user["id"]},
                {
                    "$set": {
                        "session_id": None,
                        "device_id": None,
                        "device_lock_until": None,
                        "lockout_until": None
                    }
                }
            )
            user["lockout_until"] = None
            user["session_id"] = None
            user["device_id"] = None
            user["device_lock_until"] = None

    incoming_device_id = req.device_id.strip()

    current_device_id = user.get("device_id")

    device_lock_until = None
    if user.get("device_lock_until"):
        device_lock_until = datetime.fromisoformat(
            user["device_lock_until"].replace("Z", "+00:00")
        )

    # No device lock yet, or device lock expired: allow login and claim device
    if not current_device_id or not device_lock_until or now >= device_lock_until:
        new_session_id = str(uuid.uuid4())
        new_device_lock_until = (now + timedelta(hours=DEVICE_LOCK_HOURS)).isoformat()

        await db.users.update_one(
            {"id": user["id"]},
            {
                "$set": {
                    "session_id": new_session_id,
                    "device_id": incoming_device_id,
                    "device_lock_until": new_device_lock_until,
                    "lockout_until": None
                }
            }
        )

        updated_user = await db.users.find_one({"id": user["id"]}, {"_id": 0})

        access_token = create_access_token(
            data={"sub": user["id"], "session_id": new_session_id}
        )

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=User(**updated_user).model_dump()
        )

    # Active device lock, same device: allow login
    if current_device_id == incoming_device_id:
        new_session_id = str(uuid.uuid4())

        await db.users.update_one(
            {"id": user["id"]},
            {
                "$set": {
                    "session_id": new_session_id,
                    "lockout_until": None
                }
            }
        )

        updated_user = await db.users.find_one({"id": user["id"]}, {"_id": 0})

        access_token = create_access_token(
            data={"sub": user["id"], "session_id": new_session_id}
        )

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=User(**updated_user).model_dump()
        )

    # Active device lock, different device: create a real lockout
    new_lockout_until = (now + timedelta(hours=SESSION_LOCKOUT_HOURS)).isoformat()

    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "session_id": None,
                "lockout_until": new_lockout_until
            },
            "$inc": {
                "lockout_count": 1
            }
        }
    )

    raise HTTPException(
        status_code=403,
        detail=f"Account locked. Try again in {SESSION_LOCKOUT_HOURS}h 0m."
    )
@api_router.post("/auth/contact-support")
async def contact_support(req: SupportRequest):
    user = await db.users.find_one({"email": req.email}, {"_id": 0})
    print(f"Support request email: {req.email}")
    print(f"Matched user: {user}")
    company = None

    if user and user.get("company_id"):
        company = await db.companies.find_one({"id": user.get("company_id")}, {"_id": 0})
    support_doc = {
        "id": str(uuid.uuid4()),
        "support_case_id": f"SUP-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "email": req.email,
        "full_name": req.full_name or (user.get("full_name") if user else None),
        "company_id": req.company_id or (user.get("company_id") if user else None),
        "company_name": req.company_name or (company.get("name") if company else None),
        "role": req.role or (user.get("role") if user else None),
        "reason": req.reason,
        "requested_device_id": req.device_id,
        "current_device_id": req.current_device_id,
        "current_lockout_until": req.current_lockout_until,
        "current_device_lock_until": req.current_device_lock_until,
        "message": req.message,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "OPEN",
        "resolved_at": None,
        "resolution_action": None,
        "resolved_by": None
    }
    print(f"Matched company: {company}")

    await db.support_requests.insert_one(support_doc)

    try:
        send_email_alert(
                    subject=f"[Signomics Support] {support_doc['support_case_id']} | {req.company_name or 'Unknown Company'} | {req.role or 'Unknown Role'} | Device Lock Request",
                    body=f"""A new support request has been submitted.

        Support Case ID: {support_doc['support_case_id']}
        Status: {support_doc['status']}

        User Email: {req.email}
        Full Name: {req.full_name or 'Not provided'}
        Company ID: {req.company_id or 'Not provided'}
        Company Name: {req.company_name or 'Not provided'}
        Role: {req.role or 'Not provided'}

        Reason: {req.reason}
        Requested Device ID: {req.device_id}
        Current Device ID: {req.current_device_id or 'Not provided'}
        Current Lockout Until: {req.current_lockout_until or 'Not provided'}
        Current Device Lock Until: {req.current_device_lock_until or 'Not provided'}

        Message:
        {req.message or 'No message provided'}
        """,
                    to_email=SMTP_FROM_EMAIL
                )
    except Exception as e:
        print(f"Failed to send support email: {e}")

    return {"message": "Support request submitted successfully."}

@api_router.get("/admin/support-requests", response_model=List[SupportRequestRecord])
async def list_support_requests():
    requests = await db.support_requests.find({}, {"_id": 0}).to_list(1000)
    requests.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return [SupportRequestRecord(**r) for r in requests]


@api_router.get("/admin/support-requests/{case_id}", response_model=SupportRequestRecord)
async def get_support_request(case_id: str):
    support_request = await db.support_requests.find_one(
        {"support_case_id": case_id},
        {"_id": 0}
    )

    if not support_request:
        raise HTTPException(status_code=404, detail="Support request not found")

    return SupportRequestRecord(**support_request)

@api_router.post("/admin/support-requests/{case_id}/action")
async def action_support_request(case_id: str, req: AdminSupportActionRequest):
    support_request = await db.support_requests.find_one(
        {"support_case_id": case_id},
        {"_id": 0}
    )

    if not support_request:
        raise HTTPException(status_code=404, detail="Support request not found")

    user = await db.users.find_one({"email": support_request["email"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    action = req.action.strip().upper()
    now_iso = datetime.now(timezone.utc).isoformat()

    if action == "CLEAR_LOCKOUT":
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"lockout_until": None}}
        )

    elif action == "APPROVE_NEW_DEVICE":
        new_device_id = support_request.get("requested_device_id")
        if not new_device_id:
            raise HTTPException(status_code=400, detail="No requested device ID found on support request")

        new_device_lock_until = (datetime.now(timezone.utc) + timedelta(hours=DEVICE_LOCK_HOURS)).isoformat()

        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {
                "device_id": new_device_id,
                "device_lock_until": new_device_lock_until,
                "lockout_until": None,
                "session_id": None
            }}
        )

    elif action == "FULL_RESET":
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {
                "device_id": None,
                "device_lock_until": None,
                "lockout_until": None,
                "session_id": None
            }}
        )

    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    await db.support_requests.update_one(
        {"support_case_id": case_id},
        {"$set": {
            "status": "COMPLETED",
            "resolved_at": now_iso,
            "resolution_action": action,
            "resolved_by": req.resolved_by or "SYSTEM"
        }}
    )

    return {
        "message": "Support request action completed successfully.",
        "case_id": case_id,
        "action": action
    }

@api_router.delete("/admin/support-requests/{case_id}")
async def delete_support_request(case_id: str):
    support_request = await db.support_requests.find_one(
        {"support_case_id": case_id},
        {"_id": 0}
    )

    if not support_request:
        raise HTTPException(status_code=404, detail="Support request not found")

    await db.support_requests.update_one(
        {"support_case_id": case_id},
        {"$set": {
            "status": "DELETED",
            "resolved_at": datetime.now(timezone.utc).isoformat(),
            "resolution_action": "DELETED"
        }}
    )

    return {
        "message": "Support request moved to deleted.",
        "case_id": case_id
    }

@api_router.delete("/admin/support-requests/{case_id}/hard-delete")
async def hard_delete_support_request(case_id: str):
    support_request = await db.support_requests.find_one(
        {"support_case_id": case_id},
        {"_id": 0}
    )

    if not support_request:
        raise HTTPException(status_code=404, detail="Support request not found")

    await db.support_requests.delete_one({"support_case_id": case_id})

    return {
        "message": "Support request permanently deleted.",
        "case_id": case_id
    }

@api_router.get("/admin/support-requests", response_model=List[SupportRequestRecord])
async def list_support_requests():
    requests = await db.support_requests.find({}, {"_id": 0}).to_list(1000)
    requests.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return [SupportRequestRecord(**r) for r in requests]

class NewCompanySetupRequest(BaseModel):
    name: str
    phone_number: Optional[str] = None
    vat_number: Optional[str] = None
    address: Optional[str] = None
    billing_email: Optional[EmailStr] = None
    billing_start_date: Optional[str] = None
    seats: List[AdminCreateUserRequest]

@api_router.post("/admin/companies/setup")
async def setup_new_company(req: NewCompanySetupRequest):

    company = Company(
        name=req.name,
        phone_number=req.phone_number,
        vat_number=req.vat_number,
        address=req.address,
        billing_email=req.billing_email,
        billing_start_date=req.billing_start_date 
   )

    company_dict = company.model_dump()
    await db.companies.insert_one(company_dict)

    created_users = []
    email_failures = []

    for seat in req.seats:
        try:
            role = seat.role.strip().upper()
            status = (seat.status or "ACTIVE").strip().upper()

            temp_password = "ChangeMe123!"

            new_user = User(
                email=seat.email,
                full_name=seat.full_name,
                role=role,
                company_id=company.id
            )

            user_dict = new_user.model_dump()
            user_dict["status"] = status
            user_dict["password_hash"] = hash_password(temp_password)

            setup_token = str(uuid.uuid4())
            setup_expires_at = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()

            user_dict["password_setup_token"] = setup_token
            user_dict["password_setup_expires_at"] = setup_expires_at

            await db.users.insert_one(user_dict)
            created_users.append(user_dict)

            try:
                frontend_url = os.environ.get("FRONTEND_URL", "").rstrip("/")
                setup_link = f"{frontend_url}/set-password?token={setup_token}"

                send_password_setup_email(
                    to_email=seat.email,
                    full_name=seat.full_name,
                    setup_link=setup_link
                )
            except Exception as e:
                email_failures.append({
                    "email": seat.email,
                    "error": str(e)
                })

        except Exception as e:
            print(f"Seat creation failed: {e}")

    return {
        "message": "Company setup complete",
        "company_id": company.id,
        "company_name": company.name,
        "users_created": len(created_users),
        "email_failures": email_failures
    }

@api_router.get("/admin/companies", response_model=List[AdminCompanySummary])
async def list_admin_companies():
    companies = await db.companies.find({}, {"_id": 0}).to_list(1000)
    users = await db.users.find({}, {"_id": 0}).to_list(1000)

    summaries = []

    for company in companies:
        company_id = company.get("id")
        company_users = [u for u in users if u.get("company_id") == company_id]

        summaries.append(
            AdminCompanySummary(
                company_id=company_id,
                company_name=company.get("name", "Unknown Company"),
                status=company.get("status", "ACTIVE"),
                user_count=len(company_users),
                total_lockout_count=sum(u.get("lockout_count", 0) for u in company_users),
            )
        )

    summaries.sort(key=lambda x: x.company_name.lower())
    return summaries

@api_router.delete("/admin/companies/{company_id}/hard-delete")
async def hard_delete_company(company_id: str):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    await db.users.delete_many({"company_id": company_id})
    await db.companies.delete_one({"id": company_id})

    return {
        "message": "Company permanently deleted.",
        "company_id": company_id
    }

@api_router.post("/admin/users/{user_id}/suspend")
async def suspend_user(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.users.update_one(
        {"id": user_id},
        {"$set": {"status": "SUSPENDED"}}
    )

    return {
        "message": "User suspended successfully.",
        "user_id": user_id,
        "status": "SUSPENDED"
    }

@api_router.post("/admin/users/{user_id}/restore")
async def restore_user(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.users.update_one(
        {"id": user_id},
        {"$set": {"status": "ACTIVE"}}
    )

    return {
        "message": "User restored successfully.",
        "user_id": user_id,
        "status": "ACTIVE"
    }

@api_router.post("/admin/users/{user_id}/delete")
async def soft_delete_user(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.users.update_one(
        {"id": user_id},
        {"$set": {"status": "DELETED"}}
    )

    return {
        "message": "User soft deleted successfully.",
        "user_id": user_id,
        "status": "DELETED"
    }

@api_router.post("/admin/users/{user_id}/hard-delete")
async def hard_delete_user(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.users.delete_one({"id": user_id})

    return {
        "message": "User permanently deleted successfully.",
        "user_id": user_id,
        "status": "HARD_DELETED"
    }

@api_router.post("/admin/users/{user_id}/update")
async def update_user(user_id: str, req: AdminUserUpdateRequest):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_fields = {}
    original_email = user.get("email")
    email_changed = False
    allowed_roles = {"CEO", "MANAGER", "PROCUREMENT", "QUOTING_STAFF"}
    allowed_statuses = {"ACTIVE", "SUSPENDED", "DELETED"}

    if req.full_name is not None:
        update_fields["full_name"] = req.full_name

    if req.email is not None:
        new_email = req.email.strip().lower()

        existing_email_user = await db.users.find_one(
            {"email": new_email, "id": {"$ne": user_id}},
            {"_id": 0}
        )
        if existing_email_user:
            raise HTTPException(status_code=400, detail="Email already in use")

        update_fields["email"] = new_email

        if new_email != (original_email or "").strip().lower():
            email_changed = True

    if req.role is not None:
        role = req.role.strip().upper()
        if role not in allowed_roles:
            raise HTTPException(status_code=400, detail="Invalid role")
        update_fields["role"] = role

    if req.status is not None:
        status = req.status.strip().upper()
        if status not in allowed_statuses:
            raise HTTPException(status_code=400, detail="Invalid status")
        update_fields["status"] = status

    if not update_fields:
        raise HTTPException(status_code=400, detail="No valid fields provided")

    password_setup_email_failed = False

    if email_changed:
        setup_token = str(uuid.uuid4())
        setup_expires_at = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()

        update_fields["password_setup_token"] = setup_token
        update_fields["password_setup_expires_at"] = setup_expires_at

        frontend_url = os.environ.get("FRONTEND_URL", "").rstrip("/")
        setup_link = f"{frontend_url}/set-password?token={setup_token}"

    await db.users.update_one(
        {"id": user_id},
        {"$set": update_fields}
    )

    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0})

    if email_changed:
        try:
            send_password_setup_email(
                to_email=update_fields["email"],
                full_name=update_fields.get("full_name") or user.get("full_name") or "User",
                setup_link=setup_link
            )
        except Exception as e:
            password_setup_email_failed = True
            print(f"Password setup email failed for {update_fields['email']}: {e}")

    return {
        "message": "User updated successfully.",
        "user": updated_user,
        "password_setup_email_failed": password_setup_email_failed
    }

@api_router.post("/admin/companies/{company_id}/users/create")
async def create_company_user(company_id: str, req: AdminCreateUserRequest):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    existing_user = await db.users.find_one(
        {"company_id": company_id, "email": req.email},
        {"_id": 0}
    )
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists in this company")

    allowed_roles = {"CEO", "MANAGER", "PROCUREMENT", "QUOTING_STAFF"}
    allowed_statuses = {"ACTIVE", "SUSPENDED", "DELETED"}

    role = req.role.strip().upper()
    status = (req.status or "ACTIVE").strip().upper()

    if role not in allowed_roles:
        raise HTTPException(status_code=400, detail="Invalid role")

    if status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")

    temp_password = "ChangeMe123!"

    new_user = User(
        email=req.email,
        full_name=req.full_name,
        role=role,
        company_id=company_id,
        session_id=None,
        lockout_until=None
    )

    user_dict = new_user.model_dump()
    user_dict["status"] = status
    user_dict["password_hash"] = hash_password(temp_password)
    user_dict["device_id"] = None
    user_dict["device_lock_until"] = None
    user_dict["lockout_count"] = 0

    await db.users.insert_one(user_dict)
    safe_user = {k: v for k, v in user_dict.items() if k != "_id"}

    return {
        "message": "User created successfully.",
        "user": safe_user
    }

@api_router.get("/admin/companies/export")
async def export_all_companies_csv():
    users = await db.users.find({}, {"_id": 0}).to_list(10000)
    companies = await db.companies.find({}, {"_id": 0}).to_list(1000)

    company_map = {c["id"]: c.get("name", "Unknown Company") for c in companies if c.get("id")}
   
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "company_name",
        "company_id",
        "user_id",
        "full_name",
        "email",
        "role",
        "status",
        "device_id",
        "device_lock_until",
        "lockout_until",
        "lockout_count",
    ])

    for user in users:
        writer.writerow([
            company_map.get(user.get("company_id"), "Unassigned"),
            user.get("company_id"),
            user.get("id"),
            user.get("full_name"),
            user.get("email"),
            user.get("role"),
            user.get("status", "ACTIVE"),
            user.get("device_id"),
            user.get("device_lock_until"),
            user.get("lockout_until"),
            user.get("lockout_count", 0),
        ])

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=companies_export.csv"
        },
    )

@api_router.get("/admin/companies/{company_id}/export")
async def export_company_csv(company_id: str):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    users = await db.users.find({"company_id": company_id}, {"_id": 0}).to_list(10000)

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "company_name",
        "company_id",
        "user_id",
        "full_name",
        "email",
        "role",
        "status",
        "device_id",
        "device_lock_until",
        "lockout_until",
        "lockout_count",
    ])

    for user in users:
        writer.writerow([
            company.get("name", "Unknown Company"),
            company.get("id"),
            user.get("id"),
            user.get("full_name"),
            user.get("email"),
            user.get("role"),
            user.get("status", "ACTIVE"),
            user.get("device_id"),
            user.get("device_lock_until"),
            user.get("lockout_until"),
            user.get("lockout_count", 0),
        ])

    output.seek(0)

    safe_name = company.get("name", "company").replace(" ", "_").lower()

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={safe_name}_export.csv"
        },
    )

@api_router.post("/admin/companies/{company_id}/import", response_model=CsvImportResult)
async def import_company_csv(company_id: str, file: UploadFile = File(...)):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    result = CsvImportResult()
    allowed_roles = {"CEO", "MANAGER", "PROCUREMENT", "QUOTING_STAFF"}
    allowed_statuses = {"ACTIVE", "SUSPENDED"}

    for index, row in enumerate(reader, start=2):
        try:
            parsed = CsvUserRow(
                company_id=row.get("company_id"),
                company_name=row.get("company_name"),
                user_id=row.get("user_id"),
                full_name=row.get("full_name"),
                email=row.get("email"),
                role=row.get("role"),
                status=row.get("status") or "ACTIVE",
                device_id=row.get("device_id"),
                device_lock_until=row.get("device_lock_until"),
                lockout_until=row.get("lockout_until"),
                lockout_count=int(row["lockout_count"]) if row.get("lockout_count") not in (None, "") else None,
            )
        except Exception as e:
            result.errors.append(f"Row {index}: invalid data - {e}")
            result.skipped += 1
            continue

        role = (parsed.role or "").strip().upper()
        status = (parsed.status or "ACTIVE").strip().upper()

        if role not in allowed_roles:
            result.errors.append(f"Row {index}: invalid role '{parsed.role}'")
            result.skipped += 1
            continue

        if status not in allowed_statuses:
            result.errors.append(f"Row {index}: invalid status '{parsed.status}'")
            result.skipped += 1
            continue

        existing_user = await db.users.find_one(
            {"company_id": company_id, "email": parsed.email},
            {"_id": 0}
        )

        if existing_user:
            await db.users.update_one(
                {"id": existing_user["id"]},
                {"$set": {
                    "full_name": parsed.full_name or existing_user.get("full_name"),
                    "role": role,
                    "status": status
                }}
            )
            result.updated += 1
        else:
            temp_password = "ChangeMe123!"
            new_user = User(
                email=parsed.email,
                full_name=parsed.full_name or "",
                role=role,
                company_id=company_id,
                session_id=None,
                lockout_until=None
            )
            user_dict = new_user.model_dump()
            user_dict["status"] = status
            user_dict["password_hash"] = hash_password(temp_password)
            user_dict["device_id"] = None
            user_dict["device_lock_until"] = None
            user_dict["lockout_count"] = 0

            await db.users.insert_one(user_dict)
            result.created += 1

    return result

@api_router.post("/admin/companies/import", response_model=CsvImportResult)
async def import_all_companies_csv(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    result = CsvImportResult()
    allowed_roles = {"CEO", "MANAGER", "PROCUREMENT", "QUOTING_STAFF"}
    allowed_statuses = {"ACTIVE", "SUSPENDED"}

    for index, row in enumerate(reader, start=2):
        try:
            parsed = CsvUserRow(
                company_id=row.get("company_id"),
                company_name=row.get("company_name"),
                user_id=row.get("user_id"),
                full_name=row.get("full_name"),
                email=row.get("email"),
                role=row.get("role"),
                status=row.get("status") or "ACTIVE",
                device_id=row.get("device_id"),
                device_lock_until=row.get("device_lock_until"),
                lockout_until=row.get("lockout_until"),
                lockout_count=int(row["lockout_count"]) if row.get("lockout_count") not in (None, "") else None,
            )
        except Exception as e:
            result.errors.append(f"Row {index}: invalid data - {e}")
            result.skipped += 1
            continue

        role = (parsed.role or "").strip().upper()
        status = (parsed.status or "ACTIVE").strip().upper()

        if role not in allowed_roles:
            result.errors.append(f"Row {index}: invalid role '{parsed.role}'")
            result.skipped += 1
            continue

        if status not in allowed_statuses:
            result.errors.append(f"Row {index}: invalid status '{parsed.status}'")
            result.skipped += 1
            continue

        target_company = None

        if parsed.company_id:
            target_company = await db.companies.find_one({"id": parsed.company_id}, {"_id": 0})

        if not target_company and parsed.company_name:
            target_company = await db.companies.find_one({"name": parsed.company_name}, {"_id": 0})

        if not target_company:
            if not parsed.company_name:
                result.errors.append(f"Row {index}: missing company_id/company_name")
                result.skipped += 1
                continue

            new_company = Company(name=parsed.company_name)
            await db.companies.insert_one(new_company.model_dump())
            target_company = new_company.model_dump()

        company_id = target_company["id"]

        existing_user = await db.users.find_one(
            {"company_id": company_id, "email": parsed.email},
            {"_id": 0}
        )

        if existing_user:
            await db.users.update_one(
                {"id": existing_user["id"]},
                {"$set": {
                    "full_name": parsed.full_name or existing_user.get("full_name"),
                    "role": role,
                    "status": status
                }}
            )
            result.updated += 1
        else:
            temp_password = "ChangeMe123!"
            new_user = User(
                email=parsed.email,
                full_name=parsed.full_name or "",
                role=role,
                company_id=company_id,
                session_id=None,
                lockout_until=None
            )
            user_dict = new_user.model_dump()
            user_dict["status"] = status
            user_dict["password_hash"] = hash_password(temp_password)
            user_dict["device_id"] = None
            user_dict["device_lock_until"] = None
            user_dict["lockout_count"] = 0

            await db.users.insert_one(user_dict)
            result.created += 1

    return result

@api_router.get("/admin/companies/{company_id}", response_model=AdminCompanyDetail)
async def get_admin_company_detail(company_id: str):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    users = await db.users.find({"company_id": company_id}, {"_id": 0}).to_list(1000)

    user_records = [
        AdminCompanyUserRecord(
            user_id=user["id"],
            email=user["email"],
            full_name=user.get("full_name"),
            role=user.get("role"),
            status=user.get("status", "ACTIVE"),
            device_id=user.get("device_id"),
            device_lock_until=user.get("device_lock_until"),
            lockout_until=user.get("lockout_until"),
            lockout_count=user.get("lockout_count", 0),
        )
        for user in users
    ]

    return AdminCompanyDetail(
        company_id=company["id"],
        company_name=company.get("name", "Unknown Company"),
        status=company.get("status", "ACTIVE"),
        user_count=len(user_records),
        total_lockout_count=sum(u.lockout_count for u in user_records),
        users=user_records,
    )

@api_router.post("/admin/companies/{company_id}/suspend")
async def suspend_company(company_id: str):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    suspension_date = datetime.now(timezone.utc).isoformat()

    await db.companies.update_one(
        {"id": company_id},
        {
            "$set": {
                "status": "SUSPENDED",
                "suspension_date": suspension_date,
            }
        }
    )

    await db.company_bill_tracking.update_one(
        {"company_id": company_id},
        {
            "$set": {
                "company_status": "SUSPENDED",
                "suspension_date": suspension_date,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=True
    )

    await db.users.update_many(
        {"company_id": company_id},
        {"$set": {"status": "SUSPENDED"}}
    )

    return {
        "message": "Company suspended successfully.",
        "company_id": company_id,
        "status": "SUSPENDED"
    }

@api_router.post("/admin/companies/{company_id}/delete")
async def soft_delete_company(company_id: str):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    await db.companies.update_one(
        {"id": company_id},
        {
            "$set": {
                "status": "DELETED",
            }
        }
    )

    await db.company_bill_tracking.update_one(
        {"company_id": company_id},
        {
            "$set": {
                "company_status": "DELETED",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=True
    )

    await db.users.update_many(
        {"company_id": company_id},
        {"$set": {"status": "SUSPENDED"}}
    )

    return {
        "message": "Company soft deleted successfully.",
        "company_id": company_id,
        "status": "DELETED"
    }

@api_router.post("/admin/companies/{company_id}/restore")
async def restore_company(company_id: str):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    await db.companies.update_one(
        {"id": company_id},
        {
            "$set": {
                "status": "ACTIVE",
                "suspension_date": None,
            }
        }
    )

    await db.company_bill_tracking.update_one(
        {"company_id": company_id},
        {
            "$set": {
                "company_status": "ACTIVE",
                "suspension_date": None,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=True
    )

    await db.users.update_many(
        {"company_id": company_id},
        {"$set": {"status": "ACTIVE"}}
    )

    return {
        "message": "Company restored successfully.",
        "company_id": company_id,
        "status": "ACTIVE"
    }

@api_router.post("/admin/companies/{company_id}/suspension-note")
async def update_company_suspension_note(
    company_id: str,
    req: CompanySuspensionNoteUpdateRequest
):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    suspension_comment = (req.suspension_comment or "").strip() or None

    await db.companies.update_one(
        {"id": company_id},
        {
            "$set": {
                "suspension_comment": suspension_comment,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        }
    )

    await db.company_bill_tracking.update_one(
        {"company_id": company_id},
        {
            "$set": {
                "suspension_comment": suspension_comment,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        }
    )

    return {
        "message": "Suspension note updated successfully.",
        "company_id": company_id,
        "suspension_comment": suspension_comment,
    }

@api_router.get("/admin/billing", response_model=List[BillingRecord])
async def list_billing_records():
    records = await db.billing_records.find({}, {"_id": 0}).to_list(1000)
    records.sort(key=lambda x: x.get("company_name", "").lower())
    return [BillingRecord(**r) for r in records]


@api_router.get("/admin/billing/{company_id}", response_model=BillingRecord)
async def get_billing_record(company_id: str):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    existing = await db.billing_records.find_one({"company_id": company_id}, {"_id": 0})
    if existing:
        return BillingRecord(**existing)

    users = await db.users.find({"company_id": company_id}, {"_id": 0}).to_list(1000)

    seat_lines = [
        BillingSeatLine(
            user_id=user["id"],
            full_name=user.get("full_name"),
            email=user.get("email"),
            role=user.get("role"),
            seat_price_ex_vat=0.0
        )
        for user in users
    ]

    return BillingRecord(
        company_id=company["id"],
        company_name=company.get("name", "Unknown Company"),
        billing_email=company.get("billing_email"),
        billing_start_date=company.get("billing_start_date"),
        seat_lines=seat_lines,
        subtotal_ex_vat=0.0,
        vat_amount=0.0,
        total_incl_vat=0.0,
        status="ACTIVE"
    )


@api_router.post("/admin/billing/upsert", response_model=BillingRecord)
async def upsert_billing_record(req: BillingRecordUpsertRequest):
    company = await db.companies.find_one({"id": req.company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    users = await db.users.find({"company_id": req.company_id}, {"_id": 0}).to_list(1000)
    user_map = {u["id"]: u for u in users}

    seat_lines = []
    subtotal = 0.0

    for line in req.seat_lines:
        if line.user_id not in user_map:
            continue

        price = float(line.seat_price_ex_vat or 0.0)
        if price < 0:
            raise HTTPException(status_code=400, detail="Seat price cannot be negative")

        user = user_map[line.user_id]

        seat_lines.append(
            BillingSeatLine(
                user_id=user["id"],
                full_name=user.get("full_name"),
                email=user.get("email"),
                role=user.get("role"),
                seat_price_ex_vat=price
            )
        )
        subtotal += price

    vat_amount = round(subtotal * 0.15, 2)
    total_incl_vat = round(subtotal + vat_amount, 2)

    existing = await db.billing_records.find_one({"company_id": req.company_id}, {"_id": 0})

    record = BillingRecord(
        id=existing["id"] if existing else str(uuid.uuid4()),
        company_id=company["id"],
        company_name=company.get("name", "Unknown Company"),
        billing_email=req.billing_email or company.get("billing_email"),
        billing_start_date=req.billing_start_date or company.get("billing_start_date"),
        seat_lines=seat_lines,
        subtotal_ex_vat=round(subtotal, 2),
        vat_amount=vat_amount,
        total_incl_vat=total_incl_vat,
        status="ACTIVE",
        created_at=existing["created_at"] if existing else datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat()
    )

    await db.billing_records.update_one(
        {"company_id": req.company_id},
        {"$set": record.model_dump()},
        upsert=True
    )

    return record

@api_router.get("/admin/billing/{company_id}/invoice-pdf")
async def generate_billing_invoice_pdf(company_id: str):
    record = await db.billing_records.find_one({"company_id": company_id}, {"_id": 0})

    if record:
        billing = BillingRecord(**record)
    else:
        company = await db.companies.find_one({"id": company_id}, {"_id": 0})
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")

        users = await db.users.find({"company_id": company_id}, {"_id": 0}).to_list(1000)

        seat_lines = [
            BillingSeatLine(
                user_id=user["id"],
                full_name=user.get("full_name"),
                email=user.get("email"),
                role=user.get("role"),
                seat_price_ex_vat=0.0
            )
            for user in users
        ]

        billing = BillingRecord(
            company_id=company["id"],
            company_name=company.get("name", "Unknown Company"),
            billing_email=company.get("billing_email"),
            billing_start_date=company.get("billing_start_date"),
            seat_lines=seat_lines,
            subtotal_ex_vat=0.0,
            vat_amount=0.0,
            total_incl_vat=0.0,
            status="ACTIVE"
        )

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    y = height - 50

    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(50, y, "Invoice")
    y -= 30

    pdf.setFont("Helvetica", 11)
    pdf.drawString(50, y, f"Company: {billing.company_name}")
    y -= 18
    pdf.drawString(50, y, f"Billing Email: {billing.billing_email or '-'}")
    y -= 18
    pdf.drawString(50, y, f"Billing Start Date: {billing.billing_start_date or '-'}")
    y -= 30

    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(50, y, "Full Name")
    pdf.drawString(220, y, "Email")
    pdf.drawString(380, y, "Role")
    pdf.drawString(470, y, "Price")
    y -= 15

    pdf.setFont("Helvetica", 10)
    for line in billing.seat_lines:
        if y < 80:
            pdf.showPage()
            y = height - 50
            pdf.setFont("Helvetica", 10)

        pdf.drawString(50, y, str(line.full_name or "-")[:28])
        pdf.drawString(220, y, str(line.email or "-")[:28])
        pdf.drawString(380, y, str(line.role or "-")[:12])
        pdf.drawRightString(560, y, f"R {line.seat_price_ex_vat:.2f}")
        y -= 16

    y -= 20
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawRightString(560, y, f"Subtotal Excl. VAT: R {billing.subtotal_ex_vat:.2f}")
    y -= 18
    pdf.drawRightString(560, y, f"VAT 15%: R {billing.vat_amount:.2f}")
    y -= 18
    pdf.drawRightString(560, y, f"Total Incl. VAT: R {billing.total_incl_vat:.2f}")

    pdf.showPage()
    pdf.save()
    buffer.seek(0)

    filename = f"invoice_{billing.company_name.replace(' ', '_')}.pdf"

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

    def get_last_3_month_names():
        now = datetime.now(timezone.utc)
        months = []
        year = now.year
        month = now.month

        for offset in range(2, -1, -1):
            m = month - offset
            y = year
            while m <= 0:
                m += 12
                y -= 1
            months.append(datetime(y, m, 1, tzinfo=timezone.utc).strftime("%b"))

        return months

def get_last_3_month_names():
    now = datetime.now(timezone.utc)
    months = []
    year = now.year
    month = now.month

    for offset in range(2, -1, -1):
        m = month - offset
        y = year

        while m <= 0:
            m += 12
            y -= 1

        months.append(datetime(y, m, 1, tzinfo=timezone.utc).strftime("%b"))

    return months

@api_router.get("/admin/bill-tracking", response_model=List[CompanyBillTrackingRecord])
async def list_company_bill_tracking():
    companies = await db.companies.find({}, {"_id": 0}).to_list(1000)
    tracking_records = await db.company_bill_tracking.find({}, {"_id": 0}).to_list(1000)

    tracking_map = {record["company_id"]: record for record in tracking_records}
    month_1_name, month_2_name, month_3_name = get_last_3_month_names()

    rows = []

    for company in companies:
        company_id = company.get("id")
        existing = tracking_map.get(company_id)

        if existing:
            existing["company_name"] = company.get(
                "name",
                existing.get("company_name", "Unknown Company")
            )
            existing["company_status"] = company.get("status", "ACTIVE")
            existing["suspension_comment"] = company.get("suspension_comment")
            existing["suspension_date"] = company.get("suspension_date")
            rows.append(CompanyBillTrackingRecord(**existing))
   
        else:
            rows.append(
                CompanyBillTrackingRecord(
                    company_id=company_id,
                    company_name=company.get("name", "Unknown Company"),
                    company_status=company.get("status", "ACTIVE"),
                    suspension_comment=company.get("suspension_comment"),
                    suspension_date=company.get("suspension_date"),
                    total_invoice_amount=0.0,
                    month_1_name=month_1_name,
                    month_1_status="UNPAID",
                    month_1_amount=0.0,
                    month_2_name=month_2_name,
                    month_2_status="UNPAID",
                    month_2_amount=0.0,
                    month_3_name=month_3_name,
                    month_3_status="UNPAID",
                    month_3_amount=0.0,
                    total_amount_due=0.0,
                )
            )

    rows.sort(key=lambda x: (x.company_name or "").lower())
    return rows


@api_router.post("/admin/bill-tracking/upsert", response_model=CompanyBillTrackingRecord)
async def upsert_company_bill_tracking(req: CompanyBillTrackingUpdateRequest):
    company = await db.companies.find_one({"id": req.company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    allowed_month_statuses = {"PAID", "UNPAID", "SUSPENDED"}
    allowed_company_statuses = {"ACTIVE", "SUSPENDED", "DELETED"}

    company_status = (req.company_status or "ACTIVE").strip().upper()
    suspension_comment = (req.suspension_comment or "").strip() or None
    month_1_status = (req.month_1_status or "").strip().upper()
    month_2_status = (req.month_2_status or "").strip().upper()
    month_3_status = (req.month_3_status or "").strip().upper()

    if company_status not in allowed_company_statuses:
        raise HTTPException(status_code=400, detail="Invalid company status")
    if month_1_status not in allowed_month_statuses:
        raise HTTPException(status_code=400, detail="Invalid month 1 status")
    if month_2_status not in allowed_month_statuses:
        raise HTTPException(status_code=400, detail="Invalid month 2 status")
    if month_3_status not in allowed_month_statuses:
        raise HTTPException(status_code=400, detail="Invalid month 3 status")
    if req.total_invoice_amount < 0:
        raise HTTPException(status_code=400, detail="Invoice amount cannot be negative")
    if req.month_1_amount < 0:
        raise HTTPException(status_code=400, detail="Month 1 amount cannot be negative")
    if req.month_2_amount < 0:
        raise HTTPException(status_code=400, detail="Month 2 amount cannot be negative")
    if req.month_3_amount < 0:
        raise HTTPException(status_code=400, detail="Month 3 amount cannot be negative")

    total_amount_due = 0.0
    if month_1_status == "UNPAID":
        total_amount_due += float(req.month_1_amount)
    if month_2_status == "UNPAID":
        total_amount_due += float(req.month_2_amount)
    if month_3_status == "UNPAID":
        total_amount_due += float(req.month_3_amount)

    existing = await db.company_bill_tracking.find_one(
        {"company_id": req.company_id},
        {"_id": 0}
    )

    month_1_name, month_2_name, month_3_name = get_last_3_month_names()

    existing_company_status = (company.get("status") or "ACTIVE").upper()
    existing_suspension_date = company.get("suspension_date")

    suspension_date = existing_suspension_date
    if company_status == "SUSPENDED":
        if existing_company_status != "SUSPENDED" or not existing_suspension_date:
            suspension_date = datetime.now(timezone.utc).isoformat()
    else:
        suspension_date = None
        suspension_comment = None

    existing_company_status = (company.get("status") or "ACTIVE").upper()
    existing_suspension_date = company.get("suspension_date")

    suspension_date = existing_suspension_date
    if company_status == "SUSPENDED":
        if existing_company_status != "SUSPENDED" or not existing_suspension_date:
            suspension_date = datetime.now(timezone.utc).isoformat()
    else:
        suspension_date = None
        suspension_comment = None

    await db.companies.update_one(
        {"id": req.company_id},
        {
            "$set": {
                "status": company_status,
                "suspension_comment": suspension_comment,
                "suspension_date": suspension_date,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        }
    )

    company["status"] = company_status
    company["suspension_comment"] = suspension_comment
    company["suspension_date"] = suspension_date
    company["suspension_comment"] = suspension_comment
    company["suspension_date"] = suspension_date

    record = CompanyBillTrackingRecord(
        id=existing["id"] if existing else str(uuid.uuid4()),
        company_id=company["id"],
        company_name=company.get("name", "Unknown Company"),
        company_status=company.get("status", "ACTIVE"),
        suspension_comment=company.get("suspension_comment"),
        suspension_date=company.get("suspension_date"),
        total_invoice_amount=round(float(req.total_invoice_amount), 2),
        month_1_name=month_1_name,
        month_1_status=month_1_status,
        month_2_name=month_2_name,
        month_2_status=month_2_status,
        month_3_name=month_3_name,
        month_3_status=month_3_status,
        updated_at=datetime.now(timezone.utc).isoformat(),
        month_1_amount=round(float(req.month_1_amount), 2),
        month_2_amount=round(float(req.month_2_amount), 2),
        month_3_amount=round(float(req.month_3_amount), 2),
        total_amount_due=round(total_amount_due, 2),
    )

    await db.company_bill_tracking.update_one(
        {"company_id": req.company_id},
        {"$set": record.model_dump()},
        upsert=True
    )
    
    history_doc = await db.company_bill_tracking_history.find_one(
        {"company_id": req.company_id},
        {"_id": 0}
    )

    existing_months = history_doc.get("months", []) if history_doc else []

    current_months = [
        {
            "month_name": month_1_name,
            "status": month_1_status,
            "amount": round(float(req.month_1_amount), 2),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "month_name": month_2_name,
            "status": month_2_status,
            "amount": round(float(req.month_2_amount), 2),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "month_name": month_3_name,
            "status": month_3_status,
            "amount": round(float(req.month_3_amount), 2),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
    ]

    merged_by_name = {}

    for item in existing_months:
        merged_by_name[item["month_name"]] = item

    for item in current_months:
        merged_by_name[item["month_name"]] = item

    ordered_names = [item["month_name"] for item in existing_months if item["month_name"] in merged_by_name]
    for item in current_months:
        if item["month_name"] not in ordered_names:
            ordered_names.append(item["month_name"])

    merged_months = [merged_by_name[name] for name in ordered_names][-12:]

    await db.company_bill_tracking_history.update_one(
        {"company_id": req.company_id},
        {
            "$set": {
                "company_id": company["id"],
                "company_name": company.get("name", "Unknown Company"),
                "months": merged_months,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=True,
    )

    return record

@api_router.get("/admin/bill-tracking/{company_id}/statement-pdf")
async def generate_bill_tracking_statement_pdf(company_id: str):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    record = await db.company_bill_tracking.find_one({"company_id": company_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="No bill tracking record found")

    tracking = CompanyBillTrackingRecord(**record)

    statement_lines = []
    statement_total_due = 0.0

    if (tracking.month_1_status or "").upper() == "UNPAID":
        amount = float(tracking.month_1_amount or 0)
        statement_lines.append(
            {
                "month_name": tracking.month_1_name,
                "status": tracking.month_1_status,
                "amount": amount,
            }
        )
        statement_total_due += amount

    if (tracking.month_2_status or "").upper() == "UNPAID":
        amount = float(tracking.month_2_amount or 0)
        statement_lines.append(
            {
                "month_name": tracking.month_2_name,
                "status": tracking.month_2_status,
                "amount": amount,
            }
        )
        statement_total_due += amount

    if (tracking.month_3_status or "").upper() == "UNPAID":
        amount = float(tracking.month_3_amount or 0)
        statement_lines.append(
            {
                "month_name": tracking.month_3_name,
                "status": tracking.month_3_status,
                "amount": amount,
            }
        )
        statement_total_due += amount

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    y = height - 50

    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(50, y, "Statement")
    y -= 30

    pdf.setFont("Helvetica", 11)
    pdf.drawString(50, y, f"Company: {tracking.company_name}")
    y -= 18
    pdf.drawString(50, y, f"Company Status: {tracking.company_status or '-'}")
    y -= 18
    pdf.drawString(50, y, f"Statement Date: {datetime.now(timezone.utc).strftime('%Y-%m-%d')}")
    y -= 30

    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(50, y, "Month")
    pdf.drawString(300, y, "Status")
    pdf.drawRightString(560, y, "Amount")
    y -= 15

    pdf.setFont("Helvetica", 10)

    if not statement_lines:
        pdf.drawString(50, y, "No unpaid items on this statement.")
        y -= 20
    else:
        for line in statement_lines:
            if y < 80:
                pdf.showPage()
                y = height - 50
                pdf.setFont("Helvetica-Bold", 11)
                pdf.drawString(50, y, "Month")
                pdf.drawString(300, y, "Status")
                pdf.drawRightString(560, y, "Amount")
                y -= 15
                pdf.setFont("Helvetica", 10)

            pdf.drawString(50, y, str(line["month_name"] or "-")[:30])
            pdf.drawString(300, y, str(line["status"] or "-")[:20])
            pdf.drawRightString(560, y, f"R {float(line['amount']):.2f}")
            y -= 16

    y -= 20
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawRightString(560, y, f"Total Due: R {statement_total_due:.2f}")

    pdf.showPage()
    pdf.save()
    buffer.seek(0)

    filename = f"statement_{tracking.company_name.replace(' ', '_')}.pdf"

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename=\"{filename}\"'},
    )

@api_router.get(
    "/admin/bill-tracking/{company_id}/history",
    response_model=CompanyBillTrackingHistoryResponse,
)
async def get_company_bill_tracking_history(company_id: str):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    history_doc = await db.company_bill_tracking_history.find_one(
        {"company_id": company_id},
        {"_id": 0}
    )

    if not history_doc:
        return CompanyBillTrackingHistoryResponse(
            company_id=company["id"],
            company_name=company.get("name", "Unknown Company"),
            months=[],
        )

    months = [
        CompanyBillTrackingHistoryEntry(**month)
        for month in history_doc.get("months", [])
    ]

    return CompanyBillTrackingHistoryResponse(
        company_id=history_doc["company_id"],
        company_name=history_doc.get("company_name", company.get("name", "Unknown Company")),
        months=months,
    )

@api_router.get("/auth/me", response_model=User)
async def get_me(user: dict = Depends(get_current_user)):
    return User(**user)

@api_router.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    """Logout user and clear their session"""
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"session_id": None}}
    )
    return {"message": "Logged out successfully"}

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

@api_router.post("/auth/change-password")
async def change_password(req: PasswordChangeRequest, user: dict = Depends(get_current_user)):
    """Change user password"""
    # Get user with password hash
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify current password
    if not verify_password(req.current_password, user_data["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Validate new password
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    # Update password
    new_hash = hash_password(req.new_password)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": new_hash}}
    )
    
    return {"message": "Password changed successfully"}

# ===== MATERIAL ROUTES =====

@api_router.post("/materials", response_model=Material)
async def create_material(material: MaterialCreate, user: dict = Depends(can_edit_materials)):
    mat_data = material.model_dump()
    
    # Calculate total_sqm from width and height (mm to sqm: divide by 1,000,000)
    total_sqm = None
    if mat_data.get("width") and mat_data.get("height") and mat_data["material_type"] != "UNIT":
        total_sqm = (mat_data["width"] * mat_data["height"]) / 1_000_000
    
    mat = Material(**mat_data, company_id=user["company_id"], total_sqm=total_sqm)
    await db.materials.insert_one(mat.model_dump())
    return mat

@api_router.get("/materials", response_model=List[Material])
async def get_materials(user: dict = Depends(can_view_materials)):
    materials = await db.materials.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(1000)
    return materials

@api_router.put("/materials/{material_id}", response_model=Material)
async def update_material(material_id: str, material: MaterialCreate, user: dict = Depends(can_edit_materials)):
    mat_data = material.model_dump()
    
    # Calculate total_sqm from width and height (mm to sqm: divide by 1,000,000)
    total_sqm = None
    if mat_data.get("width") and mat_data.get("height") and mat_data["material_type"] != "UNIT":
        total_sqm = (mat_data["width"] * mat_data["height"]) / 1_000_000
    mat_data["total_sqm"] = total_sqm
    
    result = await db.materials.find_one_and_update(
        {"id": material_id, "company_id": user["company_id"]},
        {"$set": mat_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Material not found")
    result.pop("_id", None)
    return Material(**result)

@api_router.delete("/materials/{material_id}")
async def delete_material(material_id: str, user: dict = Depends(can_edit_materials)):
    result = await db.materials.delete_one({"id": material_id, "company_id": user["company_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Material not found")
    return {"message": "Material deleted"}

# ===== INK PROFILE ROUTES =====

@api_router.post("/ink-profiles", response_model=InkProfile)
async def create_ink_profile(ink: InkProfileCreate, user: dict = Depends(require_manager)):
    ink_obj = InkProfile(**ink.model_dump(), company_id=user["company_id"])
    await db.ink_profiles.insert_one(ink_obj.model_dump())
    return ink_obj

@api_router.get("/ink-profiles", response_model=List[InkProfile])
async def get_ink_profiles(user: dict = Depends(get_current_user)):
    inks = await db.ink_profiles.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(1000)
    return inks

@api_router.put("/ink-profiles/{ink_id}", response_model=InkProfile)
async def update_ink_profile(ink_id: str, ink: InkProfileCreate, user: dict = Depends(require_manager)):
    result = await db.ink_profiles.find_one_and_update(
        {"id": ink_id, "company_id": user["company_id"]},
        {"$set": ink.model_dump()},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Ink profile not found")
    result.pop("_id", None)
    return InkProfile(**result)

@api_router.delete("/ink-profiles/{ink_id}")
async def delete_ink_profile(ink_id: str, user: dict = Depends(require_manager)):
    result = await db.ink_profiles.delete_one({"id": ink_id, "company_id": user["company_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ink profile not found")
    return {"message": "Ink profile deleted"}

# ===== LABOUR TYPE ROUTES =====

@api_router.post("/labour-types", response_model=LabourType)
async def create_labour_type(labour: LabourTypeCreate, user: dict = Depends(require_manager)):
    labour_obj = LabourType(**labour.model_dump(), company_id=user["company_id"])
    await db.labour_types.insert_one(labour_obj.model_dump())
    return labour_obj

@api_router.get("/labour-types", response_model=List[LabourType])
async def get_labour_types(user: dict = Depends(get_current_user)):
    labours = await db.labour_types.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(1000)
    return labours

@api_router.put("/labour-types/{labour_id}", response_model=LabourType)
async def update_labour_type(labour_id: str, labour: LabourTypeCreate, user: dict = Depends(require_manager)):
    result = await db.labour_types.find_one_and_update(
        {"id": labour_id, "company_id": user["company_id"]},
        {"$set": labour.model_dump()},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Labour type not found")
    result.pop("_id", None)
    return LabourType(**result)

@api_router.delete("/labour-types/{labour_id}")
async def delete_labour_type(labour_id: str, user: dict = Depends(require_manager)):
    result = await db.labour_types.delete_one({"id": labour_id, "company_id": user["company_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Labour type not found")
    return {"message": "Labour type deleted"}

# ===== INSTALL TYPE ROUTES =====

@api_router.post("/install-types", response_model=InstallType)
async def create_install_type(install: InstallTypeCreate, user: dict = Depends(require_manager)):
    install_obj = InstallType(**install.model_dump(), company_id=user["company_id"])
    await db.install_types.insert_one(install_obj.model_dump())
    return install_obj

@api_router.get("/install-types", response_model=List[InstallType])
async def get_install_types(user: dict = Depends(get_current_user)):
    installs = await db.install_types.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(1000)
    return installs

@api_router.put("/install-types/{install_id}", response_model=InstallType)
async def update_install_type(install_id: str, install: InstallTypeCreate, user: dict = Depends(require_manager)):
    result = await db.install_types.find_one_and_update(
        {"id": install_id, "company_id": user["company_id"]},
        {"$set": install.model_dump()},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Install type not found")
    result.pop("_id", None)
    return InstallType(**result)

@api_router.delete("/install-types/{install_id}")
async def delete_install_type(install_id: str, user: dict = Depends(require_manager)):
    result = await db.install_types.delete_one({"id": install_id, "company_id": user["company_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Install type not found")
    return {"message": "Install type deleted"}

# ===== RECIPE ROUTES =====

@api_router.post("/recipes", response_model=Recipe)
async def create_recipe(recipe: RecipeCreate, user: dict = Depends(require_manager)):
    # Check for existing recipe with same name to determine version
    existing = await db.recipes.find_one(
        {"company_id": user["company_id"], "name": recipe.name, "archived_at": None},
        {"_id": 0}
    )
    
    version = 1
    if existing:
        version = existing.get("version", 1) + 1
        # Archive the old version (to be auto-archived after 3 months in a background job)
        await db.recipes.update_one(
            {"id": existing["id"]},
            {"$set": {"archived_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    recipe_obj = Recipe(
        **recipe.model_dump(),
        company_id=user["company_id"],
        created_by=user["id"],
        version=version
    )
    await db.recipes.insert_one(recipe_obj.model_dump())
    return recipe_obj

@api_router.get("/recipes", response_model=List[Recipe])
async def get_recipes(user: dict = Depends(get_current_user)):
    recipes = await db.recipes.find(
        {"company_id": user["company_id"], "archived_at": None},
        {"_id": 0}
    ).to_list(1000)
    return recipes

@api_router.get("/recipes/{recipe_id}", response_model=Recipe)
async def get_recipe(recipe_id: str, user: dict = Depends(get_current_user)):
    recipe = await db.recipes.find_one(
        {"id": recipe_id, "company_id": user["company_id"]},
        {"_id": 0}
    )
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return Recipe(**recipe)

@api_router.delete("/recipes/{recipe_id}")
async def delete_recipe(recipe_id: str, user: dict = Depends(require_manager)):
    result = await db.recipes.delete_one({"id": recipe_id, "company_id": user["company_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return {"message": "Recipe deleted"}

# ===== QUOTE ROUTES =====

async def calculate_quote_line(recipe: dict, width_mm: float, height_mm: float, quantity: int, company_id: str, markup_override: Optional[float] = None) -> dict:
    sqm = (width_mm / 1000) * (height_mm / 1000) * quantity
    
    line_items = []
    subtotal = 0.0
    approval_required = False
    
    for recipe_line in recipe["lines"]:
        line_type = recipe_line["line_type"]
        qty_driver = recipe_line["qty_driver"]
        multiplier = recipe_line["multiplier"]
        waste_percent = recipe_line["waste_percent"]
        default_markup = recipe_line["default_markup_percent"]
        markup_allowed = recipe_line["markup_allowed"]
        override_requires_approval = recipe_line["override_requires_approval"]
        
        # Determine quantity based on driver
        if qty_driver == QtyDriver.SQM:
            line_qty = sqm * multiplier
            # Apply waste before rounding
            line_qty = line_qty * (1 + waste_percent / 100)
        elif qty_driver == QtyDriver.HOURS:
            line_qty = multiplier
        else:  # PER_JOB
            line_qty = multiplier
        
        # Get reference data and calculate cost
        cost_per_unit = 0.0
        item_name = recipe_line.get("custom_name", "")
        
        if line_type == LineType.MATERIAL and recipe_line.get("reference_id"):
            material = await db.materials.find_one({"id": recipe_line["reference_id"], "company_id": company_id}, {"_id": 0})
            if material:
                # For UNIT type materials, use unit_price and don't apply sqm calculation
                if material.get("material_type") == "UNIT":
                    cost_per_unit = material.get("unit_price", 0)
                    # For units, qty_driver should be PER_JOB and multiplier is the quantity
                    line_qty = multiplier  # Direct quantity, no sqm calculation
                else:
                    # For SHEET, ROLL, BOARD - use sqm_price
                    cost_per_unit = material.get("sqm_price", 0)
                item_name = item_name or material["name"]
        elif line_type == LineType.INK and recipe_line.get("reference_id"):
            ink = await db.ink_profiles.find_one({"id": recipe_line["reference_id"], "company_id": company_id}, {"_id": 0})
            if ink:
                cost_per_unit = ink["price_per_sqm_coverage"]
                item_name = item_name or ink["name"]
        elif line_type in [LineType.LABOUR, LineType.SPRAY_LABOUR] and recipe_line.get("reference_id"):
            labour = await db.labour_types.find_one({"id": recipe_line["reference_id"], "company_id": company_id}, {"_id": 0})
            if labour:
                cost_per_unit = labour["rate_per_hour"] * labour["number_of_people"]
                item_name = item_name or labour["name"]
        elif line_type == LineType.INSTALL and recipe_line.get("reference_id"):
            install = await db.install_types.find_one({"id": recipe_line["reference_id"], "company_id": company_id}, {"_id": 0})
            if install:
                cost_per_unit = (install["rate_per_hour"] * install["quantity_of_people"]) + install["equipment_rate"]
                item_name = item_name or install["name"]
        elif line_type == LineType.TRAVEL:
            # Travel is now handled per-quote, not in recipe calculation
            cost_per_unit = 0
            item_name = item_name or "Travel"
        elif line_type == LineType.SPRAY_CONSUMABLE:
            cost_per_unit = 50.0  # Default consumable cost (in ZAR)
            item_name = item_name or "Spray Consumable"
        
        line_cost = line_qty * cost_per_unit
        
        # Apply markup if allowed
        markup_to_apply = markup_override if markup_override is not None and markup_allowed else default_markup
        if markup_allowed:
            markup_amount = line_cost * (markup_to_apply / 100)
            line_total = line_cost + markup_amount
            
            # Check if approval required
            if markup_override is not None and override_requires_approval and markup_override != default_markup:
                approval_required = True
        else:
            line_total = line_cost
        
        line_items.append({
            "name": item_name,
            "type": line_type,
            "quantity": round(line_qty, 2),
            "unit_cost": round(cost_per_unit, 2),
            "line_cost": round(line_cost, 2),
            "markup_percent": markup_to_apply if markup_allowed else 0,
            "markup_allowed": markup_allowed,
            "total": round(line_total, 2)
        })
        
        subtotal += line_total
    
    return {
        "line_items": line_items,
        "calculated_sqm": round(sqm, 2),
        "subtotal": round(subtotal, 2),
        "approval_required": approval_required
    }

@api_router.post("/quotes", response_model=Quote)
async def create_quote(quote: QuoteCreate, user: dict = Depends(require_quoting_staff)):
    quote_obj = Quote(
        **quote.model_dump(),
        company_id=user["company_id"],
        created_by=user["id"],
        created_by_name=user["full_name"]
    )
    await db.quotes.insert_one(quote_obj.model_dump())
    return quote_obj

@api_router.get("/quotes", response_model=List[Quote])
async def get_quotes(user: dict = Depends(get_current_user)):
    quotes = await db.quotes.find({"company_id": user["company_id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return quotes

@api_router.get("/quotes/{quote_id}", response_model=Quote)
async def get_quote(quote_id: str, user: dict = Depends(get_current_user)):
    quote = await db.quotes.find_one({"id": quote_id, "company_id": user["company_id"]}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return Quote(**quote)

@api_router.post("/quotes/{quote_id}/lines", response_model=Quote)
async def add_quote_line(quote_id: str, line: QuoteLineCreate, user: dict = Depends(require_quoting_staff)):
    quote = await db.quotes.find_one({"id": quote_id, "company_id": user["company_id"]}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    recipe = await db.recipes.find_one({"id": line.recipe_id, "company_id": user["company_id"]}, {"_id": 0})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    # Calculate line
    calc_result = await calculate_quote_line(
        recipe, line.width_mm, line.height_mm, line.quantity, user["company_id"], line.markup_override
    )
    
    quote_line = QuoteLine(
        recipe_id=line.recipe_id,
        recipe_name=recipe["name"],
        width_mm=line.width_mm,
        height_mm=line.height_mm,
        quantity=line.quantity,
        calculated_sqm=calc_result["calculated_sqm"],
        line_items=calc_result["line_items"],
        subtotal=calc_result["subtotal"],
        markup_applied=line.markup_override or 0,
        total=calc_result["subtotal"],
        markup_override=line.markup_override,
        approval_required=calc_result["approval_required"],
        approval_status="PENDING" if calc_result["approval_required"] else None
    )
    
    # Create approval request if needed
    if calc_result["approval_required"]:
        approval = ApprovalRequest(
            company_id=user["company_id"],
            quote_id=quote_id,
            quote_line_id=quote_line.id,
            requested_by=user["id"],
            requested_by_name=user["full_name"],
            original_markup=30.0,  # Default
            requested_markup=line.markup_override
        )
        await db.approval_requests.insert_one(approval.model_dump())
    
    quote["lines"].append(quote_line.model_dump())
    quote["total_amount"] = sum(line["total"] for line in quote["lines"])
    quote["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.quotes.update_one(
        {"id": quote_id},
        {"$set": {"lines": quote["lines"], "total_amount": quote["total_amount"], "updated_at": quote["updated_at"]}}
    )
    
    return Quote(**quote)

@api_router.delete("/quotes/{quote_id}/lines/{line_id}")
async def delete_quote_line(quote_id: str, line_id: str, user: dict = Depends(get_current_user)):
    quote = await db.quotes.find_one({"id": quote_id, "company_id": user["company_id"]}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    quote["lines"] = [line for line in quote["lines"] if line["id"] != line_id]
    quote["total_amount"] = sum(line["total"] for line in quote["lines"])
    quote["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.quotes.update_one(
        {"id": quote_id},
        {"$set": {"lines": quote["lines"], "total_amount": quote["total_amount"], "updated_at": quote["updated_at"]}}
    )
    
    return {"message": "Line deleted"}

@api_router.delete("/quotes/{quote_id}")
async def delete_quote(quote_id: str, user: dict = Depends(get_current_user)):
    result = await db.quotes.delete_one({"id": quote_id, "company_id": user["company_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Quote not found")
    return {"message": "Quote deleted"}

# ===== QUOTE LABOUR ROUTES =====

@api_router.post("/quotes/{quote_id}/labour")
async def add_quote_labour(quote_id: str, labour: QuoteLabourCreate, user: dict = Depends(require_quoting_staff)):
    quote = await db.quotes.find_one({"id": quote_id, "company_id": user["company_id"]}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    labour_type = await db.labour_types.find_one({"id": labour.labour_type_id, "company_id": user["company_id"]}, {"_id": 0})
    if not labour_type:
        raise HTTPException(status_code=404, detail="Labour type not found")
    
    total_cost = labour_type["rate_per_hour"] * labour_type["number_of_people"] * labour.hours
    
    quote_labour = QuoteLabour(
        labour_type_id=labour.labour_type_id,
        labour_type_name=labour_type["name"],
        number_of_people=labour_type["number_of_people"],
        rate_per_hour=labour_type["rate_per_hour"],
        hours=labour.hours,
        total_cost=total_cost,
        notes=labour.notes
    )
    
    if "labour_items" not in quote:
        quote["labour_items"] = []
    quote["labour_items"].append(quote_labour.model_dump())
    
    # Recalculate total
    lines_total = sum(line["total"] for line in quote.get("lines", []))
    labour_total = sum(item["total_cost"] for item in quote["labour_items"])
    install_total = sum(item["total_cost"] for item in quote.get("installation_items", []))
    travel_total = 0
    if quote.get("travel"):
        travel_total = quote["travel"].get("toll_gates", 0) + quote["travel"].get("subsistence", 0) + quote["travel"].get("accommodation", 0)
    
    quote["total_amount"] = lines_total + labour_total + install_total + travel_total
    quote["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.quotes.update_one(
        {"id": quote_id},
        {"$set": {"labour_items": quote["labour_items"], "total_amount": quote["total_amount"], "updated_at": quote["updated_at"]}}
    )
    
    return {"message": "Labour added", "labour": quote_labour}

@api_router.delete("/quotes/{quote_id}/labour/{labour_id}")
async def delete_quote_labour(quote_id: str, labour_id: str, user: dict = Depends(require_quoting_staff)):
    quote = await db.quotes.find_one({"id": quote_id, "company_id": user["company_id"]}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    quote["labour_items"] = [item for item in quote.get("labour_items", []) if item["id"] != labour_id]
    
    # Recalculate total
    lines_total = sum(line["total"] for line in quote.get("lines", []))
    labour_total = sum(item["total_cost"] for item in quote["labour_items"])
    install_total = sum(item["total_cost"] for item in quote.get("installation_items", []))
    travel_total = 0
    if quote.get("travel"):
        travel_total = quote["travel"].get("toll_gates", 0) + quote["travel"].get("subsistence", 0) + quote["travel"].get("accommodation", 0)
    
    quote["total_amount"] = lines_total + labour_total + install_total + travel_total
    quote["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.quotes.update_one(
        {"id": quote_id},
        {"$set": {"labour_items": quote["labour_items"], "total_amount": quote["total_amount"], "updated_at": quote["updated_at"]}}
    )
    
    return {"message": "Labour deleted"}

# ===== QUOTE INSTALLATION ROUTES =====

@api_router.post("/quotes/{quote_id}/installation")
async def add_quote_installation(quote_id: str, installation: QuoteInstallationCreate, user: dict = Depends(require_quoting_staff)):
    quote = await db.quotes.find_one({"id": quote_id, "company_id": user["company_id"]}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    install_type = await db.install_types.find_one({"id": installation.install_type_id, "company_id": user["company_id"]}, {"_id": 0})
    if not install_type:
        raise HTTPException(status_code=404, detail="Install type not found")
    
    labour_cost = install_type["rate_per_hour"] * install_type["quantity_of_people"] * installation.hours
    total_cost = labour_cost + install_type["equipment_rate"]
    
    quote_installation = QuoteInstallation(
        install_type_id=installation.install_type_id,
        install_type_name=install_type["name"],
        quantity_of_people=install_type["quantity_of_people"],
        rate_per_hour=install_type["rate_per_hour"],
        hours=installation.hours,
        equipment_rate=install_type["equipment_rate"],
        total_cost=total_cost,
        notes=installation.notes
    )
    
    if "installation_items" not in quote:
        quote["installation_items"] = []
    quote["installation_items"].append(quote_installation.model_dump())
    
    # Recalculate total
    lines_total = sum(line["total"] for line in quote.get("lines", []))
    labour_total = sum(item["total_cost"] for item in quote.get("labour_items", []))
    install_total = sum(item["total_cost"] for item in quote["installation_items"])
    travel_total = 0
    if quote.get("travel"):
        travel_total = quote["travel"].get("toll_gates", 0) + quote["travel"].get("subsistence", 0) + quote["travel"].get("accommodation", 0)
    
    quote["total_amount"] = lines_total + labour_total + install_total + travel_total
    quote["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.quotes.update_one(
        {"id": quote_id},
        {"$set": {"installation_items": quote["installation_items"], "total_amount": quote["total_amount"], "updated_at": quote["updated_at"]}}
    )
    
    return {"message": "Installation added", "installation": quote_installation}

@api_router.delete("/quotes/{quote_id}/installation/{installation_id}")
async def delete_quote_installation(quote_id: str, installation_id: str, user: dict = Depends(require_quoting_staff)):
    quote = await db.quotes.find_one({"id": quote_id, "company_id": user["company_id"]}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    quote["installation_items"] = [item for item in quote.get("installation_items", []) if item["id"] != installation_id]
    
    # Recalculate total
    lines_total = sum(line["total"] for line in quote.get("lines", []))
    labour_total = sum(item["total_cost"] for item in quote.get("labour_items", []))
    install_total = sum(item["total_cost"] for item in quote["installation_items"])
    travel_total = 0
    if quote.get("travel"):
        travel_total = quote["travel"].get("toll_gates", 0) + quote["travel"].get("subsistence", 0) + quote["travel"].get("accommodation", 0)
    
    quote["total_amount"] = lines_total + labour_total + install_total + travel_total
    quote["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.quotes.update_one(
        {"id": quote_id},
        {"$set": {"installation_items": quote["installation_items"], "total_amount": quote["total_amount"], "updated_at": quote["updated_at"]}}
    )
    
    return {"message": "Installation deleted"}

# ===== QUOTE TRAVEL ROUTES =====

@api_router.post("/quotes/{quote_id}/travel")
async def add_quote_travel(quote_id: str, travel: QuoteTravelCreate, user: dict = Depends(require_quoting_staff)):
    quote = await db.quotes.find_one({"id": quote_id, "company_id": user["company_id"]}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    quote_travel = QuoteTravel(**travel.model_dump())
    quote["travel"] = quote_travel.model_dump()
    
    # Recalculate total
    lines_total = sum(line["total"] for line in quote.get("lines", []))
    labour_total = sum(item["total_cost"] for item in quote.get("labour_items", []))
    install_total = sum(item["total_cost"] for item in quote.get("installation_items", []))
    travel_total = travel.toll_gates + travel.subsistence + travel.accommodation
    
    quote["total_amount"] = lines_total + labour_total + install_total + travel_total
    quote["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.quotes.update_one(
        {"id": quote_id},
        {"$set": {"travel": quote["travel"], "total_amount": quote["total_amount"], "updated_at": quote["updated_at"]}}
    )
    
    return {"message": "Travel added", "travel": quote_travel}

@api_router.delete("/quotes/{quote_id}/travel")
async def delete_quote_travel(quote_id: str, user: dict = Depends(require_quoting_staff)):
    quote = await db.quotes.find_one({"id": quote_id, "company_id": user["company_id"]}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    quote["travel"] = None
    
    # Recalculate total
    lines_total = sum(line["total"] for line in quote.get("lines", []))
    labour_total = sum(item["total_cost"] for item in quote.get("labour_items", []))
    install_total = sum(item["total_cost"] for item in quote.get("installation_items", []))
    
    quote["total_amount"] = lines_total + labour_total + install_total
    quote["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.quotes.update_one(
        {"id": quote_id},
        {"$set": {"travel": quote["travel"], "total_amount": quote["total_amount"], "updated_at": quote["updated_at"]}}
    )
    
    return {"message": "Travel deleted"}

# ===== ESTIMATION DASHBOARD ROUTES =====

async def can_view_blueprint(user: dict = Depends(get_current_user)) -> dict:
    """CEO and Director can view blueprints, Quoting Staff can edit"""
    if user["role"] not in ["QUOTING_STAFF", "CEO", "MANAGER"]:
        raise HTTPException(status_code=403, detail="Access denied to quote blueprints")
    return user

async def can_edit_blueprint(user: dict = Depends(get_current_user)) -> dict:
    """Only Quoting Staff can edit blueprints"""
    if user["role"] != "QUOTING_STAFF":
        raise HTTPException(status_code=403, detail="Only Quoting Staff can edit blueprints")
    return user

@api_router.post("/estimation/calculate-sign")
async def calculate_sign_estimate(sign: SignEstimateCreate, user: dict = Depends(can_edit_blueprint)):
    """Calculate a sign estimate with full breakdown - returns preview before posting to quote"""
    
    # Get recipe
    recipe = await db.recipes.find_one({"id": sign.recipe_id, "company_id": user["company_id"]}, {"_id": 0})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    # Calculate SQM
    sqm = (sign.width_mm / 1000) * (sign.height_mm / 1000)
    
    # Calculate recipe costs
    recipe_breakdown = []
    recipe_cost = 0.0
    recipe_selling = 0.0
    
    for recipe_line in recipe.get("lines", []):
        line_type = recipe_line["line_type"]
        qty_driver = recipe_line["qty_driver"]
        multiplier = recipe_line["multiplier"]
        waste_percent = recipe_line["waste_percent"]
        markup_percent = recipe_line["default_markup_percent"]
        
        # Determine quantity based on driver
        if qty_driver == "SQM":
            line_qty = sqm * multiplier * (1 + waste_percent / 100)
        elif qty_driver == "HOURS":
            line_qty = multiplier
        else:  # PER_JOB
            line_qty = multiplier
        
        # Get reference data and calculate cost
        cost_per_unit = 0.0
        item_name = recipe_line.get("custom_name", "")
        
        if line_type == "MATERIAL" and recipe_line.get("reference_id"):
            material = await db.materials.find_one({"id": recipe_line["reference_id"], "company_id": user["company_id"]}, {"_id": 0})
            if material:
                if material.get("material_type") == "UNIT":
                    cost_per_unit = material.get("unit_price", 0)
                    line_qty = multiplier
                else:
                    cost_per_unit = material.get("sqm_price", 0)
                item_name = item_name or material["name"]
        elif line_type == "INK" and recipe_line.get("reference_id"):
            ink = await db.ink_profiles.find_one({"id": recipe_line["reference_id"], "company_id": user["company_id"]}, {"_id": 0})
            if ink:
                cost_per_unit = ink["price_per_sqm_coverage"]
                item_name = item_name or ink["name"]
        
        line_cost = line_qty * cost_per_unit
        line_selling = line_cost * (1 + markup_percent / 100)
        
        recipe_breakdown.append({
            "name": item_name,
            "type": line_type,
            "quantity": round(line_qty, 2),
            "unit_cost": round(cost_per_unit, 2),
            "cost": round(line_cost, 2),
            "markup_percent": markup_percent,
            "selling": round(line_selling, 2)
        })
        
        recipe_cost += line_cost
        recipe_selling += line_selling
    
    # Calculate labour costs
    labour_cost = 0.0
    labour_selling = 0.0
    labour_name = ""
    if sign.labour_type_id:
        labour_type = await db.labour_types.find_one({"id": sign.labour_type_id, "company_id": user["company_id"]}, {"_id": 0})
        if labour_type:
            labour_name = labour_type["name"]
            labour_cost = labour_type["rate_per_hour"] * labour_type["number_of_people"] * sign.labour_hours
            labour_selling = labour_cost * 1.3  # Default 30% markup on labour
    
    # Calculate installation/machinery costs
    install_cost = 0.0
    install_selling = 0.0
    install_name = ""
    if sign.install_type_id:
        install_type = await db.install_types.find_one({"id": sign.install_type_id, "company_id": user["company_id"]}, {"_id": 0})
        if install_type:
            install_name = install_type["name"]
            install_cost = (install_type["rate_per_hour"] * install_type["quantity_of_people"] * sign.install_hours) + install_type["equipment_rate"]
            install_selling = install_cost * 1.3  # Default 30% markup
    
    # Calculate travel costs (using company default rate or 5.50 ZAR/km)
    travel_rate = 5.50  # Default rate per km
    travel_cost = sign.travel_km * travel_rate
    travel_selling = travel_cost * 1.2  # 20% markup on travel
    
    # Calculate accommodation (using default rate or from config)
    accommodation_rate = 1500.0  # Default ZAR per day
    accommodation_cost = sign.accommodation_days * accommodation_rate
    accommodation_selling = accommodation_cost * 1.15  # 15% markup
    
    # Calculate custom items
    custom_items = []
    custom_total_cost = 0.0
    custom_total_selling = 0.0
    for item in sign.custom_items:
        custom_item = CustomLineItem(
            description=item.get("description", ""),
            quantity=item.get("quantity", 1),
            cost=item.get("cost", 0),
            markup_percent=item.get("markup_percent", 0),
            selling_price=item.get("selling_price", 0)
        )
        custom_items.append(custom_item.model_dump())
        custom_total_cost += custom_item.cost * custom_item.quantity
        custom_total_selling += custom_item.selling_price * custom_item.quantity
    
    # Calculate totals
    total_cost = recipe_cost + labour_cost + install_cost + travel_cost + accommodation_cost + custom_total_cost
    total_selling = recipe_selling + labour_selling + install_selling + travel_selling + accommodation_selling + custom_total_selling
    profit_margin = ((total_selling - total_cost) / total_cost * 100) if total_cost > 0 else 0
    
    # Build sign estimate
    sign_estimate = SignEstimate(
        sign_name=sign.sign_name or f"Sign {sign.width_mm}x{sign.height_mm}mm",
        width_mm=sign.width_mm,
        height_mm=sign.height_mm,
        calculated_sqm=round(sqm, 2),
        recipe_id=sign.recipe_id,
        recipe_name=recipe["name"],
        recipe_breakdown=recipe_breakdown,
        recipe_cost=round(recipe_cost, 2),
        recipe_selling=round(recipe_selling, 2),
        labour_type_id=sign.labour_type_id,
        labour_type_name=labour_name,
        labour_hours=sign.labour_hours,
        labour_cost=round(labour_cost, 2),
        labour_selling=round(labour_selling, 2),
        install_type_id=sign.install_type_id,
        install_type_name=install_name,
        install_hours=sign.install_hours,
        install_cost=round(install_cost, 2),
        install_selling=round(install_selling, 2),
        travel_km=sign.travel_km,
        travel_rate_per_km=travel_rate,
        travel_cost=round(travel_cost, 2),
        travel_selling=round(travel_selling, 2),
        accommodation_days=sign.accommodation_days,
        accommodation_rate_per_day=accommodation_rate,
        accommodation_cost=round(accommodation_cost, 2),
        accommodation_selling=round(accommodation_selling, 2),
        custom_items=custom_items,
        custom_total_cost=round(custom_total_cost, 2),
        custom_total_selling=round(custom_total_selling, 2),
        total_cost=round(total_cost, 2),
        total_selling=round(total_selling, 2),
        profit_margin=round(profit_margin, 1)
    )
    
    return sign_estimate.model_dump()

@api_router.post("/quotes/{quote_id}/signs")
async def add_sign_to_quote(quote_id: str, sign: SignEstimateCreate, user: dict = Depends(can_edit_blueprint)):
    """Calculate and add a sign to the quote blueprint"""
    
    quote = await db.quotes.find_one({"id": quote_id, "company_id": user["company_id"]}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    # Only the creator can edit
    if quote["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the quote creator can add signs")
    
    # Calculate the sign estimate
    sign_data = await calculate_sign_estimate(sign, user)
    
    # Initialize blueprint if not exists
    blueprint = quote.get("blueprint") or {"signs": [], "total_cost": 0, "total_selling": 0, "total_profit": 0, "profit_margin_percent": 0}
    
    # Add sign to blueprint
    blueprint["signs"].append(sign_data)
    
    # Recalculate blueprint totals
    total_cost = sum(s["total_cost"] for s in blueprint["signs"])
    total_selling = sum(s["total_selling"] for s in blueprint["signs"])
    total_profit = total_selling - total_cost
    profit_margin_percent = (total_profit / total_cost * 100) if total_cost > 0 else 0
    
    blueprint["total_cost"] = round(total_cost, 2)
    blueprint["total_selling"] = round(total_selling, 2)
    blueprint["total_profit"] = round(total_profit, 2)
    blueprint["profit_margin_percent"] = round(profit_margin_percent, 1)
    
    # Update quote with new blueprint and client-facing total
    await db.quotes.update_one(
        {"id": quote_id},
        {"$set": {
            "blueprint": blueprint,
            "total_amount": blueprint["total_selling"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Sign added to quote", "sign": sign_data, "blueprint_totals": {
        "total_cost": blueprint["total_cost"],
        "total_selling": blueprint["total_selling"],
        "total_profit": blueprint["total_profit"],
        "profit_margin_percent": blueprint["profit_margin_percent"]
    }}

@api_router.delete("/quotes/{quote_id}/signs/{sign_id}")
async def remove_sign_from_quote(quote_id: str, sign_id: str, user: dict = Depends(can_edit_blueprint)):
    """Remove a sign from the quote blueprint"""
    
    quote = await db.quotes.find_one({"id": quote_id, "company_id": user["company_id"]}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    if quote["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the quote creator can remove signs")
    
    blueprint = quote.get("blueprint")
    if not blueprint:
        raise HTTPException(status_code=404, detail="No blueprint found")
    
    # Remove sign
    blueprint["signs"] = [s for s in blueprint["signs"] if s["id"] != sign_id]
    
    # Recalculate totals
    total_cost = sum(s["total_cost"] for s in blueprint["signs"])
    total_selling = sum(s["total_selling"] for s in blueprint["signs"])
    total_profit = total_selling - total_cost
    profit_margin_percent = (total_profit / total_cost * 100) if total_cost > 0 else 0
    
    blueprint["total_cost"] = round(total_cost, 2)
    blueprint["total_selling"] = round(total_selling, 2)
    blueprint["total_profit"] = round(total_profit, 2)
    blueprint["profit_margin_percent"] = round(profit_margin_percent, 1)
    
    await db.quotes.update_one(
        {"id": quote_id},
        {"$set": {
            "blueprint": blueprint,
            "total_amount": blueprint["total_selling"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Sign removed", "blueprint_totals": blueprint}

@api_router.get("/quotes/{quote_id}/blueprint")
async def get_quote_blueprint(quote_id: str, user: dict = Depends(can_view_blueprint)):
    """Get the internal blueprint for a quote - Quoting Staff sees full edit, CEO/Manager view-only"""
    
    quote = await db.quotes.find_one({"id": quote_id, "company_id": user["company_id"]}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    can_edit = user["role"] == "QUOTING_STAFF" and quote["created_by"] == user["id"]
    
    return {
        "quote_id": quote_id,
        "client_name": quote["client_name"],
        "client_email": quote.get("client_email"),
        "client_phone": quote.get("client_phone"),
        "client_address": quote.get("client_address"),
        "description": quote.get("description"),
        "blueprint": quote.get("blueprint") or {"signs": [], "total_cost": 0, "total_selling": 0, "total_profit": 0, "profit_margin_percent": 0},
        "quote_status": quote["quote_status"],
        "can_edit": can_edit,
        "created_by_name": quote["created_by_name"],
        "created_at": quote["created_at"],
        "updated_at": quote["updated_at"]
    }

@api_router.put("/quotes/{quote_id}/client-details")
async def update_quote_client_details(quote_id: str, client_name: str, client_email: Optional[str] = None, client_phone: Optional[str] = None, client_address: Optional[str] = None, description: Optional[str] = None, user: dict = Depends(can_edit_blueprint)):
    """Update client details on a quote"""
    
    quote = await db.quotes.find_one({"id": quote_id, "company_id": user["company_id"]}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    if quote["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the quote creator can update client details")
    
    await db.quotes.update_one(
        {"id": quote_id},
        {"$set": {
            "client_name": client_name,
            "client_email": client_email,
            "client_phone": client_phone,
            "client_address": client_address,
            "description": description,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Client details updated"}

@api_router.post("/quotes/{quote_id}/complete")
async def complete_quote(quote_id: str, user: dict = Depends(can_edit_blueprint)):
    """Mark quote as completed and ready for approval"""
    
    quote = await db.quotes.find_one({"id": quote_id, "company_id": user["company_id"]}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    if quote["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the quote creator can complete the quote")
    
    blueprint = quote.get("blueprint")
    if not blueprint or not blueprint.get("signs"):
        raise HTTPException(status_code=400, detail="Cannot complete quote without any signs")
    
    await db.quotes.update_one(
        {"id": quote_id},
        {"$set": {
            "quote_status": "COMPLETED",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Quote marked as completed"}

# ===== JOB TICKET ROUTES =====


# ===== QUOTE APPROVAL ROUTES =====

@api_router.post("/quotes/{quote_id}/submit-for-approval")
async def submit_quote_for_approval(quote_id: str, user: dict = Depends(require_quoting_staff)):
    quote = await db.quotes.find_one({"id": quote_id, "company_id": user["company_id"]}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    # Check if quote has lines
    if not quote.get("lines") or len(quote["lines"]) == 0:
        raise HTTPException(status_code=400, detail="Cannot submit empty quote for approval")
    
    # Update quote to submitted status
    await db.quotes.update_one(
        {"id": quote_id},
        {"$set": {
            "quote_status": "SUBMITTED",
            "quote_approval_status": "PENDING",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Quote submitted for approval"}

@api_router.post("/quotes/{quote_id}/approve")
async def approve_quote(quote_id: str, user: dict = Depends(require_manager)):
    quote = await db.quotes.find_one({"id": quote_id, "company_id": user["company_id"]}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    # Prevent self-approval
    if quote["created_by"] == user["id"]:
        raise HTTPException(status_code=403, detail="You cannot approve your own quote")
    
    # Update quote approval
    await db.quotes.update_one(
        {"id": quote_id},
        {"$set": {
            "quote_approval_status": "APPROVED",
            "approved_by": user["id"],
            "approved_by_name": user["full_name"],
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Quote approved successfully"}

@api_router.post("/quotes/{quote_id}/reject")
async def reject_quote(quote_id: str, rejection_reason: str, user: dict = Depends(require_manager)):
    quote = await db.quotes.find_one({"id": quote_id, "company_id": user["company_id"]}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    # Update quote rejection
    await db.quotes.update_one(
        {"id": quote_id},
        {"$set": {
            "quote_approval_status": "REJECTED",
            "quote_status": "DRAFT",  # Send back to draft
            "approved_by": user["id"],
            "approved_by_name": user["full_name"],
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "rejection_reason": rejection_reason,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Quote rejected", "reason": rejection_reason}

@api_router.get("/quotes/pending-approval/list")
async def get_pending_quotes(user: dict = Depends(require_manager)):
    quotes = await db.quotes.find(
        {"company_id": user["company_id"], "quote_approval_status": "PENDING", "quote_status": "SUBMITTED"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return quotes

@api_router.post("/quotes/{quote_id}/convert-to-job")
async def convert_quote_to_job(quote_id: str, user: dict = Depends(require_quoting_staff)):
    quote = await db.quotes.find_one({"id": quote_id, "company_id": user["company_id"]}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    # Check if quote is approved
    if quote.get("quote_approval_status") != "APPROVED":
        raise HTTPException(status_code=400, detail="Quote must be approved before converting to job ticket")
    
    # Generate job ticket number
    job_ticket_number = f"JOB-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{quote_id[:8].upper()}"
    
    await db.quotes.update_one(
        {"id": quote_id},
        {"$set": {"job_ticket_number": job_ticket_number, "quote_status": "JOB_CREATED", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Quote converted to job ticket", "job_ticket_number": job_ticket_number}


# ===== APPROVAL ROUTES =====

@api_router.get("/approvals", response_model=List[ApprovalRequest])
async def get_approvals(user: dict = Depends(require_manager)):
    approvals = await db.approval_requests.find(
        {"company_id": user["company_id"], "status": "PENDING"},
        {"_id": 0}
    ).to_list(1000)
    return approvals

@api_router.post("/approvals/{approval_id}/approve")
async def approve_request(approval_id: str, user: dict = Depends(require_manager)):
    approval = await db.approval_requests.find_one(
        {"id": approval_id, "company_id": user["company_id"]},
        {"_id": 0}
    )
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found")
    
    # Prevent self-approval
    if approval["requested_by"] == user["id"]:
        raise HTTPException(status_code=403, detail="You cannot approve your own markup override request")
    
    # Update approval
    await db.approval_requests.update_one(
        {"id": approval_id},
        {"$set": {
            "approval_status": "APPROVED",
            "approved_by": user["id"],
            "approved_by_name": user["full_name"],
            "resolved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update quote line
    quote = await db.quotes.find_one({"id": approval["quote_id"]}, {"_id": 0})
    if quote:
        for line in quote["lines"]:
            if line["id"] == approval["quote_line_id"]:
                line["approval_status"] = "APPROVED"
        await db.quotes.update_one(
            {"id": approval["quote_id"]},
            {"$set": {"lines": quote["lines"]}}
        )
    
    return {"message": "Approval granted"}

@api_router.post("/approvals/{approval_id}/reject")
async def reject_request(approval_id: str, user: dict = Depends(require_manager)):
    approval = await db.approval_requests.find_one(
        {"id": approval_id, "company_id": user["company_id"]},
        {"_id": 0}
    )
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found")
    
    # Prevent self-rejection
    if approval["requested_by"] == user["id"]:
        raise HTTPException(status_code=403, detail="You cannot reject your own markup override request")
    
    # Update approval
    await db.approval_requests.update_one(
        {"id": approval_id},
        {"$set": {
            "approval_status": "REJECTED",
            "approved_by": user["id"],
            "approved_by_name": user["full_name"],
            "resolved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update quote line
    quote = await db.quotes.find_one({"id": approval["quote_id"]}, {"_id": 0})
    if quote:
        for line in quote["lines"]:
            if line["id"] == approval["quote_line_id"]:
                line["approval_status"] = "REJECTED"
        await db.quotes.update_one(
            {"id": approval["quote_id"]},
            {"$set": {"lines": quote["lines"]}}
        )
    
    return {"message": "Approval rejected"}

# ===== EXPORT ROUTES =====

@api_router.get("/quotes/{quote_id}/export/pdf")
async def export_quote_pdf(quote_id: str, user: dict = Depends(get_current_user)):
    quote = await db.quotes.find_one({"id": quote_id, "company_id": user["company_id"]}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    company = await db.companies.find_one({"id": quote["company_id"]}, {"_id": 0})
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    elements = []
    styles = getSampleStyleSheet()
    
    # Title
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=24, textColor=colors.HexColor('#0F172A'))
    elements.append(Paragraph(f"Quote for {quote['client_name']}", title_style))
    elements.append(Spacer(1, 12))
    
    # Company info
    info_style = styles['Normal']
    elements.append(Paragraph(f"<b>Company:</b> {company['name']}", info_style))
    elements.append(Paragraph(f"<b>Prepared by:</b> {quote['created_by_name']}", info_style))
    elements.append(Paragraph(f"<b>Date:</b> {quote['created_at'][:10]}", info_style))
    if quote.get('description'):
        elements.append(Paragraph(f"<b>Description:</b> {quote['description']}", info_style))
    elements.append(Spacer(1, 20))
    
    # Line items table
    for idx, line in enumerate(quote['lines']):
        elements.append(Paragraph(f"<b>Line {idx + 1}: {line['recipe_name']}</b>", styles['Heading3']))
        elements.append(Paragraph(f"Size: {line['width_mm']}mm x {line['height_mm']}mm | Qty: {line['quantity']} | SqM: {line['calculated_sqm']}", info_style))
        elements.append(Spacer(1, 6))
        
        table_data = [['Item', 'Qty', 'Unit Cost', 'Line Cost', 'Markup', 'Total']]
        for item in line['line_items']:
            table_data.append([
                item['name'],
                str(item['quantity']),
                f"R {item['unit_cost']:.2f}",
                f"R {item['line_cost']:.2f}",
                f"{item['markup_percent']}%" if item['markup_allowed'] else "N/A",
                f"R {item['total']:.2f}"
            ])
        
        table = Table(table_data, colWidths=[60*mm, 20*mm, 25*mm, 25*mm, 20*mm, 25*mm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563EB')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        elements.append(table)
        elements.append(Spacer(1, 12))
        elements.append(Paragraph(f"<b>Line Total: R {line['total']:.2f}</b>", styles['Heading4']))
        elements.append(Spacer(1, 20))
    
    # Labour Section
    if quote.get('labour_items') and len(quote['labour_items']) > 0:
        elements.append(Paragraph("<b>Labour Items</b>", styles['Heading3']))
        elements.append(Spacer(1, 6))
        labour_table_data = [['Labour Type', 'People', 'Rate/Hr', 'Hours', 'Total']]
        for labour in quote['labour_items']:
            labour_table_data.append([
                labour['labour_type_name'],
                str(labour['number_of_people']),
                f"R {labour['rate_per_hour']:.2f}",
                str(labour['hours']),
                f"R {labour['total_cost']:.2f}"
            ])
        labour_table = Table(labour_table_data, colWidths=[60*mm, 25*mm, 30*mm, 25*mm, 35*mm])
        labour_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563EB')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        elements.append(labour_table)
        elements.append(Spacer(1, 20))
    
    # Installation Section
    if quote.get('installation_items') and len(quote['installation_items']) > 0:
        elements.append(Paragraph("<b>Installation Items</b>", styles['Heading3']))
        elements.append(Spacer(1, 6))
        install_table_data = [['Installation Type', 'People', 'Rate/Hr', 'Hours', 'Equipment', 'Total']]
        for install in quote['installation_items']:
            install_table_data.append([
                install['install_type_name'],
                str(install['quantity_of_people']),
                f"R {install['rate_per_hour']:.2f}",
                str(install['hours']),
                f"R {install['equipment_rate']:.2f}",
                f"R {install['total_cost']:.2f}"
            ])
        install_table = Table(install_table_data, colWidths=[50*mm, 20*mm, 25*mm, 20*mm, 25*mm, 35*mm])
        install_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563EB')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        elements.append(install_table)
        elements.append(Spacer(1, 20))
    
    # Travel Section
    if quote.get('travel'):
        elements.append(Paragraph("<b>Travel</b>", styles['Heading3']))
        elements.append(Spacer(1, 6))
        travel = quote['travel']
        travel_info = f"Vehicle: {travel['vehicle_type']} | Rate: R {travel['rate_per_km']:.2f}/km<br/>"
        travel_info += f"Tolls: R {travel['toll_gates']:.2f} | Subsistence: R {travel['subsistence']:.2f} | Accommodation: R {travel['accommodation']:.2f}"
        elements.append(Paragraph(travel_info, info_style))
        travel_total = travel['toll_gates'] + travel['subsistence'] + travel['accommodation']
        elements.append(Paragraph(f"<b>Travel Total: R {travel_total:.2f}</b>", styles['Heading4']))
        elements.append(Spacer(1, 20))
    
    # Grand total
    elements.append(Paragraph(f"<b>GRAND TOTAL: R {quote['total_amount']:.2f}</b>", styles['Heading2']))
    
    doc.build(elements)
    buffer.seek(0)
    
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=quote_{quote_id}.pdf"}
    )

@api_router.get("/quotes/{quote_id}/export/bom")
async def export_quote_bom(quote_id: str, user: dict = Depends(get_current_user)):
    quote = await db.quotes.find_one({"id": quote_id, "company_id": user["company_id"]}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    wb = Workbook()
    ws = wb.active
    ws.title = "BOM"
    
    # Headers
    ws.append(["Material", "Type", "Quantity", "Unit", "Roll Width (mm)", "Roll Meters", "Sheet Size", "Sheets Required", "Units Required"])
    
    # Aggregate materials
    material_totals = {}
    
    for line in quote['lines']:
        for item in line['line_items']:
            if item['type'] == 'MATERIAL':
                mat_name = item['name']
                qty = item['quantity']
                
                if mat_name not in material_totals:
                    material_totals[mat_name] = qty
                else:
                    material_totals[mat_name] += qty
    
    # Convert to roll/sheet/unit
    for mat_name, total_qty in material_totals.items():
        # Get material details
        material = await db.materials.find_one({"name": mat_name, "company_id": user["company_id"]}, {"_id": 0})
        
        mat_type = ""
        unit = ""
        roll_meters = ""
        sheets = ""
        units = ""
        roll_width = ""
        sheet_size = ""
        
        if material:
            mat_type = material.get('material_type', 'UNKNOWN')
            
            if mat_type == 'UNIT':
                # Unit-based material (e.g., LED modules)
                unit = "units"
                units = math.ceil(total_qty)
            elif mat_type == 'ROLL':
                # Roll-based material - width is roll width, height is roll length
                unit = "sqm"
                if material.get('width'):
                    roll_width = material['width']
                    # Calculate roll meters needed: total sqm / (roll width in meters)
                    roll_meters = math.ceil(total_qty / (roll_width / 1000))
            elif mat_type == 'SHEET' or mat_type == 'BOARD':
                # Sheet/Board-based material - width and height are sheet dimensions
                unit = "sqm"
                if material.get('width') and material.get('height'):
                    sheet_size = f"{material['width']}x{material['height']}"
                    # Calculate sheets needed: total sqm / (sheet area in sqm)
                    sheet_area = (material['width'] * material['height']) / 1_000_000
                    sheets = math.ceil(total_qty / sheet_area)
        
        ws.append([
            mat_name, 
            mat_type, 
            round(total_qty, 2), 
            unit,
            roll_width, 
            roll_meters, 
            sheet_size, 
            sheets, 
            units
        ])
    
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    
    return Response(
        content=buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=bom_{quote_id}.xlsx"}
    )

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
