export function calculatePaymentFee(amount: number): number {
  return Math.floor((amount * 3 + 50) / 100);
}
