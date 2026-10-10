using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArisSkyve.Migrations
{
    /// <inheritdoc />
    public partial class ExtendInterviewFlow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SettingsJson",
                table: "InterviewKits",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Code",
                table: "InterviewKitQuestions",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PointWeights",
                table: "InterviewKitQuestions",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Weight",
                table: "InterviewKitQuestions",
                type: "float",
                nullable: false,
                defaultValue: 1.0);

            migrationBuilder.CreateTable(
                name: "InterviewKitRecordings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SessionId = table.Column<int>(type: "int", nullable: false),
                    QuestionId = table.Column<int>(type: "int", nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Bytes = table.Column<byte[]>(type: "varbinary(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InterviewKitRecordings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InterviewKitRecordings_InterviewKitSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "InterviewKitSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_InterviewKitRecordings_SessionId_QuestionId",
                table: "InterviewKitRecordings",
                columns: new[] { "SessionId", "QuestionId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "InterviewKitRecordings");

            migrationBuilder.DropColumn(
                name: "SettingsJson",
                table: "InterviewKits");

            migrationBuilder.DropColumn(
                name: "Code",
                table: "InterviewKitQuestions");

            migrationBuilder.DropColumn(
                name: "PointWeights",
                table: "InterviewKitQuestions");

            migrationBuilder.DropColumn(
                name: "Weight",
                table: "InterviewKitQuestions");
        }
    }
}
