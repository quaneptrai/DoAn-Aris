using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArisSkyve.Migrations
{
    /// <inheritdoc />
    public partial class SimplifyApplyAndAddCvLabelAndRejectionTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Resumes_EmployeeId",
                table: "Resumes");

            migrationBuilder.DropColumn(
                name: "AvailableFrom",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "ExpectedSalary",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "Phone",
                table: "JobApplications");

            migrationBuilder.AddColumn<string>(
                name: "Label",
                table: "Resumes",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "CV của tôi");

            migrationBuilder.AddColumn<string>(
                name: "RejectionTemplates",
                table: "Profiles",
                type: "nvarchar(max)",
                nullable: true,
                defaultValue: "[]");

            migrationBuilder.CreateIndex(
                name: "IX_Resumes_EmployeeId",
                table: "Resumes",
                column: "EmployeeId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Resumes_EmployeeId",
                table: "Resumes");

            migrationBuilder.DropColumn(
                name: "Label",
                table: "Resumes");

            migrationBuilder.DropColumn(
                name: "RejectionTemplates",
                table: "Profiles");

            migrationBuilder.AddColumn<DateTime>(
                name: "AvailableFrom",
                table: "JobApplications",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExpectedSalary",
                table: "JobApplications",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Phone",
                table: "JobApplications",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Resumes_EmployeeId",
                table: "Resumes",
                column: "EmployeeId",
                unique: true);
        }
    }
}
