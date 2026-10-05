using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArisSkyve.Migrations
{
    /// <inheritdoc />
    public partial class AddPrivateDriveResumeOriginals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ResumeOriginals",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OwnerUserId = table.Column<int>(type: "int", nullable: false),
                    SourceId = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    DriveFileId = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UnreferencedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ResumeOriginals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ResumeOriginals_Users_OwnerUserId",
                        column: x => x.OwnerUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ResumeOriginals_DriveFileId",
                table: "ResumeOriginals",
                column: "DriveFileId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ResumeOriginals_OwnerUserId",
                table: "ResumeOriginals",
                column: "OwnerUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ResumeOriginals_SourceId",
                table: "ResumeOriginals",
                column: "SourceId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ResumeOriginals_UnreferencedAtUtc_Id",
                table: "ResumeOriginals",
                columns: new[] { "UnreferencedAtUtc", "Id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ResumeOriginals");
        }
    }
}
