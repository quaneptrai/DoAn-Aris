using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArisSkyve.Migrations
{
    /// <inheritdoc />
    public partial class ChangingContactmethoodToProfile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PhoneNumber",
                table: "Profiles");

            migrationBuilder.AddColumn<int>(
                name: "EmployesAccountId",
                table: "ContactMethods",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ContactMethods_EmployesAccountId",
                table: "ContactMethods",
                column: "EmployesAccountId");

            migrationBuilder.AddForeignKey(
                name: "FK_ContactMethods_Profiles_EmployesAccountId",
                table: "ContactMethods",
                column: "EmployesAccountId",
                principalTable: "Profiles",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
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

            migrationBuilder.AddColumn<string>(
                name: "PhoneNumber",
                table: "Profiles",
                type: "nvarchar(max)",
                nullable: true);
        }
    }
}
