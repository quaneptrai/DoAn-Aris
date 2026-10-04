using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArisSkyve.Migrations
{
    /// <inheritdoc />
    public partial class AddPrivacyAndCvAiConsent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CvAiConsentAt",
                table: "Users",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PrivacyAcceptedAt",
                table: "Users",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CvAiConsentAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PrivacyAcceptedAt",
                table: "Users");
        }
    }
}
