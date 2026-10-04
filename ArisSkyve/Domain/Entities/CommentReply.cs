using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ArisSkyve.Domain.Entities
{
    public class CommentReply
    {
        [Key, ForeignKey(nameof(Comment))]
        public int CommentId { get; set; }

        public int ParentCommentId { get; set; }

        public virtual Comment? Comment { get; set; }
        public virtual Comment? ParentComment { get; set; }
    }
}
