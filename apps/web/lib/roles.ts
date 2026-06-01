export function roleLabel(role: string): string {
  if (role === "LECTURER") return "Викладач";
  if (role === "ADMIN") return "Адміністратор";
  return "Студент";
}

export function homeForRole(role: string): string {
  if (role === "ADMIN") return "/admin/dashboard";
  if (role === "LECTURER") return "/lecturer/dashboard";
  return "/student/scan";
}
