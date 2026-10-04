using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ArisSkyve.Domain.Entities
{
    public class PostPoll
    {
        [Key, ForeignKey(nameof(Post))]
        public int PostId { get; set; }
        public string Question { get; set; } = "";
        public DateTime EndsAt { get; set; }

        public virtual Post? Post { get; set; }
        public virtual ICollection<PollOption> Options { get; set; } = new List<PollOption>();
    }

    public class PollOption
    {
        [Key]
        public int Id { get; set; }
        public int PostId { get; set; }
        public string Label { get; set; } = "";
        public int SortOrder { get; set; }

        public virtual PostPoll? PostPoll { get; set; }
        public virtual ICollection<PollVote> Votes { get; set; } = new List<PollVote>();
    }

    public class PollVote
    {
        public int PollOptionId { get; set; }
        public int UserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public virtual PollOption? PollOption { get; set; }
        public virtual User? User { get; set; }
    }
}
