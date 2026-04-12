export type Slots = {
  client_id: string;
  loan_amount: number;
  missing: string[];
};

const DEFAULT_CLIENT = "12345";
const DEFAULT_LOAN = 500_000;

export function parseSlots(message: string): Slots {
  const missing: string[] = [];
  let client_id = DEFAULT_CLIENT;
  let loan_amount = DEFAULT_LOAN;

  const lower = message.toLowerCase();
  if (lower.includes("500k") || lower.includes("500 k")) {
    loan_amount = 500_000;
  }

  const nums = message.match(/\d[\d\s,]*/g)?.map((s) => parseInt(s.replace(/[\s,]/g, ""), 10)) ?? [];

  for (const n of nums) {
    if (Number.isNaN(n)) continue;
    if (n >= 100_000) loan_amount = n;
    else if (n >= 1000 && n < 100_000) client_id = String(n);
  }

  /* PoC: явный id из слов вида conflict / no_history / timeout / timeout_bki */
  const special = message.match(/\b(no_history|conflict|timeout_bki|timeout_pd|timeout)\b/i);
  if (special) client_id = special[1].toLowerCase();

  return { client_id, loan_amount, missing };
}
