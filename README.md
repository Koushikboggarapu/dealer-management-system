# Dealer Management System (DMS)

An Angular and ASP.NET Core application for managing dealer profiles, product inventory and the order lifecycle. Dealers browse active products, prepare drafts and track their own orders. Administrators manage dealers/products and handle approval and fulfillment.

> Start here: this README covers both `backend/` and `frontend/`. The database uses EF Core **Code First migrations**. A database backup is not needed for a fresh setup.

## Contents

- [Features](#features)
- [Technology and versions](#technology-and-versions)
- [Repository structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Local setup](#local-setup)
- [Demo credentials](#demo-credentials)
- [Migrations and seed data](#migrations-and-seed-data)
- [Swagger and API conventions](#swagger-and-api-conventions)
- [Running tests and builds](#running-tests-and-builds)
- [Design decisions](#design-decisions)
- [Known limitations and tradeoffs](#known-limitations-and-tradeoffs)
- [Troubleshooting](#troubleshooting)
- [Submission checklist](#submission-checklist)


## Backend Application Setup 

{ 
  "Jwt:Key": "mOTtCrLNDV7/uRXTPsw3cqfNSWkHwflaglC7sLumpug=" 
} 

Step 2: Build the Application 

Build the solution to restore dependencies and ensure the application compiles successfully. 

Step 3: Configure the Database Connection 

Update the SQL Server connection string in appsettings.json and DealerManagementSystem.Infrastructure/Persistence/DmsDbContextFactory.cs. Ensure both files point to the correct SQL Server instance and database. 

Step 4: Apply Database Migrations 

Open Package Manager Console and run: Update-Database. This applies the Entity Framework Core migrations and creates or updates the database schema. 

Step 5: Run the Application 

Start the API project using Visual Studio or the .NET CLI. 

## Features

### Authentication and roles

- JWT login with backend role-based authorization for **Admin** and **Dealer**.
- BCrypt password hashing, login rate limiting, Angular route guards and an HTTP authentication interceptor.
- Development seed accounts for both roles, including two dealers for ownership testing.

### Dealer and product management

- Admin dealer creation, viewing, editing and activation/deactivation.
- Dealer code, company, contact person, email, phone, address and active status.
- Unique dealer codes/emails enforced by service checks and database indexes.
- Admin product creation/editing and activation/deactivation.
- Product code, name, category, price, available stock and SQL Server `RowVersion`.
- Searchable, paginated active-product catalog for dealers.
- Inactive dealers cannot create, edit or submit drafts; historical order access remains available.

### Ordering and fulfillment

- Multiple-product drafts; quantity changes and item removal before submission.
- Positive whole-number quantities and backend-calculated prices/totals.
- Current product prices captured on submission; later catalog price changes do not alter submitted prices.
- Dealer-scoped order lists and ownership checks for reading, editing and transitioning orders.
- Search, status filtering and pagination for order lists.
- Status history with previous/new status, user, timestamp and remarks.

| Actor | Permitted transition |
| --- | --- |
| Owning Dealer | Draft ? Submitted |
| Owning Dealer | Draft ? Cancelled |
| Owning Dealer | Submitted ? Cancelled |
| Admin | Submitted ? Approved |
| Admin | Submitted ? Rejected, with a nonblank reason |
| Admin | Approved ? Dispatched |
| Admin | Dispatched ? Delivered |

Stock is deducted **only on approval**. Approval validates all items and commits stock, status and history together. Submitted orders cannot be edited; approved orders cannot be cancelled by the dealer.

### Optional enhancements

- **Product price history:** Admin-only read-only view of successful price changes, including actor, UTC timestamp and old/new prices. Non-price changes and failed updates do not add entries.
- **Low Stock Products:** Admin dashboard section for **active** products with `AvailableStock <= 5`, including zero. Uses server pagination and explicit refresh; no email or push notifications.
- Responsive sidebar workspace, simple login page, status badges, loading/error states and unsaved-edit prompts.

## Technology and versions

Versions below describe the checked-in project references and package ranges, not a claim about the exact versions installed on another machine. `frontend/package-lock.json` determines the resolved frontend dependency versions when using `npm ci`.

| Component | Version/configuration |
| --- | --- |
| Backend runtime/target | .NET 8 / `net8.0` |
| API | ASP.NET Core Web API |
| EF Core SQL Server, Design and Tools | 8.0.11 |
| JWT bearer package | 8.0.11 |
| SQL database | SQL Server; development connection defaults to LocalDB `ProjectModels` |
| Angular framework | `^20.3.0` |
| Angular CLI/build | `^20.3.37` |
| Angular Material/CDK | `^20.2.14` |
| TypeScript | `~5.9.2` |
| RxJS | `~7.8.0` |
| BCrypt.Net-Next | 4.2.0 |
| FluentValidation | 11.11.0 |
| AutoMapper | 15.1.1 |
| Serilog.AspNetCore | 8.0.3 |
| Swashbuckle.AspNetCore | 6.9.0 |
| Backend tests | xUnit 2.9.3, Microsoft.NET.Test.Sdk 17.14.1 |
| Frontend tests | Jasmine `~5.9.0`, Karma `~6.4.0`, ChromeHeadless |

Use an Angular-20-compatible Node.js release, for example **Node 22.12+ within the 22.x line** or a supported **Node 24.x** release. Do not assume a newer, unsupported Node major will work. Verify installed tooling with `dotnet --info`, `node --version` and `npm --version`.

AutoMapper 15 has licensing requirements: review its terms for the intended use. The API accepts an optional `AutoMapper:LicenseKey` configuration value; do not commit a real license key.

## Repository structure

```text
README.md
DealerManagementSystem.slnx
backend/
  DealerManagementSystem.API/             Controllers, JWT, middleware, startup and configuration
  DealerManagementSystem.Application/     DTOs, validation, mapping, services and persistence contracts
  DealerManagementSystem.Domain/          Entities, roles and order statuses
  DealerManagementSystem.Infrastructure/  DbContext, repositories, migrations, hashing and development seeder
  DealerManagementSystem.Tests/           Unit and SQL Server integration tests
frontend/
  package.json
  package-lock.json
  src/app/
    core/                                Authentication, guards, interceptor, models and API services
    features/                            Auth, Admin, Dealer and order screens
    layout/                              Responsive authenticated shell
    shared/                              Shared UI imports and pagination behavior
```

The `.slnx` solution format requires a compatible recent Visual Studio/.NET SDK. If your tooling cannot open it, use the project-specific CLI commands below; they do not require `.slnx` support.

## Prerequisites

1. .NET 8 SDK and runtime (or a compatible SDK with the .NET 8 runtime available).
2. SQL Server with permissions to create/update the development database.
   - The default LocalDB setup is **Windows-only**.
   - For Linux/macOS or another SQL Server instance, override the connection string.
3. Compatible Node.js and npm.
4. Chrome to run the Angular tests with `ChromeHeadless`.
5. Optional: Visual Studio with ASP.NET tooling, and `dotnet-ef` **8.0.11** for manual migration commands.

## Local setup

The following examples use **PowerShell**. Start in the repository root, the directory containing this README. Keep API and frontend in separate terminals.

### 1. Restore the backend

```powershell
dotnet restore backend/DealerManagementSystem.API/DealerManagementSystem.API.csproj
```

### 2. Configure SQL Server

The default connection in `backend/DealerManagementSystem.API/appsettings.json` is:

```text
Server=(localdb)\ProjectModels;Database=DealerManagementSystem;Trusted_Connection=True;TrustServerCertificate=True
```

On Windows, inspect available LocalDB instances:

```powershell
sqllocaldb info
```

If `ProjectModels` does not exist, create it once. Then start it:

```powershell
# Run create only if this instance is missing.
sqllocaldb create ProjectModels
sqllocaldb start ProjectModels
```

Alternatively, use an existing instance such as `MSSQLLocalDB` by overriding the connection string in User Secrets:

```powershell
dotnet user-secrets set "ConnectionStrings:DefaultConnection" 'Server=(localdb)\MSSQLLocalDB;Database=DealerManagementSystem;Trusted_Connection=True;TrustServerCertificate=True' --project backend/DealerManagementSystem.API
```

For a separate SQL Server, provide that server's connection string instead. Use environment variable `ConnectionStrings__DefaultConnection` or a secret store for deployment. Do not commit passwords. `TrustServerCertificate=True` is a local-development convenience, not recommended production TLS configuration.

### 3. Set a JWT signing key

The API intentionally does **not** contain a committed signing key. Startup requires `Jwt:Key` with at least 32 UTF-8 bytes. Generate a random key and store it locally:

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$jwtKey = [Convert]::ToBase64String($bytes)
dotnet user-secrets set "Jwt:Key" $jwtKey --project backend/DealerManagementSystem.API
Remove-Variable jwtKey, bytes
```

A `UserSecretsId` already exists in the API project; `dotnet user-secrets init` is not necessary. User Secrets are a development mechanism, not an encrypted production vault. Do not share the key or screenshots showing tokens/secrets. For deployment, supply `Jwt__Key` through an appropriate secret-management mechanism.

Issuer and audience defaults are configured in `appsettings.json`:

- Issuer: `DealerManagementSystem`
- Audience: `DealerManagementSystem.Angular`

### 4. Trust the local HTTPS certificate

```powershell
dotnet dev-certs https --trust
```

Certificate-trust support is platform dependent. Confirm the API HTTPS URL opens without a certificate warning before testing browser API calls.

### 5. Start the API and initialize the development database

```powershell
dotnet run --project backend/DealerManagementSystem.API --launch-profile https
```

The HTTPS launch profile sets `ASPNETCORE_ENVIRONMENT=Development`. `appsettings.Development.json` sets `Database:Initialize=true`.

With both conditions satisfied, `Program.cs`:

1. Applies pending EF migrations with `MigrateAsync`.
2. Runs `DatabaseSeeder.SeedDevelopmentAsync`.
3. Serves the application after initialization succeeds.

Default endpoints:

| Application | URL |
| --- | --- |
| API HTTPS | `https://localhost:7020` |
| Swagger UI | `https://localhost:7020/swagger` |
| OpenAPI JSON | `https://localhost:7020/swagger/v1/swagger.json` |
| Angular | `http://localhost:4200` |

In Visual Studio, start `DealerManagementSystem.API` using its **https** profile. Stop/rebuild/restart the API after backend source changes; refreshing Angular does not rebuild the API.

### 6. Install and start Angular

In a second terminal:

```powershell
cd frontend
npm ci
npm start
```

Open `http://localhost:4200` and use a seeded account below. `npm start` is a development server and continues running until stopped with Ctrl+C.

The frontend API URL is configured through `API_BASE_URL` in `frontend/src/app/core/api.ts`, currently `https://localhost:7020/api`. The backend allows `http://localhost:4200` through `FrontendOrigin`. Change both settings consistently if using other hosts or ports. Backend secrets must never be placed in Angular configuration.

## Demo credentials

**Development/demo use only. Never deploy these known passwords to a public environment.**

| Role | Username | Password | Dealer profile |
| --- | --- | --- | --- |
| Admin | `admin` | `Admin@123` | Not applicable |
| Dealer | `dealer1` | `Dealer@123` | `DLR001` |
| Dealer | `dealer2` | `Dealer@123` | `DLR002` |

Use separate normal/private browser sessions when comparing Admin and Dealer screens. Use `dealer2` to verify that a different dealer cannot list/read/edit/transition `dealer1` orders.

The seeder also contains a **local practice account** named `dealer3`, password `Dealer@123`. It is created only if an existing dealer has both code `PRACTICE01` and ID `21517552-D7FC-499F-8299-639F7CCCF75F`. That practice profile is **not** created by the seeder. Consequently, `dealer3` is not guaranteed on a fresh installation; reviewers should use the three portable accounts listed above.

Existing usernames are not recreated, reassigned or given new passwords on subsequent startup. Creating a dealer in the Admin UI creates a business profile only; it does not provision a login account.

## Migrations and seed data

- Migrations: `backend/DealerManagementSystem.Infrastructure/Migrations/`
- DbContext and constraints: `backend/DealerManagementSystem.Infrastructure/Persistence/DmsDbContext.cs`
- Seed data: `backend/DealerManagementSystem.Infrastructure/Persistence/DatabaseSeeder.cs`

Included migrations:

| Migration | Purpose |
| --- | --- |
| `20260921140806_InitialCreate` | Users, dealers, products, orders, order items and order status history |
| `20260922120000_AddProductPriceHistory` | Product-price audit records with product/user foreign keys |

Low-stock alerts reuse existing product fields and require no separate migration.

### Apply migrations manually (optional)

Automatic Development initialization is sufficient for the normal quick start. For manual control, stop the API and use `dotnet-ef` matching EF Core 8:

```powershell
# Install only if dotnet-ef is not already installed.
dotnet tool install --global dotnet-ef --version 8.0.11

$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet ef database update --project backend/DealerManagementSystem.Infrastructure --startup-project backend/DealerManagementSystem.API -- --Database:Initialize=false
```

If a global `dotnet-ef` already exists, inspect it with `dotnet ef --version` and use a compatible tool installation. Do not generate another migration merely to apply those already supplied.

The trailing `Database:Initialize=false` argument disables application startup initialization for that EF command; the CLI still applies migrations. Restart the API normally with Development initialization enabled to run the seeder afterward.

A migration changes **schema**. Seeding inserts **data** into existing tables via `SaveChangesAsync`, so adding a development account does not itself require a new migration.

### Seed behavior

- Creates missing Admin/Dealer users and their demo dealer profiles.
- Hashes passwords with BCrypt; the database stores hashes, not plaintext passwords.
- Creates starter Office Chair and Office Desk products only when the product table is empty.
- Intended for one-instance local development startup, not concurrent multi-instance provisioning.
- Startup initialization is disabled by default outside Development. Production migration deployment and account provisioning need an explicit operational process.

### Fresh-database verification

Before handoff, test setup against a **separate development database name**, for example `DealerManagementSystem_Verification`, by overriding `ConnectionStrings:DefaultConnection`. Start in Development with initialization enabled, then verify the tables, seeded logins and starter products. Preserve your original connection settings and restore them afterward. Do not delete the working database to perform this check.

## Swagger and API conventions

Swagger/OpenAPI is available in **Development**. To test authentication:

1. Open `/swagger`.
2. Execute `POST /api/auth/login` with a demo username/password.
3. Copy the `token` from the response data.
4. Select **Authorize** and paste the raw JWT into the HTTP bearer field; Swagger supplies the Bearer scheme.
5. Execute protected endpoints using the appropriate role. Clear authorization when switching accounts.

| Endpoint | Purpose / access |
| --- | --- |
| `POST /api/auth/login` | Anonymous, rate-limited login |
| `GET /api/dealers`, `GET /api/dealers/{id}` | Admin dealer list/details |
| `POST /api/dealers`, `PUT /api/dealers/{id}` | Admin create/update |
| `GET /api/products` | Admin catalog; Dealer active products only |
| `POST /api/products`, `PUT /api/products/{id}` | Admin create/update; updates require RowVersion |
| `GET /api/products/{id}/price-history` | Admin paginated price history |
| `GET /api/orders`, `GET /api/orders/{id}` | Admin or owning Dealer |
| `POST /api/orders`, `PUT /api/orders/{id}` | Dealer draft creation/update |
| `POST /api/orders/{id}/status` | Role- and state-validated workflow action |
| `GET /api/dashboard` | Admin dealer count and order counts by current status |
| `GET /api/dashboard/low-stock` | Admin paginated active products with stock <= 5 |

Lists use `page` and `size`; search/status parameters apply where supported. Page numbers are one-based and page size is limited to 100.

Responses use an envelope with `success`, `message` and `data`. Typical status codes:

- `200`: successful read/update/action; `201`: successful creation.
- `400`: invalid input; `401`: missing/invalid authentication or incorrect login.
- `403`: unauthorized role or inactive-dealer ordering restriction.
- `404`: missing resource; another dealer's order also returns 404 to avoid revealing its existence.
- `409`: duplicate values, invalid transitions, insufficient stock or concurrency conflicts.
- `429`: login rate limit; `500`: generic unexpected error with a request ID.

Validation messages are readable but not a field-keyed Problem Details contract. Serilog logs requests and application failures; operational logs are separate from persisted order/price audit history.

## Running tests and builds

### Backend

From the repository root:

```powershell
# All backend tests
dotnet test backend/DealerManagementSystem.Tests/DealerManagementSystem.Tests.csproj

# Unit tests only: no database needed
dotnet test backend/DealerManagementSystem.Tests/DealerManagementSystem.Tests.csproj --filter "Category=Unit"

# SQL Server integration tests only
dotnet test backend/DealerManagementSystem.Tests/DealerManagementSystem.Tests.csproj --filter "Category=SqlServer"

# Release build of the API and its referenced projects
dotnet build backend/DealerManagementSystem.API/DealerManagementSystem.API.csproj --configuration Release
```

In Visual Studio, open Test Explorer and run `DealerManagementSystem.Tests`.

SQL integration tests:

- Use real EF migrations and SQL Server, not EF InMemory or SQLite.
- Default to `(localdb)\ProjectModels`. An application connection-string override does **not** change this test setting.
- Create isolated `DmsTests_<guid>` databases and delete only their own database afterward.
- Require create/drop database permissions on a **development/test server**, never a production server.
- Do not need the API running, JWT secrets or Swagger tokens.
- Use `DMS_TEST_SQLSERVER` to select another test SQL Server. Example for an existing local instance:

```powershell
$env:DMS_TEST_SQLSERVER = 'Server=(localdb)\MSSQLLocalDB;Integrated Security=True;TrustServerCertificate=True'
dotnet test backend/DealerManagementSystem.Tests/DealerManagementSystem.Tests.csproj
```

The fixture replaces the database name and clears attached-file settings. Forced process termination may leave an orphan test database; inspect its identity before cleanup.

### Required scenario coverage

| Scenario | Test location / evidence |
| --- | --- |
| Another dealer cannot access orders | `OrderServiceSqlServerTests`: read, edit, transition, list and search ownership checks |
| Invalid status transitions rejected | `OrderTransitionTests`: role/status matrix; integration checks for persisted invalid actions |
| Insufficient stock without partial deductions | `OrderServiceSqlServerTests`: multi-product stock/status/history remain unchanged |
| Repeated approval does not deduct twice | `OrderServiceSqlServerTests`: one deduction and one approval entry across repeated requests |
| Concurrent approvals cannot oversell | `OrderServiceSqlServerTests`: synchronized separate contexts/transactions, same-order and different-order cases |
| Catalog price changes preserve submitted orders | `OrderServiceSqlServerTests`: capture at submission and preservation afterward |
| Transaction rollback after writes | `OrderServiceSqlServerTests`: injected post-save/pre-commit failure rolls back stock/status/history |

Additional suites cover product-price auditing, low-stock boundaries and the conditional practice-account seeder. Seeder-specific tests invoke the development seeder inside their isolated database; the standard fixture otherwise uses its own test records.

### Frontend

From `frontend`:

```powershell
npm ci
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
```

For interactive/watch testing, use `npm test`. To compile an unoptimized development build, use `npm run build -- --configuration development`; that does not replace production-build verification.

Frontend tests are written in **Jasmine**, run by **Karma** in ChromeHeadless, and use Angular TestBed and mocked HTTP responses. Coverage includes authentication/session handling, guards/interceptor, request payloads, dealer search, draft editing, order actions, price history, low-stock dashboard, navigation and login layout.

The production frontend is written beneath `frontend/dist/dealer-management-ui/`. Production hosting must serve the browser output and provide an SPA fallback to `index.html` for deep routes.

### Verification status

Automated test source is supplied, but previous passing counts must not be treated as proof for a later revision. Run the **full current backend suite, frontend suite and production build** before submission and retain their summaries. Manual UI checks have been performed during development, but they do not replace automated concurrency/rollback tests. This README does not claim every latest test/build has passed.

## Design decisions

### Proportionate layered monolith

Controllers handle HTTP, authentication boundaries and DTO responses. Application services enforce business rules. Domain entities represent business data. Infrastructure owns EF Core, SQL Server configuration, repositories and transactions. A single API/database keeps deployment proportionate; there are no microservices or message brokers.

Repository and unit-of-work interfaces isolate persistence from services. EF Core already provides similar concepts, so these abstractions are deliberately small rather than a second generic ORM. Asynchronous database operations propagate cancellation tokens.

### Server authority and price snapshots

Draft writes accept product IDs and integer quantities; the server retrieves active products and calculates prices/totals. Submission reloads current catalog prices into order-item `UnitPrice` and stores the total. Submitted orders are immutable to dealer edits. Existing order prices therefore remain independent of later catalog price changes.

Draft list totals are last-persisted estimates; draft details calculate current catalog estimates. Unsaved editor totals are browser estimates and are labeled accordingly. Product names are not historical snapshots.

### Transactions and optimistic concurrency

- SQL Server-generated `RowVersion` columns on Product and Order are EF concurrency tokens, not timestamps or audit trails.
- Approval begins a transaction, loads the order/products, validates all stock, deducts stock, changes status and adds history, then saves and commits.
- If another writer changed a row, EF's version-checked update fails. The losing transaction rolls back; the API returns a conflict instead of allowing partial changes or overselling.
- A nonnegative-stock database constraint provides another safeguard.
- Concurrent requests that target the same order cannot both commit deductions against the same original versions.
- After approval has completed, a repeated Admin approval request returns the existing Approved/Dispatched/Delivered order without deducting stock or adding another approval entry.
- The browser does not blindly retry failed transitions: it asks the user to reload because a lost response may follow a successful server commit.

The concurrency integration test uses a barrier before writes so both requests read the same stock/version. Manual two-tab clicks alone do not guarantee that requests overlapped in the database.

Product editing also submits the version fetched by the UI. The service rejects an already-stale version, and EF detects writes that race after that check. This prevents old editing forms from restoring inventory or prices changed by another operation.

### Authorization and ownership

Angular guards and role-aware menus improve navigation only. API JWT validation and role attributes provide server-side access control. Services enforce order ownership using the authenticated actor's dealer ID, not a dealer ID trusted from the draft payload. Active-dealer checks use current database state, so deactivation blocks new order operations even with an existing token.

### Audit and inventory alerts

Order status history is saved with the transition. Optional price-history entries use the authenticated Admin user ID and server UTC time and commit atomically with actual price changes. There are no public history-update/delete endpoints. History displays the user's current username via its foreign key.

Low-stock alerts query the existing product table for active stock <= 5. A fixed threshold avoids schema/configuration complexity; users refresh to see changes. Dashboard status counts represent **current** statuses, not how many orders ever passed through a status.

## Known limitations and tradeoffs

1. **Dealer profiles are not login accounts.** UI-created profiles need separately provisioned User records. Self-registration, invitations, password reset and general Admin account-provisioning screens are not implemented. Demo roles are supplied by seeding.
2. **Development-only startup setup.** Production needs controlled migrations, secure account provisioning, HTTPS/CORS configuration and an operational deployment process. Known seed credentials must not be enabled publicly.
3. **JWT lifecycle.** Tokens last approximately 60 minutes (server clock-skew tolerance applies). No refresh-token or revocation endpoint exists. Logout clears browser state but does not invalidate a copied token before expiry.
4. **Browser storage.** Session data/token use `sessionStorage`, which is accessible to JavaScript. Angular escaping helps but does not make storage immune to XSS. Production should review CSP and the session strategy; a secure HttpOnly-cookie/BFF approach is an alternative.
5. **Audit scope.** Price history does not track product names, categories, stock edits or dealer-profile changes. It is not a tamper-proof compliance log; privileged SQL changes can bypass application auditing. Earlier price changes are not backfilled.
6. **Optimistic conflicts require reload.** Conflicting edits/approvals return 409 rather than automatically retrying a business decision. The current pattern favors correctness and user review over transparent retry.
7. **Inventory is not reserved on submission.** Several submitted orders may request the same stock; only approval allocates it. Inactive products are rejected at draft editing/submission; deactivation does not automatically cancel already-submitted orders.
8. **Draft limits.** Empty drafts can be saved but not submitted. Requests are limited to 100 distinct products and quantities from 1 to 1,000,000. Duplicate product lines are rejected by the backend and merged by the editor.
9. **Pricing scope.** Positive two-decimal unit prices are supported; no taxes, discounts, shipping charges, multiple currencies or returns workflow is included.
10. **Dashboard consistency.** Counts/list queries are separate reads, so concurrent changes can briefly make displayed totals differ. Refresh to reconcile. No SignalR/live notifications are implemented.
11. **Testing scope.** SQL tests primarily exercise services and persistence; authorization metadata checks are not a full HTTP/JWT middleware test suite. Angular tests mock the API. No full browser E2E or screenshot-regression suite is supplied.
12. **Development portability.** LocalDB is Windows-only; `.slnx` requires compatible tooling. Use a separate SQL Server and project-level CLI commands where necessary. Exact local SDK/Node installations are not pinned by the project.

## Troubleshooting

| Symptom | Check/action |
| --- | --- |
| API says to set `Jwt:Key` | Configure API User Secrets and run in Development, or provide the appropriate environment secret |
| SQL Server/LocalDB connection fails | Verify the instance exists/runs, connection string, authentication and database permissions |
| Login fails with demo credentials | Confirm Development initialization ran against the intended database; existing usernames/passwords are not reset by seeding |
| `dealer3` cannot log in | It needs the exact pre-existing local `PRACTICE01` ID; use `dealer1`/`dealer2` for fresh-install testing |
| Browser cannot reach API | Start HTTPS profile, trust certificate, verify port 7020, `API_BASE_URL` and CORS origin |
| `npm` reports missing `package.json` | Run npm commands from `frontend`, not the repository root |
| UI looks outdated | Wait for Angular compilation, then refresh; use Ctrl+F5 if necessary |
| Product update returns 409 | Reload and reselect the current product; do not resubmit an old RowVersion |
| Order action returns 409 | Reload status/history and inventory before another permitted action |
| Price history says invalid object/table | Apply the supplied price-history migration to the same database the API uses |
| SQL tests fail during setup | Start `ProjectModels` or configure `DMS_TEST_SQLSERVER`; allow isolated test DB creation/deletion |
| `Build.BuildSolution` unavailable in a folder-based IDE session | Use the explicit `dotnet build`/`dotnet test` project commands and Angular commands above |

## Submission checklist

- [ ] Include this README, backend/frontend source, project files, frontend lockfile, migrations and automated tests.
- [ ] Verify a clean install against a separate fresh development database.
- [ ] Verify `admin`, `dealer1` and `dealer2` login and the documented Swagger URLs.
- [ ] Run and record the latest backend tests, frontend tests and production build.
- [ ] Test core UI workflows and optional price-history/low-stock features after the latest changes.
- [ ] Exclude generated artifacts such as `node_modules`, `bin`, `obj`, `dist`, `.angular`, `.vs`, logs and temporary test results from the submission package.
- [ ] Do not include JWT keys, real connection passwords, User Secrets files or private data exports.
- [ ] Review configuration and AutoMapper licensing before deployment beyond the assignment.

Submit a repository link or source ZIP according to the interviewer's instructions. A successful build alone is not evidence that tests passed.
