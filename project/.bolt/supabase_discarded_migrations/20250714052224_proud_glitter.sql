/*
  # Create payments table

  1. New Tables
    - `payments`
      - `id` (uuid, primary key)
      - `invoice_id` (uuid, foreign key to invoices)
      - `amount` (numeric)
      - `payment_method` (text)
      - `payment_reference` (text)
      - `payment_date` (date)
      - `received_by` (uuid, foreign key to users)
      - `created_at` (timestamp)
  2. Security
    - Enable RLS on `payments` table
    - Add policy for authenticated users to manage payments
*/

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  payment_method text NOT NULL,
  payment_reference text,
  payment_date date DEFAULT CURRENT_DATE,
  received_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can manage payments"
  ON payments
  FOR ALL
  TO authenticated
  USING (true);

-- Create index for faster lookups
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);
CREATE INDEX idx_payments_payment_method ON payments(payment_method);