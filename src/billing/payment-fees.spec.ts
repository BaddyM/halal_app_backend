import { calculatePaymentFee } from './payment-fees';

describe('payment fee rounding', () => {
  it('rounds 3% to the nearest stored currency unit, with halves up', () => {
    expect(calculatePaymentFee(10_000)).toBe(300);
    expect(calculatePaymentFee(17)).toBe(1);
    expect(calculatePaymentFee(16)).toBe(0);
  });
});
