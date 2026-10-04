using System.ComponentModel.DataAnnotations;

namespace ArisSkyve.Domain.Entities
{
    public class ContactMethod
    {
        [Key]
        public int Id { get; set; }

        public ContactMethodType MethodType { get; set; }
        public string Value { get; set; } = string.Empty;

        public int  idEmployesAccount { get; set; }
        public EmployesAccount EmployesAccount { get; set; }
    }
}
