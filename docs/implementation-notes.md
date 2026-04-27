# HMS Implementation Notes

## MVP implemented in this phase

- Core auth API in Django (`/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/me`)
- Patient profile bootstrap with generated external patient ID
- FastAPI queue service scaffold with token generation and current queue view
- React app shell with bilingual EN/AR + RTL/LTR switching

## Compliance-ready structure

- User roles prepared for RBAC expansion
- Patient profile includes consent metadata fields
- Patient external ID separated from internal DB key

## Design tokens (frontend)

- Teal: `#0E8A8A`
- Deep Navy: `#10243E`
- Accent: `#27B6A9`
