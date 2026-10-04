using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArisSkyve.Migrations
{
    /// <inheritdoc />
    public partial class MarkJobPostingIsActiveComputed : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<bool>(
                name: "isActive",
                table: "JobPostings",
                type: "bit",
                nullable: false,
                computedColumnSql: "(case when [Deadline] IS NULL OR [Deadline]>=CONVERT([date],getdate()) then CONVERT([bit],(1)) else CONVERT([bit],(0)) end)",
                oldClrType: typeof(bool),
                oldType: "bit");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<bool>(
                name: "isActive",
                table: "JobPostings",
                type: "bit",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "bit",
                oldComputedColumnSql: "(case when [Deadline] IS NULL OR [Deadline]>=CONVERT([date],getdate()) then CONVERT([bit],(1)) else CONVERT([bit],(0)) end)");
        }
    }
}
