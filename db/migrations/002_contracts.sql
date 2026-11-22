CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL,
  title TEXT NOT NULL,
  counterparty TEXT NOT NULL DEFAULT '',
  amount BIGINT NOT NULL CHECK (amount BETWEEN 0 AND 99999999999999),
  signed_on DATE NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE UNIQUE INDEX contracts_reference_unique ON contracts (lower(reference));

CREATE TABLE works (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_reference TEXT,
  price BIGINT NOT NULL CHECK (price BETWEEN 0 AND 99999999999999),
  opened_on DATE NOT NULL,
  accepted_on DATE CHECK (accepted_on >= opened_on),
  cancelled_on DATE CHECK (cancelled_on >= coalesce(accepted_on, opened_on)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  UNIQUE (contract_id, id)
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  work_id UUID,
  purpose TEXT NOT NULL,
  source_reference TEXT,
  amount BIGINT NOT NULL CHECK (amount BETWEEN 1 AND 99999999999999),
  recorded_on DATE NOT NULL,
  paid_on DATE CHECK (paid_on >= recorded_on),
  refunded_on DATE CHECK (refunded_on IS NULL OR (paid_on IS NOT NULL AND refunded_on >= paid_on)),
  refunded_amount BIGINT CHECK (refunded_amount BETWEEN 1 AND amount),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT refund_fields_together CHECK ((refunded_on IS NULL) = (refunded_amount IS NULL)),
  FOREIGN KEY (contract_id, work_id) REFERENCES works (contract_id, id)
);

CREATE INDEX payments_contract_date ON payments (contract_id, recorded_on);
CREATE INDEX payments_work ON payments (contract_id, work_id) WHERE work_id IS NOT NULL;
