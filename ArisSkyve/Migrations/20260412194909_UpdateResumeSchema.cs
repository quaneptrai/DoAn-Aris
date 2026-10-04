using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArisSkyve.Migrations
{
    /// <inheritdoc />
    public partial class UpdateResumeSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Name",
                table: "Skills",
                newName: "SkillName");

            migrationBuilder.RenameColumn(
                name: "Years",
                table: "Experiences",
                newName: "Role");

            migrationBuilder.RenameColumn(
                name: "Title",
                table: "Experiences",
                newName: "Duration");

            migrationBuilder.AddColumn<int>(
                name: "EmployeeId",
                table: "Resumes",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "SearchVectorContent",
                table: "Resumes",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<float>(
                name: "GPA",
                table: "Education",
                type: "real",
                nullable: false,
                defaultValue: 0f);

            migrationBuilder.CreateIndex(
                name: "IX_Resumes_EmployeeId",
                table: "Resumes",
                column: "EmployeeId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Resumes_Profiles_EmployeeId",
                table: "Resumes",
                column: "EmployeeId",
                principalTable: "Profiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.NoAction);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Resumes_Profiles_EmployeeId",
                table: "Resumes");

            migrationBuilder.DropIndex(
                name: "IX_Resumes_EmployeeId",
                table: "Resumes");

            migrationBuilder.DropColumn(
                name: "EmployeeId",
                table: "Resumes");

            migrationBuilder.DropColumn(
                name: "SearchVectorContent",
                table: "Resumes");

            migrationBuilder.DropColumn(
                name: "GPA",
                table: "Education");

            migrationBuilder.RenameColumn(
                name: "SkillName",
                table: "Skills",
                newName: "Name");

            migrationBuilder.RenameColumn(
                name: "Role",
                table: "Experiences",
                newName: "Years");

            migrationBuilder.RenameColumn(
                name: "Duration",
                table: "Experiences",
                newName: "Title");
        }
    }
}
