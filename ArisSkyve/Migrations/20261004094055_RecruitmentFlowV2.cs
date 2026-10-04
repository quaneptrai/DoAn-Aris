using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArisSkyve.Migrations
{
    /// <inheritdoc />
    public partial class RecruitmentFlowV2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Openings",
                table: "JobPostings",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FollowUpNudgedAt",
                table: "JobApplications",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "HiredAt",
                table: "JobApplications",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InterviewDeclineReason",
                table: "JobApplications",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "InterviewDurationMinutes",
                table: "JobApplications",
                type: "int",
                nullable: false,
                defaultValue: 45);

            migrationBuilder.AddColumn<DateTime>(
                name: "InterviewRespondedAt",
                table: "JobApplications",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "InterviewRound",
                table: "JobApplications",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "MatchAttempts",
                table: "JobApplications",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "MatchDetailJson",
                table: "JobApplications",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MatchError",
                table: "JobApplications",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "MatchScore",
                table: "JobApplications",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "MatchScoredAt",
                table: "JobApplications",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MatchSummary",
                table: "JobApplications",
                type: "nvarchar(400)",
                maxLength: 400,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OfferDeclineReason",
                table: "JobApplications",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "OfferExpiresAt",
                table: "JobApplications",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "OfferRespondedAt",
                table: "JobApplications",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OfferResponse",
                table: "JobApplications",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OfferSalary",
                table: "JobApplications",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "OfferStartDate",
                table: "JobApplications",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProposedSlotsJson",
                table: "JobApplications",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectionCategory",
                table: "JobApplications",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "Reminder1hSentAt",
                table: "JobApplications",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "Reminder24hSentAt",
                table: "JobApplications",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ApplicationEvents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    JobApplicationId = table.Column<int>(type: "int", nullable: false),
                    Type = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    ActorRole = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ActorUserId = table.Column<int>(type: "int", nullable: true),
                    Title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Detail = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsInternal = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApplicationEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ApplicationEvents_JobApplications_JobApplicationId",
                        column: x => x.JobApplicationId,
                        principalTable: "JobApplications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "InterviewEvaluations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    JobApplicationId = table.Column<int>(type: "int", nullable: false),
                    Round = table.Column<int>(type: "int", nullable: false),
                    EvaluatorUserId = table.Column<int>(type: "int", nullable: false),
                    TechnicalRating = table.Column<int>(type: "int", nullable: false),
                    CommunicationRating = table.Column<int>(type: "int", nullable: false),
                    ProblemSolvingRating = table.Column<int>(type: "int", nullable: false),
                    CultureFitRating = table.Column<int>(type: "int", nullable: false),
                    Recommendation = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Strengths = table.Column<string>(type: "nvarchar(1500)", maxLength: 1500, nullable: true),
                    Concerns = table.Column<string>(type: "nvarchar(1500)", maxLength: 1500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InterviewEvaluations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InterviewEvaluations_JobApplications_JobApplicationId",
                        column: x => x.JobApplicationId,
                        principalTable: "JobApplications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_JobApplications_InterviewAt",
                table: "JobApplications",
                column: "InterviewAt");

            migrationBuilder.CreateIndex(
                name: "IX_JobApplications_MatchScoredAt",
                table: "JobApplications",
                column: "MatchScoredAt");

            migrationBuilder.CreateIndex(
                name: "IX_ApplicationEvents_JobApplicationId_CreatedAt",
                table: "ApplicationEvents",
                columns: new[] { "JobApplicationId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_InterviewEvaluations_JobApplicationId_Round",
                table: "InterviewEvaluations",
                columns: new[] { "JobApplicationId", "Round" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ApplicationEvents");

            migrationBuilder.DropTable(
                name: "InterviewEvaluations");

            migrationBuilder.DropIndex(
                name: "IX_JobApplications_InterviewAt",
                table: "JobApplications");

            migrationBuilder.DropIndex(
                name: "IX_JobApplications_MatchScoredAt",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "Openings",
                table: "JobPostings");

            migrationBuilder.DropColumn(
                name: "FollowUpNudgedAt",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "HiredAt",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "InterviewDeclineReason",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "InterviewDurationMinutes",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "InterviewRespondedAt",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "InterviewRound",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "MatchAttempts",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "MatchDetailJson",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "MatchError",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "MatchScore",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "MatchScoredAt",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "MatchSummary",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "OfferDeclineReason",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "OfferExpiresAt",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "OfferRespondedAt",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "OfferResponse",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "OfferSalary",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "OfferStartDate",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "ProposedSlotsJson",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "RejectionCategory",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "Reminder1hSentAt",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "Reminder24hSentAt",
                table: "JobApplications");
        }
    }
}
