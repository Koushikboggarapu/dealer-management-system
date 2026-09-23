Dealer Management System (DMS) 

Project README & Submission Documentation 

Database Migrations and Seed Data 

Entity Framework Core migrations are included in backend/DealerManagementSystem.Infrastructure/Migrations/. 

The seed data implementation is available in backend/DealerManagementSystem.Infrastructure/Persistence/DatabaseSeeder.cs. 

When the application runs in Development and Database:Initialize=true, startup automatically applies migrations, creates demo accounts, dealer profiles, and sample products. 

Existing demo accounts are not recreated and passwords are not reset. 

Demo Credentials 

Administrator: admin / Admin@123 

Dealer 1: dealer1 / Dealer@123 

Dealer 2: dealer2 / Dealer@123 

Swagger / OpenAPI Documentation 

The API exposes Swagger/OpenAPI documentation for interactive endpoint exploration and testing. 

Access Instructions 

Configure the database connection and JWT settings. 

Run the API in the Development environment. 

Navigate to: 

https://localhost:/swagger 

Use one of the demo accounts to authenticate through the Login endpoint. 

Copy the returned JWT access token. 

Select Authorize in Swagger and provide the bearer token. 

Execute secured endpoints according to the appropriate user role. 

The API uses JWT Bearer Authentication and Role-Based Authorization. Swagger is enabled in the Development environment and documents all available API endpoints, request models, and response schemas. 

Automated Tests 

Unit Tests validate business rules without database dependencies. 

OrderTransitionTests covers 98 combinations of roles and status transitions. 

SQL Server Integration Tests validate persistence, transactions, concurrency, audit logging, price snapshots, stock handling, and authorization scenarios. 

Integration tests create isolated DmsTests_<guid> databases and remove them after execution. 

Running Tests 

dotnet test backend/DealerManagementSystem.Tests/DealerManagementSystem.Tests.csproj 

dotnet test backend/DealerManagementSystem.Tests/DealerManagementSystem.Tests.csproj --filter Category=Unit 

dotnet test backend/DealerManagementSystem.Tests/DealerManagementSystem.Tests.csproj --filter Category=SqlServer 

Verification Status 

Unit Tests: 98 Passed, 0 Failed. 

SQL Server Integration Tests reviewed and available for execution. 
