using System;

namespace ArisSkyve.Domain.Entities
{
    /// <summary>
    /// The emotion behind a post like ("Thích" = heart is the default). A row exists only for a
    /// non-default kind and hangs off its <see cref="Like"/> row with a cascading FK, so removing
    /// the like — even from a build that only knows the Likes table — removes the reaction too.
    /// Counts stay on Likes / Post.LikeCount: a reaction is a like with a different face.
    /// </summary>
    public class PostReaction
    {
        public int UserId { get; set; }
        public int PostId { get; set; }
        public string Kind { get; set; } = ReactionKinds.Default;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public virtual Like? Like { get; set; }
    }

    /// <summary>Same as <see cref="PostReaction"/>, for a comment or reply like.</summary>
    public class CommentReaction
    {
        public int CommentId { get; set; }
        public int UserId { get; set; }
        public string Kind { get; set; } = ReactionKinds.Default;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public virtual CommentLike? Like { get; set; }
    }

    /// <summary>Reaction kinds understood by the server; the UI maps them to emoji and labels.</summary>
    public static class ReactionKinds
    {
        public const string Default = "like";

        // like ❤️ Thích · celebrate 🎉 Chúc mừng · support 💪 Cố lên · insightful 💡 Hữu ích
        // haha 😆 Haha · wow 😮 Wow · sad 😢 Buồn
        public static readonly string[] All = { Default, "celebrate", "support", "insightful", "haha", "wow", "sad" };

        public static bool IsKnown(string? kind) => kind != null && Array.IndexOf(All, kind) >= 0;
    }
}
