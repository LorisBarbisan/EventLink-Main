// PII-safe logging utility
export function sanitizeLogData(data: any): any {
  if (!data || typeof data !== "object") return {};

  const sensitiveFields = [
    "password",
    "token",
    "secret",
    "key",
    "email",
    "phone",
    "ssn",
    "first_name",
    "last_name",
    "address",
    "credit_card",
    "auth_token",
    "session_id",
    "refresh_token",
    "access_token",
    "api_key",
    // Money and identifiers — Books made numbers the sensitive part
    "pence",
    "amount",
    "total",
    "profit",
    "rate",
    "earning",
    "expense",
    "salary",
    "income",
    "tax",
    "reference_number",
    "utr",
    "sort_code",
    "account_number",
    "iban",
    "vat",
  ];

  const result: any = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveFields.some((field) => lowerKey.includes(field));

    if (isSensitive) {
      result[key] = "[REDACTED]";
    } else if (key === "error" || key === "message" || key === "status") {
      result[key] = value; // Keep error messages for debugging
    } else if (typeof value === "number" || typeof value === "boolean") {
      result[key] = value; // Keep non-sensitive primitive values
    } else if (key === "id" || key === "count") {
      result[key] = value; // Keep IDs and counts
    }
  }

  return result;
}
