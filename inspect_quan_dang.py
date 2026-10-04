import pyodbc
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

conn_str = 'Driver={ODBC Driver 17 for SQL Server};Server=localhost\\SQLEXPRESS;Database=ArisSkyve_Dev;Trusted_Connection=yes;'
conn = pyodbc.connect(conn_str)
cursor = conn.cursor()

cursor.execute('SELECT * FROM Users WHERE Id = 4')
user = dict(zip([col[0] for col in cursor.description], cursor.fetchone()))
print("=== USER ===")
print(json.dumps(user, default=str, ensure_ascii=False, indent=2))

cursor.execute('SELECT * FROM Profiles WHERE UserId = 4')
p_row = cursor.fetchone()
profile = dict(zip([col[0] for col in cursor.description], p_row)) if p_row else None
print("\n=== PROFILE ===")
print(json.dumps(profile, default=str, ensure_ascii=False, indent=2))

cursor.execute('SELECT * FROM Resumes WHERE UserId = 4')
resumes = [dict(zip([col[0] for col in cursor.description], row)) for row in cursor.fetchall()]
print("\n=== RESUMES ===")
print(json.dumps(resumes, default=str, ensure_ascii=False, indent=2))

if resumes:
    r_id = resumes[0]['Id']
    cursor.execute('SELECT * FROM Experiences WHERE ResumeId = ?', (r_id,))
    exps = [dict(zip([col[0] for col in cursor.description], row)) for row in cursor.fetchall()]
    print("\n=== EXPERIENCES ===")
    print(json.dumps(exps, default=str, ensure_ascii=False, indent=2))

    cursor.execute('SELECT * FROM Educations WHERE ResumeId = ?', (r_id,))
    edus = [dict(zip([col[0] for col in cursor.description], row)) for row in cursor.fetchall()]
    print("\n=== EDUCATIONS ===")
    print(json.dumps(edus, default=str, ensure_ascii=False, indent=2))

conn.close()
