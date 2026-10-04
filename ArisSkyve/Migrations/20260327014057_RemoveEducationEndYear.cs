using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArisSkyve.Migrations
{
    /// <inheritdoc />
    public partial class RemoveEducationEndYear : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Education_EmployesAccountId",
                table: "Education");

            migrationBuilder.DropColumn(
                name: "EndYear",
                table: "Education");

            migrationBuilder.AddColumn<bool>(
                name: "ShareWithRecruiters",
                table: "Profiles",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_Education_EmployesAccountId",
                table: "Education",
                column: "EmployesAccountId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Education_EmployesAccountId",
                table: "Education");

            migrationBuilder.DropColumn(
                name: "ShareWithRecruiters",
                table: "Profiles");

            migrationBuilder.AddColumn<int>(
                name: "EndYear",
                table: "Education",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Education_EmployesAccountId",
                table: "Education",
                column: "EmployesAccountId");
        }
    }
}
