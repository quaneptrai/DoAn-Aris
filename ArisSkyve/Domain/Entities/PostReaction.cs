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

    /// <summary>
    /// Reaction kinds understood by the server — the quick faces of chat reactions, in their order:
    /// 👍 ❤️ 😆 😮 😢 😡, stored as short ASCII keys (post-reactions.js maps them to emoji and labels).
    /// </summary>
    public static class ReactionKinds
    {
        /// <summary>❤️ — what the heart button gives, and every like that has no reaction row.</summary>
        public const string Default = "like";

        public static readonly string[] All = { "thumb", Default, "haha", "wow", "sad", "angry" };

        public static bool IsKnown(string? kind) => kind != null && Array.IndexOf(All, kind) >= 0;
    }
}
