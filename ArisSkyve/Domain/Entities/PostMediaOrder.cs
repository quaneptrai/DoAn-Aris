using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ArisSkyve.Domain.Entities
{
    public class PostMediaOrder
    {
        [Key, ForeignKey(nameof(PostMedia))]
        public int PostMediaId { get; set; }

        public int SortOrder { get; set; }

        public virtual PostMedias? PostMedia { get; set; }
    }
}
