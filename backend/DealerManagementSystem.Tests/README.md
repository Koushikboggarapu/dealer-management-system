# Dealer Management System tests

## What is covered

| Requirement | Automated coverage |
| --- | --- |
| Dealer cannot access another dealer's orders | Read, update, transition, list and search checks, plus positive owner/Admin checks |
| Invalid transitions are rejected | All 98 role/from/to combinations; persisted rejection of draft approval and approved cancellation; submitted edits rejected |
| Insufficient stock has no partial deductions | Multi-product order: status, history, both stocks and product row versions stay unchanged |
| Approval is atomic | Injected failure after SQL writes but before commit: stock, order and history all roll back |
| Repeated approval cannot deduct stock twice | Fresh contexts for both calls; one deduction, one audit entry, unchanged versions on retry |
| Concurrent approvals cannot oversell | Two independent contexts/transactions read the same stock and row version before either writes |
| Concurrent requests for the same order cannot double-deduct | Same synchronization mechanism, one committed approval and one conflict; later retry is idempotent |
| Submitted prices are preserved | Price change between draft and submission is captured; later catalog changes do not alter stored or returned totals, including after approval |
| Other workflow checks | Blank rejection reason fails; owner can cancel draft/submitted orders without affecting stock |

These are unit tests and service/persistence integration tests. They exercise the real `OrderService`, `UnitOfWork`, repositories, EF migrations and SQL Server provider. They do not host the API or test HTTP/JWT middleware. They do not require the API to be running, Swagger tokens or User Secrets.

## Run in Visual Studio (no terminal required)

1. Stop debugging the API and save all files.
2. Open `DealerManagementSystem.slnx` if it is not already loaded.
3. Select **Build > Rebuild Solution**.
4. Select **Test > Test Explorer**.
5. Run the tests under `DealerManagementSystem.Tests`.
6. Use the `Category` trait to select `Unit` or `SqlServer` tests separately.
7. A failing test's details show the assertion, exception and stack trace. Report the first failure, not database credentials.

The unit tests need no database. SQL Server tests need the running `(localdb)\ProjectModels` instance already used for local development, and permission to create/drop databases. SQL tests fail with a setup error if SQL Server is unavailable; they are not silently skipped or run on EF InMemory/SQLite.

## Database isolation and cleanup

- Every integration test case creates a new database named `DmsTests_<random-guid>`.
- The real EF migrations create its schema. Independent test-only users and products are inserted.
- The application seeder is not called.
- The working `DealerManagementSystem` database is never selected or modified by these tests.
- The fixture deletes only its own exact generated name, after checking the prefix and GUID.
- Connection pooling is disabled for test connections, and contexts are disposed before cleanup.
- Test execution has a cancellation deadline; the concurrency barrier and SQL commands have separate timeouts.
- The SQL collection runs tests sequentially to avoid multiple simultaneous database creations. Each concurrency test deliberately runs its two requests concurrently inside that test.
- If Visual Studio or the test process is forcibly terminated, normal cleanup cannot run. An orphan `DmsTests_<guid>` database may remain; inspect it before manually deleting it. Never delete the working database.

To use another dedicated SQL Server instance in CI or on another machine, set the **test-specific** environment variable `DMS_TEST_SQLSERVER` before launching Visual Studio/the test process. Provide server/authentication/TLS settings appropriate for that instance. The fixture always replaces `Initial Catalog` with a fresh test name and clears `AttachDBFilename`. It never reads the application's connection string or `ConnectionStrings__DefaultConnection`. Do not point test credentials at a production server.

## How concurrency is exercised

Two approvals use separate contexts and real SQL transactions. A test-only EF `SavingChangesAsync` interceptor pauses them after both services have read and validated inventory but before either issues SQL writes. The test asserts both saw stock 5 and the same 8-byte SQL Server row version. Each order requests 4 of the shared product.

Expected result: exactly one approval commits and the other receives the application's 409 conflict exception. Shared stock is 1, not negative. For different orders, the losing order stays Submitted, has no approval audit entry, and its non-shared product stock is untouched. For the same order, there is only one deduction and one approval entry. This is not merely a pair of sequential requests or a timing-based sleep.

The injected post-save failure test separately checks explicit transaction rollback after writes have actually occurred. A stock-validation-only test would not prove rollback behavior by itself.

## Optional command-line execution

From the solution directory, these commands can be run manually:

- `dotnet test backend/DealerManagementSystem.Tests/DealerManagementSystem.Tests.csproj --filter "Category=Unit"`
- `dotnet test backend/DealerManagementSystem.Tests/DealerManagementSystem.Tests.csproj --filter "Category=SqlServer"`
- `dotnet test backend/DealerManagementSystem.Tests/DealerManagementSystem.Tests.csproj`

A successful build is not a successful test run. Confirm the results in Test Explorer or the test runner before considering these rules verified.
