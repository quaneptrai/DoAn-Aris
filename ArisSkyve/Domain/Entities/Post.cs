using Azure;
using System.ComponentModel.DataAnnotations;

namespace ArisSkyve.Domain.Entities
{
    public class Post
    {
        [Key]
        public int Id { get; set; }
        public string? Title { get; set; }
        public string Content { get; set; } = string.Empty;
        public bool IsPublic { get; set; } = true;
        public List<Comment> Comments { get; set; }
        public List<Like> Likes { get; set; }
        public int LikeCount { get; set; }     
        public int CommentCount { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public int UserId { get; set; }
        public User User { get; set; }  
        public List<PostMedias> PostMedias { get; set; }
        public List<PostCategory> Categories { get; set; } = new();
        public List<Tags> Tags { get; set; } = new();
    }
}
