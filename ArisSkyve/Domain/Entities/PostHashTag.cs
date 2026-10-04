using System.ComponentModel.DataAnnotations.Schema;

namespace ArisSkyve.Domain.Entities
{
    [Table("PostHashTags")]
    public class PostHashTag
    {
        public int PostId { get; set; }
        public string Tag { get; set; } = "";

        public virtual Post? Post { get; set; }
    }
}
