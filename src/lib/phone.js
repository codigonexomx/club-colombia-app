const DEFAULT_REGION_CODE = "52";

export function normalizePhoneNumber(phone, defaultRegionCode = DEFAULT_REGION_CODE) {
  const rawPhone = String(phone || "").trim();
  if (!rawPhone) return "";

  const hasInternationalPrefix = rawPhone.startsWith("+");
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return "";

  let normalizedDigits = digits;
  if (hasInternationalPrefix) {
    normalizedDigits = digits;
  } else if (digits.startsWith("00")) {
    normalizedDigits = digits.slice(2);
  } else if (digits.length === 10) {
    normalizedDigits = `${defaultRegionCode}${digits}`;
  }

  return `+${normalizedDigits}`;
}

export function isValidE164Phone(phone) {
  return /^\+[1-9]\d{7,14}$/.test(String(phone || ""));
}

export function normalizeAndValidatePhone(phone, defaultRegionCode = DEFAULT_REGION_CODE) {
  const normalizedPhone = normalizePhoneNumber(phone, defaultRegionCode);
  if (!isValidE164Phone(normalizedPhone)) {
    throw new Error("El teléfono debe ser válido y estar en formato internacional E.164");
  }
  return normalizedPhone;
}
