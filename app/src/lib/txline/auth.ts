export function txLineAuthConfigured(): boolean {
  return Boolean(process.env.TXLINE_SESSION_TOKEN || process.env.TXLINE_API_TOKEN);
}
