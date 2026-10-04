using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArisSkyve.Migrations
{
    /// <inheritdoc />
    public partial class ChangingCursorContactMethoodToEmployeesAccount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ContactMethods_Profiles_EmployesAccountId",
                table: "ContactMethods");

            migrationBuilder.DropForeignKey(
                name: "FK_ContactMethods_Resumes_ResumeId",
                table: "ContactMethods");

            migrationBuilder.DropIndex(
                name: "IX_ContactMethods_ResumeId",
                table: "ContactMethods");

            migrationBuilder.RenameColumn(
                name: "ResumeId",
                table: "ContactMethods",
                newName: "idEmployesAccount");

            migrationBuilder.AlterColumn<int>(
                name: "EmployesAccountId",
                table: "ContactMethods",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ContactMethods_Profiles_EmployesAccountId",
                table: "ContactMethods",
                column: "EmployesAccountId",
                principalTable: "Profiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ContactMethods_Profiles_EmployesAccountId",
                table: "ContactMethods");

            migrationBuilder.RenameColumn(
                name: "idEmployesAccount",
                table: "ContactMethods",
                newName: "ResumeId");

            migrationBuilder.AlterColumn<int>(
                name: "EmployesAccountId",
                table: "ContactMethods",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.CreateIndex(
                name: "IX_ContactMethods_ResumeId",
                table: "ContactMethods",
                column: "ResumeId");

            migrationBuilder.AddForeignKey(
                name: "FK_ContactMethods_Profiles_EmployesAccountId",
                table: "ContactMethods",
                column: "EmployesAccountId",
                principalTable: "Profiles",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_ContactMethods_Resumes_ResumeId",
                table: "ContactMethods",
                column: "ResumeId",
                principalTable: "Resumes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
