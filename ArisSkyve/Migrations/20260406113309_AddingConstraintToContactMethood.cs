using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArisSkyve.Migrations
{
    /// <inheritdoc />
    public partial class AddingConstraintToContactMethood : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ContactMethods_Profiles_EmployesAccountId",
                table: "ContactMethods");

            migrationBuilder.DropIndex(
                name: "IX_ContactMethods_EmployesAccountId",
                table: "ContactMethods");

            migrationBuilder.DropColumn(
                name: "EmployesAccountId",
                table: "ContactMethods");

            migrationBuilder.CreateIndex(
                name: "IX_ContactMethods_idEmployesAccount",
                table: "ContactMethods",
                column: "idEmployesAccount");

            migrationBuilder.AddForeignKey(
                name: "FK_ContactMethods_Profiles_idEmployesAccount",
                table: "ContactMethods",
                column: "idEmployesAccount",
                principalTable: "Profiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ContactMethods_Profiles_idEmployesAccount",
                table: "ContactMethods");

            migrationBuilder.DropIndex(
                name: "IX_ContactMethods_idEmployesAccount",
                table: "ContactMethods");

            migrationBuilder.AddColumn<int>(
                name: "EmployesAccountId",
                table: "ContactMethods",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_ContactMethods_EmployesAccountId",
                table: "ContactMethods",
                column: "EmployesAccountId");

            migrationBuilder.AddForeignKey(
                name: "FK_ContactMethods_Profiles_EmployesAccountId",
                table: "ContactMethods",
                column: "EmployesAccountId",
                principalTable: "Profiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
