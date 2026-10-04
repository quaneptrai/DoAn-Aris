using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArisSkyve.Migrations
{
    /// <inheritdoc />
    public partial class AllowMultipleJobApplications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_JobApplications_JobPostingId_ApplicantId",
                table: "JobApplications");

            migrationBuilder.CreateIndex(
                name: "IX_JobApplications_JobPostingId_ApplicantId",
                table: "JobApplications",
                columns: new[] { "JobPostingId", "ApplicantId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_JobApplications_JobPostingId_ApplicantId",
                table: "JobApplications");

            migrationBuilder.CreateIndex(
                name: "IX_JobApplications_JobPostingId_ApplicantId",
                table: "JobApplications",
                columns: new[] { "JobPostingId", "ApplicantId" },
                unique: true,
                filter: "[Status] <> 'Withdrawn'");
        }
    }
}
