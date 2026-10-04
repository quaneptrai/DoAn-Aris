using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ArisSkyve.Hubs
{
    // WebRTC signaling only — no media ever passes through the server. Relies on
    // Clients.User(...), the same targeting pattern ChatHub already uses (SignalR maps it
    // from ClaimTypes.NameIdentifier automatically), so a signal only ever reaches the one
    // specific other party of a call, never broadcast.
    //
    // Two call "kinds" share this hub:
    //  - Interview calls (JoinInterviewCall/SendInterviewSignal/LeaveInterviewCall): the room
    //    is a JobApplication id, and the other party is derived from the DB on every single
    //    call (never trusts a client-supplied peer id) — only the candidate and the business
    //    that owns the posting may ever reach each other this way.
    //  - Direct chat calls (JoinChatCall/SendChatSignal/LeaveChatCall): any two authenticated
    //    users, matching the existing open-messaging model (ChatController already lets any
    //    user message any other user — there's no friends-only gate on chat itself).
    [Authorize]
    public class VideoCallHub : Hub
    {
        private readonly ArisDBContext _context;

        public VideoCallHub(ArisDBContext context)
        {
            _context = context;
        }

        private int CurrentUserId => int.Parse(Context.User!.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        private async Task<int?> GetInterviewOtherPartyUserIdAsync(int applicationId)
        {
            var application = await _context.JobApplications
                .Include(a => a.Applicant)
                .Include(a => a.JobPosting).ThenInclude(j => j.BusinessAccount)
                .FirstOrDefaultAsync(a => a.Id == applicationId);

            if (application == null || !application.IsVideoCall) return null;

            var candidateUserId = application.Applicant.UserId;
            var employerUserId = application.JobPosting.BusinessAccount?.UserId;

            if (CurrentUserId == candidateUserId) return employerUserId;
            if (employerUserId.HasValue && CurrentUserId == employerUserId.Value) return candidateUserId;
            return null; // caller isn't a participant of this interview
        }

        private static string ChatRoomId(int userA, int userB) => $"chat-{Math.Min(userA, userB)}-{Math.Max(userA, userB)}";

        // ---- Interview calls ----

        public async Task JoinInterviewCall(int applicationId)
        {
            var otherUserId = await GetInterviewOtherPartyUserIdAsync(applicationId);
            if (otherUserId == null) return;

            await Clients.User(otherUserId.Value.ToString()).SendAsync("PeerJoined", applicationId.ToString(), CurrentUserId);
        }

        public async Task SendInterviewSignal(int applicationId, object signal)
        {
            var otherUserId = await GetInterviewOtherPartyUserIdAsync(applicationId);
            if (otherUserId == null) return;

            await Clients.User(otherUserId.Value.ToString()).SendAsync("ReceiveSignal", applicationId.ToString(), CurrentUserId, signal);
        }

        public async Task LeaveInterviewCall(int applicationId)
        {
            var otherUserId = await GetInterviewOtherPartyUserIdAsync(applicationId);
            if (otherUserId == null) return;

            await Clients.User(otherUserId.Value.ToString()).SendAsync("PeerLeft", applicationId.ToString());
        }

        // ---- Direct chat calls ----

        public async Task JoinChatCall(int otherUserId)
        {
            if (otherUserId == CurrentUserId) return;
            var exists = await _context.Users.AnyAsync(u => u.Id == otherUserId);
            if (!exists) return;

            await Clients.User(otherUserId.ToString()).SendAsync("PeerJoined", ChatRoomId(CurrentUserId, otherUserId), CurrentUserId);
        }

        public async Task SendChatSignal(int otherUserId, object signal)
        {
            if (otherUserId == CurrentUserId) return;
            await Clients.User(otherUserId.ToString()).SendAsync("ReceiveSignal", ChatRoomId(CurrentUserId, otherUserId), CurrentUserId, signal);
        }

        public async Task LeaveChatCall(int otherUserId)
        {
            if (otherUserId == CurrentUserId) return;
            await Clients.User(otherUserId.ToString()).SendAsync("PeerLeft", ChatRoomId(CurrentUserId, otherUserId));
        }

        // Lets the callee decline before ever touching their camera/mic.
        public async Task DeclineChatCall(int otherUserId)
        {
            if (otherUserId == CurrentUserId) return;
            await Clients.User(otherUserId.ToString()).SendAsync("CallDeclined", ChatRoomId(CurrentUserId, otherUserId));
        }
    }
}
