using System.Globalization;
using System.Text.Json;
using ArisSkyve.Domain.Entities;

namespace ArisSkyve.Infrastructure.Services.Recruitment
{
    public record NextStep(string Key, string Title, string Text, IReadOnlyList<string> Actions);

    // Một nơi duy nhất quyết định "bây giờ làm gì tiếp" cho mỗi đơn, để bảng Kanban, ngăn chi
    // tiết của nhà tuyển dụng và trang "Đơn ứng tuyển" của ứng viên luôn nói cùng một điều.
    public static class RecruitmentFlow
    {
        public static string StatusLabel(string status) => status switch
        {
            JobApplicationStatus.Submitted => "Đã nộp",
            JobApplicationStatus.UnderReview => "Đang xem xét",
            JobApplicationStatus.Shortlisted => "Vào danh sách rút gọn",
            JobApplicationStatus.InterviewScheduled => "Mời phỏng vấn",
            JobApplicationStatus.Offered => "Nhận offer",
            JobApplicationStatus.Hired => "Đã tuyển",
            JobApplicationStatus.Rejected => "Từ chối",
            JobApplicationStatus.Withdrawn => "Đã rút đơn",
            _ => status
        };

        public static string RecommendationLabel(string rec) => rec switch
        {
            EvaluationRecommendations.Hire => "Nên tuyển",
            EvaluationRecommendations.NextRound => "Phỏng vấn vòng sau",
            EvaluationRecommendations.Hold => "Cân nhắc thêm",
            EvaluationRecommendations.Reject => "Không phù hợp",
            _ => rec
        };

        public static List<DateTime> ParseSlots(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return new();
            try { return JsonSerializer.Deserialize<List<DateTime>>(json) ?? new(); }
            catch (JsonException) { return new(); }
        }

