using ArisSkyve.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ArisSkyve.Infrastructure.Data.Context
{
    public class ArisDBContext : DbContext
    {
        public ArisDBContext(DbContextOptions<ArisDBContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<EmployesAccount> Profiles { get; set; }
        public DbSet<BussinessAccount> BussinessAccounts { get; set; }

        public DbSet<Post> Posts { get; set; }
        public DbSet<PostMedias> PostMedias { get; set; }
        public DbSet<JobPosting> JobPostings { get; set; }
        public DbSet<Resume> Resumes { get; set; }
        public DbSet<ResumeOriginal> ResumeOriginals { get; set; }
        public DbSet<Skills> Skills { get; set; }
        public DbSet<Experiences> Experiences { get; set; }
        public DbSet<ContactMethod> ContactMethods { get; set; }
        public DbSet<JobLocation> JobLocations { get; set; }
        public DbSet<Like> Likes { get; set; }
        public DbSet<Comment> Comments { get; set; }
        public virtual DbSet<UserRecommendations> UserRecommendations { get; set; }
        public DbSet<Message> Messages { get; set; }
        public DbSet<MessageReaction> MessageReactions { get; set; }
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<JobApplication> JobApplications { get; set; }
        public DbSet<ApplicationEvent> ApplicationEvents { get; set; }
        public DbSet<InterviewEvaluation> InterviewEvaluations { get; set; }
        public DbSet<Friendship> Friendships { get; set; }
        public DbSet<SocialChannelConnection> SocialChannelConnections { get; set; }
        public DbSet<ZaloGroupLinkCode> ZaloGroupLinkCodes { get; set; }

        // V7 Phase B DbSets
        public DbSet<PostExtra> PostExtras { get; set; }
        public DbSet<PostMediaOrder> PostMediaOrders { get; set; }
        public DbSet<CommentReply> CommentReplies { get; set; }
        public DbSet<UserSessionVersion> UserSessionVersions { get; set; }
        public DbSet<CommentLike> CommentLikes { get; set; }
        public DbSet<SavedPost> SavedPosts { get; set; }
        public DbSet<SavedJob> SavedJobs { get; set; }
        public DbSet<DismissedSuggestion> DismissedSuggestions { get; set; }
        public DbSet<Story> Stories { get; set; }
        public DbSet<StoryView> StoryViews { get; set; }
        public DbSet<PostPoll> PostPolls { get; set; }
        public DbSet<PollOption> PollOptions { get; set; }
        public DbSet<PollVote> PollVotes { get; set; }
        public DbSet<CompanyFollow> CompanyFollows { get; set; }
        public DbSet<CompanyProfileView> CompanyProfileViews { get; set; }
        public DbSet<HiddenPost> HiddenPosts { get; set; }
        public DbSet<PostReport> PostReports { get; set; }
        public DbSet<Mention> Mentions { get; set; }
        public DbSet<PostHashTag> PostHashTags { get; set; }

        // Reactions on post/comment likes (migration AddPostReactions, gated by IV7FeatureGate.PostReactions)
        public DbSet<PostReaction> PostReactions { get; set; }
        public DbSet<CommentReaction> CommentReactions { get; set; }

        // Company profiles written by the AiCore crawler (its own dbo.Companies) — read-only here
        public DbSet<CrawledCompany> CrawledCompanies { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Usernames must be unique so people can actually be told apart (Id already
            // differentiates accounts internally, but Username is the human-facing
            // identifier used across search, chat, etc.). App-level uniqueness is
            // enforced when a username is generated at signup (AccountController); this
            // index is the DB-level backstop against races/direct inserts.
            modelBuilder.Entity<User>()
                .HasIndex(u => u.Username)
                .IsUnique();

            // JobPosting <-> BussinessAccount
            modelBuilder.Entity<JobPosting>()
                .HasOne(j => j.BusinessAccount)
                .WithMany()
                .HasForeignKey(j => j.BusinessAccountId)
                .OnDelete(DeleteBehavior.SetNull);

            // isActive is a non-persisted computed column on the database (derived from
            // Deadline: active when Deadline is null or in the future) rather than a plain
            // writable column — EF must not try to INSERT/UPDATE it, only read it back.
            modelBuilder.Entity<JobPosting>()
                .Property(j => j.isActive)
                .HasComputedColumnSql("(case when [Deadline] IS NULL OR [Deadline]>=CONVERT([date],getdate()) then CONVERT([bit],(1)) else CONVERT([bit],(0)) end)")
                .ValueGeneratedOnAddOrUpdate();

            // JSON string fields
            modelBuilder.Entity<JobPosting>()
                .Property(j => j.Responsibilities)
                .HasColumnType("nvarchar(max)");
            modelBuilder.Entity<JobPosting>()
                .Property(j => j.Requirements)
                .HasColumnType("nvarchar(max)");
            modelBuilder.Entity<JobPosting>()
                .Property(j => j.Benefits)
                .HasColumnType("nvarchar(max)");
            modelBuilder.Entity<JobPosting>()
                .Property(j => j.FullText)
                .HasColumnType("nvarchar(max)");
            modelBuilder.Entity<JobPosting>()
                .Property(j => j.LocationTags)
                .HasColumnType("nvarchar(max)"); 
            modelBuilder.Entity<JobLocation>()
                .HasOne(jl => jl.JobPosting)
                .WithMany(j => j.Locations)
                .HasForeignKey(jl => jl.JobPostingId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<JobLocation>()
                .HasIndex(jl => jl.City);


            modelBuilder.Entity<ContactMethod>()
                .HasOne(c => c.EmployesAccount)
                .WithMany(p => p.ContactMethods)
                .HasForeignKey(c => c.idEmployesAccount)
                .OnDelete(DeleteBehavior.Cascade);
            // Không còn ràng buộc unique theo EmployeeId nữa — một ứng viên giờ có thể có
            // nhiều CV (VD: CV Backend, CV Frontend) để chọn khi ứng tuyển từng job.
            modelBuilder.Entity<Resume>()
                .HasIndex(r => r.EmployeeId);
            modelBuilder.Entity<Resume>()
                .Property(r => r.BuilderDataJson)
                .HasColumnType("nvarchar(max)");
            modelBuilder.Entity<Resume>()
                .Property(r => r.Label)
                .IsRequired()
                .HasDefaultValue("CV của tôi");
            // Imported-layout PDFs live in a separate private Drive folder. This
            // table contains only the opaque server-side Drive locator; the
            // canonical Studio JSON keeps its existing source ID, never a Drive URL.
            modelBuilder.Entity<ResumeOriginal>(original =>
            {
                original.Property(value => value.SourceId)
                    .HasMaxLength(32)
                    .IsRequired();
                original.Property(value => value.DriveFileId)
                    .HasMaxLength(256)
                    .IsRequired();
                original.Property(value => value.RowVersion)
                    .IsRowVersion();
                original.HasIndex(value => value.SourceId)
                    .IsUnique();
                original.HasIndex(value => value.DriveFileId)
                    .IsUnique();
                original.HasIndex(value => new { value.UnreferencedAtUtc, value.Id });
                original.HasOne(value => value.Owner)
                    .WithMany()
                    .HasForeignKey(value => value.OwnerUserId)
                    .OnDelete(DeleteBehavior.Restrict);
            });
            // .IsRequired() has no effect here despite the C# non-null default: TPH keeps
            // subclass-only columns nullable at the DB level since base EmployesAccount
            // rows never populate them — GetRejectionTemplates() null-checks accordingly.
            modelBuilder.Entity<BussinessAccount>()
                .Property(b => b.RejectionTemplates)
                .HasColumnType("nvarchar(max)")
                .HasDefaultValue("[]");
            // Discriminator cho Profiles
            modelBuilder.Entity<EmployesAccount>()
                .HasDiscriminator<string>("Discriminator")
                .HasValue<EmployesAccount>("EmployesAccount")
                .HasValue<BussinessAccount>("BussinessAccount");

            modelBuilder.Entity<Like>()
                .HasKey(l => new { l.UserId, l.PostId });

            // ✅ Like → Post (N:1)
            // NoAction here makes SQL Server reject deleting any Post that still has
            // Likes (FK constraint violation) — DeletePost had no try/catch, so that
            // surfaced as an unhandled 500. Can't switch this to Cascade: Likes also
            // cascades from Users (see below), and SQL Server refuses a second cascade
            // path into the same table ("may cause cycles or multiple cascade paths").
            // Fixed instead by explicitly deleting a post's Likes/Comments/PostMedias
            // in DeletePost before removing the Post itself — see DashboardController.
            modelBuilder.Entity<Like>()
                .HasOne(l => l.Post)
                .WithMany(p => p.Likes)
                .HasForeignKey(l => l.PostId)
                .OnDelete(DeleteBehavior.NoAction);

            // ✅ Like → User (N:1)
            modelBuilder.Entity<Like>()
                .HasOne(l => l.User)
                .WithMany(u => u.Likes)
                .HasForeignKey(l => l.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // User <-> Profile
            modelBuilder.Entity<User>()
                    .HasOne(u => u.Profile)
                    .WithOne(p => p.User)
                    .HasForeignKey<EmployesAccount>(p => p.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
                //Like constraint
                modelBuilder.Entity<Like>()
                    .HasKey(l => new { l.UserId, l.PostId });

            // Message <-> Sender/Receiver (Restrict to avoid multiple cascade paths from User)
            modelBuilder.Entity<Message>()
                .HasOne(m => m.Sender)
                .WithMany()
                .HasForeignKey(m => m.SenderId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Message>()
                .HasOne(m => m.Receiver)
                .WithMany()
                .HasForeignKey(m => m.ReceiverId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Message>()
                .HasIndex(m => new { m.SenderId, m.ReceiverId });
            modelBuilder.Entity<Message>()
                .HasIndex(m => m.SentAt);

            // Message <-> ReplyToMessage (self-reference; Restrict for the same reason
            // as Sender/Receiver above -- SQL Server rejects cascade paths here too)
            modelBuilder.Entity<Message>()
                .HasOne(m => m.ReplyToMessage)
                .WithMany()
                .HasForeignKey(m => m.ReplyToMessageId)
                .OnDelete(DeleteBehavior.Restrict);

            // Chat reactions: one per user per message. Recalling a message removes its
            // reactions; the user side is Restrict like every other User FK here.
            modelBuilder.Entity<MessageReaction>()
                .HasKey(r => new { r.MessageId, r.UserId });
            modelBuilder.Entity<MessageReaction>()
                .Property(r => r.Emoji)
                .HasMaxLength(32);
            modelBuilder.Entity<MessageReaction>()
                .HasOne(r => r.Message)
                .WithMany()
                .HasForeignKey(r => r.MessageId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<MessageReaction>()
                .HasOne(r => r.User)
                .WithMany()
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // Notification <-> Recipient/Actor (Restrict to avoid multiple cascade paths from User)
            modelBuilder.Entity<Notification>()
                .HasOne(n => n.User)
                .WithMany()
                .HasForeignKey(n => n.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Notification>()
                .HasOne(n => n.Actor)
                .WithMany()
                .HasForeignKey(n => n.ActorId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Notification>()
                .HasIndex(n => new { n.UserId, n.IsRead });

            // JobApplication <-> JobPosting: Cascade — deleting a posting takes its
            // applications with it (there's no standalone value in an orphaned application).
            modelBuilder.Entity<JobApplication>()
                .HasOne(a => a.JobPosting)
                .WithMany(j => j.Applications)
                .HasForeignKey(a => a.JobPostingId)
                .OnDelete(DeleteBehavior.Cascade);

            // JobApplication <-> Applicant (EmployesAccount): Restrict, same reasoning as
            // Message/Notification above — avoids SQL Server's multiple-cascade-path error
            // since EmployesAccount already cascades from User.
            modelBuilder.Entity<JobApplication>()
                .HasOne(a => a.Applicant)
                .WithMany(p => p.Applications)
                .HasForeignKey(a => a.ApplicantId)
                .OnDelete(DeleteBehavior.Restrict);

            // JobApplication <-> Resume: SetNull — losing the live Resume record must not
            // delete the application, since ResumeSnapshotUrl/Name already preserve what was
            // actually submitted.
            modelBuilder.Entity<JobApplication>()
                .HasOne(a => a.Resume)
                .WithMany()
                .HasForeignKey(a => a.ResumeId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<JobApplication>()
                .Property(a => a.CoverLetter)
                .HasColumnType("nvarchar(max)");
            modelBuilder.Entity<JobApplication>()
                .Property(a => a.ScreeningAnswers)
                .HasColumnType("nvarchar(max)");
            modelBuilder.Entity<JobPosting>()
                .Property(j => j.ScreeningQuestions)
                .HasColumnType("nvarchar(max)");

            // Candidates are now allowed to submit more than one application to the same
            // job (JobApplicationsController.Apply no longer blocks it) — the frontend
            // warns them re-applying can look unprofessional, and the employer sees every
            // submission (with a "applied N times" flag), rather than the DB silently
            // rejecting the duplicate. Keep a (non-unique) index for lookup performance.
            modelBuilder.Entity<JobApplication>()
                .HasIndex(a => new { a.JobPostingId, a.ApplicantId });

            modelBuilder.Entity<JobApplication>()
                .HasIndex(a => a.Status);

            modelBuilder.Entity<JobApplication>()
                .Property(a => a.MatchDetailJson)
                .HasColumnType("nvarchar(max)");
            modelBuilder.Entity<JobApplication>()
                .Property(a => a.ProposedSlotsJson)
                .HasColumnType("nvarchar(max)");
            // Worker nhắc lịch quét theo InterviewAt; worker chấm điểm quét đơn chưa có điểm.
            modelBuilder.Entity<JobApplication>()
                .HasIndex(a => a.InterviewAt);
            modelBuilder.Entity<JobApplication>()
                .HasIndex(a => a.MatchScoredAt);

            modelBuilder.Entity<ApplicationEvent>()
                .HasOne(e => e.JobApplication)
                .WithMany(a => a.Events)
                .HasForeignKey(e => e.JobApplicationId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<ApplicationEvent>()
                .Property(e => e.Detail)
                .HasColumnType("nvarchar(max)");
            modelBuilder.Entity<ApplicationEvent>()
                .HasIndex(e => new { e.JobApplicationId, e.CreatedAt });

            modelBuilder.Entity<InterviewEvaluation>()
                .HasOne(e => e.JobApplication)
                .WithMany(a => a.Evaluations)
                .HasForeignKey(e => e.JobApplicationId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<InterviewEvaluation>()
                .HasIndex(e => new { e.JobApplicationId, e.Round });

            // Friendship <-> Requester/Addressee: Restrict, same reasoning as Message/
            // Notification above (User already cascades from elsewhere in the graph).
            modelBuilder.Entity<Friendship>()
                .HasOne(f => f.Requester)
                .WithMany()
                .HasForeignKey(f => f.RequesterId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Friendship>()
                .HasOne(f => f.Addressee)
                .WithMany()
                .HasForeignKey(f => f.AddresseeId)
                .OnDelete(DeleteBehavior.Restrict);

            // Prevents a duplicate row in the same direction; the reverse-direction
            // duplicate (B->A while A->B already exists) is collapsed into an accept by
            // FriendsController.SendRequest instead of being enforced at the DB level.
            modelBuilder.Entity<Friendship>()
                .HasIndex(f => new { f.RequesterId, f.AddresseeId })
                .IsUnique();

            // SocialChannelConnection <-> BussinessAccount: Cascade — a connected channel
            // has no meaning once the business account that owns it is gone.
            modelBuilder.Entity<SocialChannelConnection>()
                .HasOne(s => s.BusinessAccount)
                .WithMany()
                .HasForeignKey(s => s.BusinessAccountId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<SocialChannelConnection>()
                .HasIndex(s => new { s.BusinessAccountId, s.Platform });

            modelBuilder.Entity<ZaloGroupLinkCode>()
                .HasOne(z => z.BusinessAccount)
                .WithMany()
                .HasForeignKey(z => z.BusinessAccountId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ZaloGroupLinkCode>()
                .HasIndex(z => z.Code)
                .IsUnique();

            // V7 Phase B Entities Configuration
            modelBuilder.Entity<PostExtra>()
                .HasOne(e => e.Post)
                .WithOne()
                .HasForeignKey<PostExtra>(e => e.PostId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<PostExtra>()
                .HasOne(e => e.JobPosting)
                .WithMany()
                .HasForeignKey(e => e.JobPostingId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<PostExtra>()
                .HasOne(e => e.RepostOf)
                .WithMany()
                .HasForeignKey(e => e.RepostOfId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<PostMediaOrder>()
                .HasOne(o => o.PostMedia)
                .WithOne()
                .HasForeignKey<PostMediaOrder>(o => o.PostMediaId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<CommentReply>()
                .HasOne(r => r.Comment)
                .WithOne()
                .HasForeignKey<CommentReply>(r => r.CommentId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<CommentReply>()
                .HasOne(r => r.ParentComment)
                .WithMany()
                .HasForeignKey(r => r.ParentCommentId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<UserSessionVersion>()
                .HasOne(v => v.User)
                .WithOne()
                .HasForeignKey<UserSessionVersion>(v => v.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<CommentLike>()
                .HasKey(cl => new { cl.CommentId, cl.UserId });
            modelBuilder.Entity<CommentLike>()
                .HasOne(cl => cl.Comment)
                .WithMany()
                .HasForeignKey(cl => cl.CommentId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<CommentLike>()
                .HasOne(cl => cl.User)
                .WithMany()
                .HasForeignKey(cl => cl.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // A reaction is an optional face on an existing like: its only FK is the like's key,
            // cascading, so it disappears with the like (single cascade path, no cycles).
            modelBuilder.Entity<PostReaction>(e =>
            {
                e.HasKey(r => new { r.UserId, r.PostId });
                e.Property(r => r.Kind).HasMaxLength(16).IsRequired();
                e.HasOne(r => r.Like)
                    .WithOne()
                    .HasForeignKey<PostReaction>(r => new { r.UserId, r.PostId })
                    .OnDelete(DeleteBehavior.Cascade);
                e.HasIndex(r => new { r.PostId, r.Kind });
            });
            modelBuilder.Entity<CommentReaction>(e =>
            {
                e.HasKey(r => new { r.CommentId, r.UserId });
                e.Property(r => r.Kind).HasMaxLength(16).IsRequired();
                e.HasOne(r => r.Like)
                    .WithOne()
                    .HasForeignKey<CommentReaction>(r => new { r.CommentId, r.UserId })
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // The crawler owns dbo.Companies (vn_job_crawler/migrations/001_create_companies.sql):
            // Aris only reads it, so EF must never create or alter the table.
            modelBuilder.Entity<CrawledCompany>(e =>
            {
                e.ToTable("Companies", t => t.ExcludeFromMigrations());
                e.HasKey(c => c.Id);
            });

            modelBuilder.Entity<SavedPost>()
                .HasKey(sp => new { sp.UserId, sp.PostId });
            modelBuilder.Entity<SavedPost>()
                .HasOne(sp => sp.User)
                .WithMany()
                .HasForeignKey(sp => sp.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<SavedPost>()
                .HasOne(sp => sp.Post)
                .WithMany()
                .HasForeignKey(sp => sp.PostId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<SavedJob>()
                .HasKey(sj => new { sj.UserId, sj.JobPostingId });
            modelBuilder.Entity<SavedJob>()
                .HasOne(sj => sj.User)
                .WithMany()
                .HasForeignKey(sj => sj.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<SavedJob>()
                .HasOne(sj => sj.JobPosting)
                .WithMany()
                .HasForeignKey(sj => sj.JobPostingId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<DismissedSuggestion>()
                .HasKey(ds => new { ds.UserId, ds.SuggestedUserId });
            modelBuilder.Entity<DismissedSuggestion>()
                .HasOne(ds => ds.User)
                .WithMany()
                .HasForeignKey(ds => ds.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<DismissedSuggestion>()
                .HasOne(ds => ds.SuggestedUser)
                .WithMany()
                .HasForeignKey(ds => ds.SuggestedUserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Story>()
                .HasOne(s => s.User)
                .WithMany()
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<StoryView>()
                .HasKey(sv => new { sv.StoryId, sv.ViewerId });
            modelBuilder.Entity<StoryView>()
                .HasOne(sv => sv.Story)
                .WithMany()
                .HasForeignKey(sv => sv.StoryId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<StoryView>()
                .HasOne(sv => sv.Viewer)
                .WithMany()
                .HasForeignKey(sv => sv.ViewerId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<PostPoll>()
                .HasOne(p => p.Post)
                .WithOne()
                .HasForeignKey<PostPoll>(p => p.PostId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<PollOption>()
                .HasOne(po => po.PostPoll)
                .WithMany(p => p.Options)
                .HasForeignKey(po => po.PostId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<PollVote>()
                .HasKey(pv => new { pv.PollOptionId, pv.UserId });
            modelBuilder.Entity<PollVote>()
                .HasOne(pv => pv.PollOption)
                .WithMany(po => po.Votes)
                .HasForeignKey(pv => pv.PollOptionId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<PollVote>()
                .HasOne(pv => pv.User)
                .WithMany()
                .HasForeignKey(pv => pv.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<CompanyFollow>()
                .HasKey(cf => new { cf.UserId, cf.BusinessAccountId });
            modelBuilder.Entity<CompanyFollow>()
                .HasOne(cf => cf.User)
                .WithMany()
                .HasForeignKey(cf => cf.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<CompanyFollow>()
                .HasOne(cf => cf.BusinessAccount)
                .WithMany()
                .HasForeignKey(cf => cf.BusinessAccountId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<CompanyProfileView>()
                .HasOne(view => view.BusinessAccount)
                .WithMany()
                .HasForeignKey(view => view.BusinessAccountId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<CompanyProfileView>()
                .HasIndex(view => new { view.BusinessAccountId, view.ViewedAtUtc });

            modelBuilder.Entity<HiddenPost>()
                .HasKey(hp => new { hp.UserId, hp.PostId });
            modelBuilder.Entity<HiddenPost>()
                .HasOne(hp => hp.User)
                .WithMany()
                .HasForeignKey(hp => hp.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<HiddenPost>()
                .HasOne(hp => hp.Post)
                .WithMany()
                .HasForeignKey(hp => hp.PostId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<PostReport>()
                .HasOne(pr => pr.Post)
                .WithMany()
                .HasForeignKey(pr => pr.PostId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<PostReport>()
                .HasOne(pr => pr.Reporter)
                .WithMany()
                .HasForeignKey(pr => pr.ReporterId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Mention>()
                .HasOne(m => m.Post)
                .WithMany()
                .HasForeignKey(m => m.PostId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<Mention>()
                .HasOne(m => m.Comment)
                .WithMany()
                .HasForeignKey(m => m.CommentId)
                .OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<Mention>()
                .HasOne(m => m.MentionedUser)
                .WithMany()
                .HasForeignKey(m => m.MentionedUserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<PostHashTag>()
                .HasKey(pt => new { pt.PostId, pt.Tag });
            modelBuilder.Entity<PostHashTag>()
                .HasOne(pt => pt.Post)
                .WithMany()
                .HasForeignKey(pt => pt.PostId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
