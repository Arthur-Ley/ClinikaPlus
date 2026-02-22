# Backend (Express + Supabase)

## Project structure

- `src/controllers` request handlers
- `src/services` Supabase/business logic
- `src/models` simple payload validation/domain shaping
- `src/routes` route definitions
- `src/middlewares` shared middleware (404 + error)
- `src/utils` helpers (like `asyncHandler`)

## 1. Install dependencies

```bash
cd backend
npm install
```

## 2. Configure environment

Copy `.env.example` to `.env` and set:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PORT` (optional, default `4000`)
- `CORS_ORIGIN` (optional, default `http://localhost:5173`)

## 3. Run backend

```bash
npm run dev
```

## Starter endpoints

- `GET /api/health`
- `GET /api/medications`
- `GET /api/storage/buckets`
- `POST /api/storage/signed-upload-url`
- `GET /api/medications/categories`
- `GET /api/medications/suppliers`
- `POST /api/medications`

### Signed upload request body

```json
{
  "bucket": "your-bucket",
  "path": "records/file-1.png"
}
```

### Add medication request body

```json
{
  "medication_name": "Amoxicillin",
  "category_id": 1,
  "form": "Capsule",
  "strength": "500mg",
  "unit": "pcs",
  "reorder_threshold": 120,
  "batch_number": "AMX-2502A1",
  "quantity": 200,
  "expiry_date": "2027-06-30",
  "supplier_id": 2
}
```
