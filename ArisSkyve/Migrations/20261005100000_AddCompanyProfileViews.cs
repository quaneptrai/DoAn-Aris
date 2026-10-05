using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArisSkyve.Migrations;

[DbContext(typeof(ArisDBContext))]
[Migration("20261005100000_AddCompanyProfileViews")]
public partial class AddCompanyProfileViews : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "CompanyProfileViews",
            columns: table => new
            {
                Id = table.Column<long>(type: "bigint", nullable: false)
                    .Annotation("SqlServer:Identity", "1, 1"),
                BusinessAccountId = table.Column<int>(type: "int", nullable: false),
                ViewedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_CompanyProfileViews", x => x.Id);
                table.ForeignKey(
                    name: "FK_CompanyProfileViews_Profiles_BusinessAccountId",
                    column: x => x.BusinessAccountId,
                    principalTable: "Profiles",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_CompanyProfileViews_BusinessAccountId_ViewedAtUtc",
            table: "CompanyProfileViews",
            columns: new[] { "BusinessAccountId", "ViewedAtUtc" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "CompanyProfileViews");
    }
}
