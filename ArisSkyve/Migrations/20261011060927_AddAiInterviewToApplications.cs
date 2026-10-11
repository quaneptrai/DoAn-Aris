using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArisSkyve.Migrations
{
    /// <inheritdoc />
    public partial class AddAiInterviewToApplications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "InterviewKitId",
                table: "JobApplications",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "JobApplicationId",
                table: "InterviewKitSessions",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_InterviewKitSessions_JobApplicationId",
                table: "InterviewKitSessions",
                column: "JobApplicationId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_InterviewKitSessions_JobApplicationId",
                table: "InterviewKitSessions");

            migrationBuilder.DropColumn(
                name: "InterviewKitId",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "JobApplicationId",
                table: "InterviewKitSessions");
        }
    }
}
