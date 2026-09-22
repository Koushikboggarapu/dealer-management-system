using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DealerManagementSystem.Infrastructure.Migrations;

public partial class AddProductPriceHistory : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "ProductPriceHistories",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                ProductId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                ChangedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                ChangedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                OldPrice = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                NewPrice = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ProductPriceHistories", x => x.Id);
                table.CheckConstraint("CK_ProductPriceHistories_Prices", "[OldPrice] > 0 AND [NewPrice] > 0 AND [OldPrice] <> [NewPrice]");
                table.ForeignKey("FK_ProductPriceHistories_Products_ProductId", x => x.ProductId,
                    "Products", "Id", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_ProductPriceHistories_Users_ChangedByUserId", x => x.ChangedByUserId,
                    "Users", "Id", onDelete: ReferentialAction.Restrict);
            });
        migrationBuilder.CreateIndex("IX_ProductPriceHistories_ChangedByUserId", "ProductPriceHistories", "ChangedByUserId");
        migrationBuilder.CreateIndex("IX_ProductPriceHistories_ProductId_ChangedAt_Id", "ProductPriceHistories",
            new[] { "ProductId", "ChangedAt", "Id" });
    }

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable("ProductPriceHistories");
}
