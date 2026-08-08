export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@journal.internal`;
}
