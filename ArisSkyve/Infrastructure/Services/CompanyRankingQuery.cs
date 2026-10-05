using ArisSkyve.Application.DTOs;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.EntityFrameworkCore;

namespace ArisSkyve.Infrastructure.Services;

/// <summary>
/// Server-side, EF-translatable company aggregates and deterministic ranking.
/// </summary>
public static class CompanyRankingQuery
{
    public const int MaxRows = 50;

    public static IQueryable<CompanyRankingRowViewModel> Build(
        ArisDBContext db,
        string? sortBy,
        string? industry,
        bool followerMetricAvailable,
        int take = MaxRows)
    {
        var businesses = db.BussinessAccounts.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(industry))
            businesses = businesses.Where(company => company.Industry == industry);

        IQueryable<CompanyRankingRowViewModel> rows;
        if (followerMetricAvailable)
        {
            rows = businesses.Select(company => new CompanyRankingRowViewModel
            {
                CompanyId = company.Id,
                CompanyName = company.CompanyName,
                Industry = company.Industry,
                AvatarUrl = company.AvatarUrl,
                IsVerified = company.IsVerified,
                ProfileViewCount = db.CompanyProfileViews.Count(view => view.BusinessAccountId == company.Id),
                FollowerCount = db.CompanyFollows.Count(follow => follow.BusinessAccountId == company.Id),
                ApplicationCount = db.JobApplications.Count(application =>
                    application.JobPosting.BusinessAccountId == company.Id &&
                    application.Status != JobApplicationStatus.Withdrawn)
            });
        }
        else
        {
            rows = businesses.Select(company => new CompanyRankingRowViewModel
            {
                CompanyId = company.Id,
                CompanyName = company.CompanyName,
                Industry = company.Industry,
                AvatarUrl = company.AvatarUrl,
                IsVerified = company.IsVerified,
                ProfileViewCount = db.CompanyProfileViews.Count(view => view.BusinessAccountId == company.Id),
                FollowerCount = 0,
                ApplicationCount = db.JobApplications.Count(application =>
                    application.JobPosting.BusinessAccountId == company.Id &&
                    application.Status != JobApplicationStatus.Withdrawn)
            });
        }

        IOrderedQueryable<CompanyRankingRowViewModel> ordered = sortBy switch
        {
            "views" => rows.OrderByDescending(company => company.ProfileViewCount),
            "followers" when followerMetricAvailable => rows.OrderByDescending(company => company.FollowerCount),
            "applications" => rows.OrderByDescending(company => company.ApplicationCount),
            _ => rows.OrderByDescending(company => company.ApplicationCount)
                .ThenByDescending(company => company.ProfileViewCount)
                .ThenByDescending(company => company.FollowerCount)
        };

        return ordered
            .ThenBy(company => company.CompanyName)
            .ThenBy(company => company.CompanyId)
            .Take(Math.Clamp(take, 1, MaxRows));
    }
}
