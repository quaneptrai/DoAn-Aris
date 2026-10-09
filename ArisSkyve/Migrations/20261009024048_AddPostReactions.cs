using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArisSkyve.Migrations
{
    /// <inheritdoc />
    public partial class AddPostReactions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CommentReactions",
                columns: table => new
                {
                    CommentId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CommentReactions", x => new { x.CommentId, x.UserId });
                    table.ForeignKey(
                        name: "FK_CommentReactions_CommentLikes_CommentId_UserId",
                        columns: x => new { x.CommentId, x.UserId },
                        principalTable: "CommentLikes",
                        principalColumns: new[] { "CommentId", "UserId" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PostReactions",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "int", nullable: false),
                    PostId = table.Column<int>(type: "int", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PostReactions", x => new { x.UserId, x.PostId });
                    table.ForeignKey(
                        name: "FK_PostReactions_Likes_UserId_PostId",
                        columns: x => new { x.UserId, x.PostId },
                        principalTable: "Likes",
                        principalColumns: new[] { "UserId", "PostId" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PostReactions_PostId_Kind",
                table: "PostReactions",
                columns: new[] { "PostId", "Kind" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CommentReactions");

            migrationBuilder.DropTable(
                name: "PostReactions");
        }
    }
}
