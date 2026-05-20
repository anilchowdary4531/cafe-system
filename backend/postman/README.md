# Cafe System API Collections

Files:
- `cafe-system.postman_collection.json` (all services)
- `cafe-system.postman_environment.json` (local env variables)

Services included:
- Health
- Auth Service
- Super Admin Service
- Public Menu Service
- Owner Dashboard Service
- Owner Menu Service
- Owner Tables Service
- Order Service

Postman import:
1. Open Postman.
2. Click `Import`.
3. Import `cafe-system.postman_collection.json` for the master collection.
4. Import `cafe-system.postman_environment.json`.
5. Select the `Cafe System Local` environment.

Split service collections:
- Import any file from `services/` if you want a smaller collection.
- `services/super-admin-service.postman_collection.json` contains the Super Admin test flow.

Recommended test order:
1. `Health / GET /`
2. `Super Admin Service / 1. Login - Super Admin`
3. `Super Admin Service / 2. List Restaurants`
4. `Super Admin Service / 4. Create Restaurant + Owner`
5. `Super Admin Service / 7. Login - Created Owner`
