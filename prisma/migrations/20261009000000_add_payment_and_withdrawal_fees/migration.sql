ALTER TABLE `PaymentOrder`
  ADD COLUMN `feeAmountCents` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `vatAmountCents` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `WithdrawalRequest`
  ADD COLUMN `transactionFee` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `serviceFee` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `netAmount` INTEGER NOT NULL DEFAULT 0;

UPDATE `WithdrawalRequest`
SET
  `transactionFee` = FLOOR(`amount` * 0.025 + 0.5),
  `serviceFee` = FLOOR(`amount` * 0.015 + 0.5),
  `netAmount` = `amount`
    - FLOOR(`amount` * 0.025 + 0.5)
    - FLOOR(`amount` * 0.015 + 0.5);