        // Chuỗi ISO có múi giờ → UTC; không có múi giờ → hiểu là giờ Việt Nam.
        public static DateTime? ParseClientTime(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return null;
            raw = raw.Trim();
            var hasOffset = raw.EndsWith("Z", StringComparison.OrdinalIgnoreCase)
                            || System.Text.RegularExpressions.Regex.IsMatch(raw, @"[+-]\d\d:?\d\d$");
            if (hasOffset && DateTimeOffset.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dto))
                return dto.UtcDateTime;
            if (DateTime.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.None, out var local))
                return VnTime.NormalizeToUtc(DateTime.SpecifyKind(local, DateTimeKind.Unspecified));
            return null;
        }

        public static bool InterviewFinished(JobApplication a, DateTime now) =>
            a.InterviewAt.HasValue && a.InterviewAt.Value.AddMinutes(Math.Max(15, a.InterviewDurationMinutes)) <= now;

        public static NextStep ForEmployer(JobApplication a, InterviewEvaluation? roundEval, DateTime now, int hiredCount, int? openings)
        {
            switch (a.Status)
            {
                case JobApplicationStatus.Submitted:
                case JobApplicationStatus.UnderReview:
                    return new("review", "Xem hồ sơ",
                        "Đọc CV và phân tích AI, rồi chọn: rút gọn, hẹn phỏng vấn hoặc từ chối.",
                        new[] { "shortlist", "schedule", "reject" });

                case JobApplicationStatus.Shortlisted:
                    return new("schedule", "Hẹn phỏng vấn",
                        "Hồ sơ đã vào danh sách rút gọn. Bước tiếp là hẹn lịch phỏng vấn.",
                        new[] { "schedule", "reject" });

                case JobApplicationStatus.InterviewScheduled:
                {
                    var when = a.InterviewAt.HasValue ? VnTime.Format(a.InterviewAt.Value, "HH:mm dd/MM") : "?";
                    if (a.InterviewResponse == InterviewResponses.Declined)
                    {
                        var slots = ParseSlots(a.ProposedSlotsJson).Count(s => s > now);
                        var why = string.IsNullOrWhiteSpace(a.InterviewDeclineReason) ? "" : $" Lý do: {a.InterviewDeclineReason}.";
                        return new("reschedule", "Ứng viên xin đổi lịch",
                            $"Ứng viên không tham gia được lúc {when}.{why}"
                            + (slots > 0 ? $" Họ đề xuất {slots} khung giờ khác — chọn một để chốt ngay." : " Hẹn một giờ khác hoặc khép hồ sơ."),
                            slots > 0 ? new[] { "pickSlot", "reschedule", "reject" } : new[] { "reschedule", "reject" });
                    }
                    if (InterviewFinished(a, now))
                    {
                        if (roundEval == null)
                            return new("evaluate", $"Đánh giá phỏng vấn vòng {a.InterviewRound}",
                                "Buổi phỏng vấn đã xong. Ghi phiếu đánh giá để chốt bước tiếp: offer, vòng sau hoặc từ chối.",
                                new[] { "evaluate", "reschedule" });
                        return roundEval.Recommendation switch
                        {
                            EvaluationRecommendations.Hire => new("decide-offer", "Gửi offer",
                                $"Phiếu vòng {a.InterviewRound}: nên tuyển. Gửi offer với mức lương, ngày bắt đầu và hạn trả lời.",
                                new[] { "offer", "nextRound", "reject" }),
                            EvaluationRecommendations.NextRound => new("decide-next", $"Hẹn vòng {a.InterviewRound + 1}",
                                $"Phiếu vòng {a.InterviewRound} đề xuất phỏng vấn thêm một vòng.",
                                new[] { "nextRound", "offer", "reject" }),
                            EvaluationRecommendations.Reject => new("decide-reject", "Gửi phản hồi từ chối",
                                $"Phiếu vòng {a.InterviewRound}: không phù hợp. Gửi phản hồi để ứng viên không phải chờ.",
                                new[] { "reject", "nextRound" }),
                            _ => new("decide-hold", "Đang cân nhắc",
                                "Phiếu đánh giá để ở mức cân nhắc. Khi đã rõ, chọn offer, vòng sau hoặc từ chối.",
                                new[] { "offer", "nextRound", "reject" })
                        };
                    }
                    if (a.InterviewResponse == InterviewResponses.Accepted)
                        return new("upcoming", "Phỏng vấn sắp diễn ra",
                            $"Ứng viên đã xác nhận lịch {when}. Aris sẽ nhắc cả hai bên trước 24 giờ và 1 giờ.",
                            a.IsVideoCall ? new[] { "joinRoom", "reschedule", "ics" } : new[] { "reschedule", "ics" });
                    return new("await-confirm", "Chờ ứng viên xác nhận",
                        $"Đã mời phỏng vấn lúc {when}, ứng viên chưa trả lời.",
                        new[] { "reschedule", "ics" });
                }

                case JobApplicationStatus.Offered:
                    if (a.OfferResponse == OfferResponses.Declined)
                        return new("offer-declined", "Ứng viên từ chối offer",
                            "Ứng viên đã từ chối offer" + (string.IsNullOrWhiteSpace(a.OfferDeclineReason) ? "." : $": {a.OfferDeclineReason}.")
                            + " Gửi offer mới hoặc khép hồ sơ.",
                            new[] { "offer", "reject" });
                    if (a.OfferExpiresAt.HasValue && a.OfferExpiresAt < now)
                        return new("offer-expired", "Offer đã quá hạn",
                            $"Hạn trả lời {VnTime.Format(a.OfferExpiresAt.Value, "dd/MM")} đã qua mà chưa có phản hồi. Gia hạn bằng offer mới hoặc khép hồ sơ.",
                            new[] { "offer", "reject" });
                    return new("offer-pending", "Chờ phản hồi offer",
                        "Đã gửi offer" + (a.OfferExpiresAt.HasValue ? $", hạn trả lời {VnTime.Format(a.OfferExpiresAt.Value, "dd/MM")}." : ".")
                        + " Nếu ứng viên đã đồng ý ngoài hệ thống, bạn có thể ghi nhận đã tuyển.",
                        new[] { "markHired", "offer" });

                case JobApplicationStatus.Hired:
                {
                    var full = openings.HasValue && hiredCount >= openings.Value;
                    return new("hired", "Đã tuyển",
                        openings.HasValue
                            ? $"Đã tuyển {hiredCount}/{openings} vị trí." + (full ? " Đã đủ người — có thể đóng tin để ngừng nhận hồ sơ." : "")
                            : $"Đã tuyển {hiredCount} người cho tin này.",
                        full ? new[] { "closeJob" } : Array.Empty<string>());
                }

                case JobApplicationStatus.Rejected:
                    return new("closed", "Đã từ chối", "Hồ sơ đã khép. Ứng viên đã nhận phản hồi của bạn.", Array.Empty<string>());

                default:
                    return new("closed", "Ứng viên đã rút đơn", "Ứng viên đã rút đơn này.", Array.Empty<string>());
            }
        }

        public static NextStep ForCandidate(JobApplication a, DateTime now)
        {
            switch (a.Status)
            {
                case JobApplicationStatus.Submitted:
                case JobApplicationStatus.UnderReview:
                    return new("waiting", "Đang chờ nhà tuyển dụng",
                        "Hồ sơ đã đến nhà tuyển dụng. Trong lúc chờ, xem AI đánh giá CV của bạn với tin này.",
                        new[] { "insight", "withdraw" });
                case JobApplicationStatus.Shortlisted:
                    return new("waiting", "Bạn đã vào danh sách rút gọn",
                        "Nhà tuyển dụng đã chọn hồ sơ của bạn để xem tiếp. Lời mời phỏng vấn (nếu có) sẽ hiện ở đây.",
                        new[] { "insight", "withdraw" });
                case JobApplicationStatus.InterviewScheduled:
                {
                    var when = a.InterviewAt.HasValue ? VnTime.Format(a.InterviewAt.Value, "HH:mm, dd/MM") : "?";
                    if (InterviewFinished(a, now) && a.InterviewResponse != InterviewResponses.Declined)
                        return new("await-result", "Chờ kết quả phỏng vấn",
                            "Buổi phỏng vấn đã diễn ra. Nhà tuyển dụng sẽ báo kết quả ở đây.",
                            new[] { "insight" });
                    if (a.InterviewResponse == InterviewResponses.Declined)
                        return new("await-reschedule", "Đang chờ lịch mới",
                            "Bạn đã báo bận và gửi giờ có thể tham gia. Nhà tuyển dụng sẽ chốt lại lịch.",
                            new[] { "insight" });
                    if (a.InterviewResponse == InterviewResponses.Accepted)
                        return new("prepare", $"Phỏng vấn lúc {when}",
                            "Bạn đã xác nhận. Thêm vào lịch để không quên; Aris sẽ nhắc trước 24 giờ và 1 giờ.",
                            a.IsVideoCall ? new[] { "joinRoom", "ics", "declineInterview" } : new[] { "ics", "declineInterview" });
                    return new("confirm", "Xác nhận lịch phỏng vấn",
                        $"Bạn được mời phỏng vấn vòng {a.InterviewRound} lúc {when}. Xác nhận, hoặc báo bận và đề xuất giờ khác.",
                        new[] { "acceptInterview", "declineInterview", "ics" });
                }
                case JobApplicationStatus.Offered:
                    if (a.OfferResponse == OfferResponses.Declined)
                        return new("offer-declined", "Bạn đã từ chối offer", "Nhà tuyển dụng đã nhận phản hồi của bạn.", Array.Empty<string>());
                    return new("offer", "Bạn nhận được offer",
                        "Xem điều kiện và trả lời" + (a.OfferExpiresAt.HasValue ? $" trước {VnTime.Format(a.OfferExpiresAt.Value, "dd/MM/yyyy")}." : "."),
                        new[] { "acceptOffer", "declineOffer" });
                case JobApplicationStatus.Hired:
                    return new("hired", "Chúc mừng, bạn đã nhận việc",
                        a.OfferStartDate.HasValue ? $"Ngày bắt đầu dự kiến: {VnTime.Format(a.OfferStartDate.Value, "dd/MM/yyyy")}." : "Nhà tuyển dụng sẽ liên hệ về ngày bắt đầu.",
                        Array.Empty<string>());
                case JobApplicationStatus.Rejected:
                    return new("rejected", "Hồ sơ chưa phù hợp lần này",
                        "Xem vì sao, CV nên sửa gì và nên học thêm kỹ năng nào cho lần sau.",
                        new[] { "insight" });
                default:
                    return new("withdrawn", "Bạn đã rút đơn", "Đơn này không còn được xem xét.", Array.Empty<string>());
            }
        }
    }
}
