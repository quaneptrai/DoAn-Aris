using System.Collections.Generic;

namespace ArisSkyve.Application.DTOs
{
    // Mirrors the JSON document shape the client-side CV builder (wwwroot/cv-builder)
    // keeps in localStorage under the "cv-builder-data" key, so it can be serialized
    // (camelCase) and dropped straight into the client without any reshaping there.
    public class ResumeBuilderDocumentDto
    {
        public string Template { get; set; } = "modern";
        public ResumeBuilderPersonalDto Personal { get; set; } = new();
        public List<ResumeBuilderSectionDto> Sections { get; set; } = new();
    }

    public class ResumeBuilderPersonalDto
    {
        public string Name { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public string Website { get; set; } = string.Empty;
        public string Photo { get; set; } = string.Empty;
    }

    public class ResumeBuilderSectionDto
    {
        public string Id { get; set; } = string.Empty;
        public string CatalogId { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty; // "text" | "tags" | "entries"
        public string Placement { get; set; } = "auto";
        public string? Content { get; set; }
        public List<string>? Items { get; set; }
        public List<Dictionary<string, string>>? Entries { get; set; }
    }
}
