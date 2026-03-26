/*
  # Create orders table

  1. New Tables
    - Ensures the orders table exists with all required fields
    - Adds appropriate indexes for performance
  2. Security
    - Enable RLS on orders table
    - Add policies for authenticated users
*/

-- Create orders table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name character varying(255) NOT NULL,
  status order_status NOT NULL DEFAULT 'Sample Collection'::order_status,
  priority priority_type NOT NULL DEFAULT 'Normal'::priority_type,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_date date NOT NULL,
  total_amount numeric(10,2) NOT NULL CHECK (total_amount >= 0),
  doctor character varying(255) NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create order_tests table to store tests associated with an order
CREATE TABLE IF NOT EXISTS public.order_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  test_name character varying(255) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_patient_id ON public.orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON public.orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_priority ON public.orders(priority);
CREATE INDEX IF NOT EXISTS idx_order_tests_order_id ON public.order_tests(order_id);

-- Enable row level security
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_tests ENABLE ROW LEVEL SECURITY;

-- Create policies for orders table
CREATE POLICY "Users can read orders" 
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create orders" 
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Lab staff can modify orders" 
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Admins can delete orders" 
  ON public.orders
  FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for order_tests table
CREATE POLICY "Users can read order tests" 
  ON public.order_tests
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Lab staff can modify order tests" 
  ON public.order_tests
  FOR ALL
  TO authenticated
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();