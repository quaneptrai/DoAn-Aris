using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArisSkyve.Migrations
{
    /// <summary>
    /// Snapshot only: maps the crawler-owned dbo.Companies as the read-only CrawledCompany entity
    /// (ExcludeFromMigrations), so this migration creates and changes nothing in the database.
    /// </summary>
    public partial class MapCrawledCompanies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
