BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    ALTER TABLE [JobPostings] ADD [Openings] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    ALTER TABLE [JobApplications] ADD [FollowUpNudgedAt] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    ALTER TABLE [JobApplications] ADD [HiredAt] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    ALTER TABLE [JobApplications] ADD [InterviewDeclineReason] nvarchar(500) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    ALTER TABLE [JobApplications] ADD [InterviewDurationMinutes] int NOT NULL DEFAULT 45;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    ALTER TABLE [JobApplications] ADD [InterviewRespondedAt] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    ALTER TABLE [JobApplications] ADD [InterviewRound] int NOT NULL DEFAULT 1;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    ALTER TABLE [JobApplications] ADD [MatchAttempts] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    ALTER TABLE [JobApplications] ADD [MatchDetailJson] nvarchar(max) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    ALTER TABLE [JobApplications] ADD [MatchError] nvarchar(300) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    ALTER TABLE [JobApplications] ADD [MatchScore] float NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    ALTER TABLE [JobApplications] ADD [MatchScoredAt] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    ALTER TABLE [JobApplications] ADD [MatchSummary] nvarchar(400) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    ALTER TABLE [JobApplications] ADD [OfferDeclineReason] nvarchar(500) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    ALTER TABLE [JobApplications] ADD [OfferExpiresAt] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    ALTER TABLE [JobApplications] ADD [OfferRespondedAt] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    ALTER TABLE [JobApplications] ADD [OfferResponse] nvarchar(20) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    ALTER TABLE [JobApplications] ADD [OfferSalary] nvarchar(200) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    ALTER TABLE [JobApplications] ADD [OfferStartDate] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    ALTER TABLE [JobApplications] ADD [ProposedSlotsJson] nvarchar(max) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    ALTER TABLE [JobApplications] ADD [RejectionCategory] nvarchar(20) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    ALTER TABLE [JobApplications] ADD [Reminder1hSentAt] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    ALTER TABLE [JobApplications] ADD [Reminder24hSentAt] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    CREATE TABLE [ApplicationEvents] (
        [Id] int NOT NULL IDENTITY,
        [JobApplicationId] int NOT NULL,
        [Type] nvarchar(40) NOT NULL,
        [ActorRole] nvarchar(20) NOT NULL,
        [ActorUserId] int NULL,
        [Title] nvarchar(300) NOT NULL,
        [Detail] nvarchar(max) NULL,
        [IsInternal] bit NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_ApplicationEvents] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ApplicationEvents_JobApplications_JobApplicationId] FOREIGN KEY ([JobApplicationId]) REFERENCES [JobApplications] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    CREATE TABLE [InterviewEvaluations] (
        [Id] int NOT NULL IDENTITY,
        [JobApplicationId] int NOT NULL,
        [Round] int NOT NULL,
        [EvaluatorUserId] int NOT NULL,
        [TechnicalRating] int NOT NULL,
        [CommunicationRating] int NOT NULL,
        [ProblemSolvingRating] int NOT NULL,
        [CultureFitRating] int NOT NULL,
        [Recommendation] nvarchar(20) NOT NULL,
        [Strengths] nvarchar(1500) NULL,
        [Concerns] nvarchar(1500) NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_InterviewEvaluations] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_InterviewEvaluations_JobApplications_JobApplicationId] FOREIGN KEY ([JobApplicationId]) REFERENCES [JobApplications] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    CREATE INDEX [IX_JobApplications_InterviewAt] ON [JobApplications] ([InterviewAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    CREATE INDEX [IX_JobApplications_MatchScoredAt] ON [JobApplications] ([MatchScoredAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    CREATE INDEX [IX_ApplicationEvents_JobApplicationId_CreatedAt] ON [ApplicationEvents] ([JobApplicationId], [CreatedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    CREATE INDEX [IX_InterviewEvaluations_JobApplicationId_Round] ON [InterviewEvaluations] ([JobApplicationId], [Round]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261004094055_RecruitmentFlowV2'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261004094055_RecruitmentFlowV2', N'10.0.4');
END;

COMMIT;
GO

