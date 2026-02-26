# SignageQuote - Product Requirements Document

## Overview
Multi-tenant web application for wide format signage estimating with role-based access control.

## Core Features

### Authentication & Access Control
- **Roles:** Manager, Procurement, Quoting Staff, CEO
- **JWT-based authentication**
- **Single-session enforcement:** When logging in from another device while already logged in, all sessions are terminated and account is locked for 3 hours
- **Password management:** Users can change their password via Settings page

### Role Permissions
| Role | Materials | Ink | Labour | Install | Recipes | Quotes | Approvals |
|------|-----------|-----|--------|---------|---------|--------|-----------|
| Manager | View | Edit | Edit | Edit | Edit | View | Approve |
| Procurement | Edit | Edit | - | - | - | - | - |
| Quoting Staff | - | - | - | - | - | Edit | View |
| CEO | Edit | Edit | Edit | Edit | Edit | View | Approve |

### Materials Management
- **Simplified model:** Width (mm), Height (mm), auto-calculated Total SqM
- **Types:** Sheet, Roll, Board, Unit
- **Pricing:** SqM-based for area materials, Unit-based for LED modules etc.
- **Currency:** South African Rand (ZAR) with "R" symbol

### Quote System
- Create quotes from recipes with dimensions
- Dynamic calculation of material quantities, waste, and markup
- Quote approval workflow (Submit → Approve/Reject → Convert to Job)
- PDF export for clients
- Excel BOM export for procurement

### Recipe Management
- Assembly of line items (Material, Ink, Labour, etc.)
- Configurable waste percentages and markup
- Version control with archiving

## Technical Architecture

### Backend
- **Framework:** FastAPI
- **Database:** MongoDB (Motor async driver)
- **Auth:** JWT with PyJWT, Passlib for hashing
- **Exports:** ReportLab (PDF), OpenPyXL (Excel)

### Frontend
- **Framework:** React 18
- **Routing:** React Router v6
- **UI:** TailwindCSS, Shadcn/UI components
- **HTTP:** Axios
- **Toasts:** Sonner

### Data Models
```
users: {id, email, hashed_password, role, company_id, session_id, lockout_until}
materials: {id, company_id, name, material_type, width, height, total_sqm, sqm_price, unit_price, ...}
recipes: {id, company_id, name, version, lines[], archived_at}
quotes: {id, company_id, client_name, lines[], labour_items[], installation_items[], travel, status, ...}
```

## Implementation Status

### Completed (December 2024)
- [x] Full-stack scaffolding (FastAPI + React)
- [x] Role-based authentication for all roles
- [x] Multi-tenant data isolation
- [x] Materials CRUD with simplified width/height fields
- [x] Ink Profiles, Labour Types, Install Types management
- [x] Recipe creation and management
- [x] Quote creation with dynamic calculation
- [x] Quote approval workflow
- [x] PDF and BOM exports
- [x] Session lockout mechanism (3-hour penalty)
- [x] Password change functionality
- [x] Settings page

### Backlog
- [ ] **P2: Recipe Versioning** - Auto-version on edit, archive old versions after 3 months

## API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login (enforces single-session)
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout and clear session
- `POST /api/auth/change-password` - Change password

### Materials
- `GET /api/materials` - List materials
- `POST /api/materials` - Create material (auto-calculates total_sqm)
- `PUT /api/materials/{id}` - Update material
- `DELETE /api/materials/{id}` - Delete material

### Quotes
- `GET /api/quotes` - List quotes
- `POST /api/quotes` - Create quote
- `GET /api/quotes/{id}` - Get quote detail
- `POST /api/quotes/{id}/lines` - Add quote line
- `POST /api/quotes/{id}/submit-for-approval` - Submit for approval
- `POST /api/quotes/{id}/approve` - Approve quote
- `POST /api/quotes/{id}/reject` - Reject quote
- `POST /api/quotes/{id}/convert-to-job` - Convert to job ticket
- `GET /api/quotes/{id}/export/pdf` - Export PDF
- `GET /api/quotes/{id}/export/bom` - Export BOM Excel

## Session Security
When a user attempts to login while already logged in on another device:
1. Existing session is immediately terminated
2. Account is locked for 3 hours
3. User sees message: "Account locked. Try again in Xh Xm."

This prevents unauthorized access from compromised credentials and encourages proper logout behavior.
