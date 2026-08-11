export function isTestPayment(payment = {}) {
  return payment.isTest === true || payment.excludedFromFinancialHistory === true;
}

export function isFinancialPayment(payment = {}) {
  return !isTestPayment(payment);
}

export function filterFinancialPayments(payments = []) {
  return (payments || []).filter(isFinancialPayment);
}
