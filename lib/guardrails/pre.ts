const INJECTION = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s*prompt/i,
  /you\s+are\s+now/i,
  /\[\s*INST\s*\]/i,
];

const DOMAIN_HINTS =
  /кредит|риск|клиент|займ|loan|credit|pd|политик|оцени|assess|borrower/i;

export type PreGuardResult =
  | { ok: true }
  | { ok: false; reason: string; safe_message: string };

export function guardrailPre(userMessage: string): PreGuardResult {
  if (userMessage.length > 8000) {
    return {
      ok: false,
      reason: "message_too_long",
      safe_message: "Сообщение слишком длинное. Сократите запрос (макс. 8000 символов).",
    };
  }

  for (const re of INJECTION) {
    if (re.test(userMessage)) {
      return {
        ok: false,
        reason: "injection_pattern",
        safe_message:
          "Запрос отклонён политикой безопасности. Переформулируйте запрос в контексте кредитного риска.",
      };
    }
  }

  if (!DOMAIN_HINTS.test(userMessage)) {
    return {
      ok: false,
      reason: "out_of_domain",
      safe_message:
        "Я могу помогать только с задачами оценки кредитного риска. Укажите идентификатор клиента и сумму кредита.",
    };
  }

  return { ok: true };
}
