namespace ArisSkyve.Domain.Entities
{
    public class PostMedias
    {
        public int Id { get; set; }

        public int PostId { get; set; }
        public Post Post { get; set; }

        public string MediaUrl { get; set; }
        public string MediaType { get; set; }
    }
}
