/**
 * Format numeric rupees into Indian Rupee format (e.g. ₹75,00,000).
 */
export function formatINR(amount: number): string {
  if (amount === 0) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
