export function hasJsonContentType(request: Request): boolean {
  const contentType = request.headers.get("content-type");
  if (!contentType) return false;

  const [mediaType] = contentType.split(";", 1);
  return mediaType?.trim().toLowerCase() === "application/json";
}
