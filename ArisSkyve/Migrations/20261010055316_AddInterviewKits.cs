using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArisSkyve.Migrations
{
    /// <inheritdoc />
    public partial class AddInterviewKits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "InterviewKits",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BusinessAccountId = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Persona = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Scene = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    AvatarImage = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    AvatarContentType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    PassPercent = table.Column<int>(type: "int", nullable: false),
                    ScriptJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ScriptApprovedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    InviteCode = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InterviewKits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InterviewKits_Profiles_BusinessAccountId",
                        column: x => x.BusinessAccountId,
                        principalTable: "Profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "InterviewKitQuestions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    KitId = table.Column<int>(type: "int", nullable: false),
                    Position = table.Column<int>(type: "int", nullable: false),
                    Question = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    AnswerKey = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    KeyPoints = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    PrepSeconds = table.Column<int>(type: "int", nullable: false),
                    AnswerSeconds = table.Column<int>(type: "int", nullable: false),
                    Retakes = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InterviewKitQuestions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InterviewKitQuestions_InterviewKits_KitId",
                        column: x => x.KitId,
                        principalTable: "InterviewKits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "InterviewKitSessions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    KitId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    IsEmployerTest = table.Column<bool>(type: "bit", nullable: false),
                    StartedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CompletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Score = table.Column<double>(type: "float", nullable: true),
                    AnswersJson = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InterviewKitSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InterviewKitSessions_InterviewKits_KitId",
                        column: x => x.KitId,
                        principalTable: "InterviewKits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_InterviewKitSessions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "InterviewKitVideos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    KitId = table.Column<int>(type: "int", nullable: false),
                    QuestionId = table.Column<int>(type: "int", nullable: true),
                    Kind = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Url = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: false),
                    StorageFileId = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    Source = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InterviewKitVideos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InterviewKitVideos_InterviewKitQuestions_QuestionId",
                        column: x => x.QuestionId,
                        principalTable: "InterviewKitQuestions",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_InterviewKitVideos_InterviewKits_KitId",
                        column: x => x.KitId,
                        principalTable: "InterviewKits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_InterviewKitQuestions_KitId_Position",
                table: "InterviewKitQuestions",
                columns: new[] { "KitId", "Position" });

            migrationBuilder.CreateIndex(
                name: "IX_InterviewKits_BusinessAccountId_UpdatedAtUtc",
                table: "InterviewKits",
                columns: new[] { "BusinessAccountId", "UpdatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_InterviewKits_InviteCode",
                table: "InterviewKits",
                column: "InviteCode",
                unique: true,
                filter: "[InviteCode] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_InterviewKitSessions_KitId_StartedAtUtc",
                table: "InterviewKitSessions",
                columns: new[] { "KitId", "StartedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_InterviewKitSessions_UserId",
                table: "InterviewKitSessions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_InterviewKitVideos_KitId_QuestionId_Kind",
                table: "InterviewKitVideos",
                columns: new[] { "KitId", "QuestionId", "Kind" });

            migrationBuilder.CreateIndex(
                name: "IX_InterviewKitVideos_QuestionId",
                table: "InterviewKitVideos",
                column: "QuestionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "InterviewKitSessions");

            migrationBuilder.DropTable(
                name: "InterviewKitVideos");

            migrationBuilder.DropTable(
                name: "InterviewKitQuestions");

            migrationBuilder.DropTable(
                name: "InterviewKits");
        }
    }
}
