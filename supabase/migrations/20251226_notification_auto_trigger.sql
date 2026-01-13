-- Migration: Add lab_notification_settings and notification_queue tables
-- Run this in Supabase SQL Editor

-- 1. Lab Notification Settings Table
CREATE TABLE IF NOT EXISTS public.lab_notification_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL UNIQUE,
  
  -- Report Auto-Send Settings
  auto_send_report_to_patient boolean DEFAULT false,
  auto_send_report_to_doctor boolean DEFAULT false,
  send_report_on_status text DEFAULT 'Completed' CHECK (send_report_on_status = ANY (ARRAY['Approved'::text, 'Completed'::text, 'Delivered'::text])),
  
  -- Invoice Auto-Send Settings  
  auto_send_invoice_to_patient boolean DEFAULT false,
  
  -- Registration Auto-Send Settings
  auto_send_registration_confirmation boolean DEFAULT false,
  include_test_details_in_registration boolean DEFAULT true,
  include_invoice_in_registration boolean DEFAULT true,
  
  -- Delivery Method Preferences
  default_patient_channel text DEFAULT 'whatsapp' CHECK (default_patient_channel = ANY (ARRAY['whatsapp'::text, 'email'::text, 'both'::text])),
  
  -- Time Window (Don't send at odd hours)
  send_window_start time DEFAULT '08:00:00',
  send_window_end time DEFAULT '21:00:00',
  queue_outside_window boolean DEFAULT true,
  
  -- Rate Limiting
  max_messages_per_patient_per_day integer DEFAULT 10,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT lab_notification_settings_pkey PRIMARY KEY (id),
  CONSTRAINT lab_notification_settings_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES public.labs(id) ON DELETE CASCADE
);

-- 2. Notification Queue Table
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL,
  
  -- Message Details
  recipient_type text NOT NULL CHECK (recipient_type = ANY (ARRAY['patient'::text, 'doctor'::text])),
  recipient_phone text NOT NULL,
  recipient_name text,
  recipient_id uuid,
  
  -- Trigger Context
  trigger_type text NOT NULL CHECK (trigger_type = ANY (ARRAY['report_ready'::text, 'invoice_generated'::text, 'order_registered'::text, 'payment_reminder'::text])),
  order_id uuid,
  report_id uuid,
  invoice_id uuid,
  
  -- Message Content
  template_id uuid,
  message_content text,
  attachment_url text,
  attachment_type text,
  
  -- Status Tracking
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending'::text, 'scheduled'::text, 'sending'::text, 'sent'::text, 'failed'::text, 'skipped'::text])),
  scheduled_for timestamp with time zone DEFAULT now(),
  sent_at timestamp with time zone,
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  last_error text,
  
  -- WhatsApp API Response
  whatsapp_message_id text,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT notification_queue_pkey PRIMARY KEY (id),
  CONSTRAINT notification_queue_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES public.labs(id) ON DELETE CASCADE,
  CONSTRAINT notification_queue_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL,
  CONSTRAINT notification_queue_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE SET NULL,
  CONSTRAINT notification_queue_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL,
  CONSTRAINT notification_queue_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.whatsapp_message_templates(id) ON DELETE SET NULL
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON public.notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_lab_id ON public.notification_queue(lab_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled_for ON public.notification_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notification_queue_trigger_type ON public.notification_queue(trigger_type);

-- 4. Enable RLS
ALTER TABLE public.lab_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for lab_notification_settings
CREATE POLICY "Users can view their lab's notification settings"
  ON public.lab_notification_settings
  FOR SELECT
  USING (lab_id IN (SELECT lab_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update their lab's notification settings"
  ON public.lab_notification_settings
  FOR UPDATE
  USING (lab_id IN (SELECT lab_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert their lab's notification settings"
  ON public.lab_notification_settings
  FOR INSERT
  WITH CHECK (lab_id IN (SELECT lab_id FROM public.users WHERE id = auth.uid()));

-- 6. RLS Policies for notification_queue
CREATE POLICY "Users can view their lab's notification queue"
  ON public.notification_queue
  FOR SELECT
  USING (lab_id IN (SELECT lab_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert into their lab's notification queue"
  ON public.notification_queue
  FOR INSERT
  WITH CHECK (lab_id IN (SELECT lab_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update their lab's notification queue"
  ON public.notification_queue
  FOR UPDATE
  USING (lab_id IN (SELECT lab_id FROM public.users WHERE id = auth.uid()));

-- 7. Grant permissions
GRANT ALL ON public.lab_notification_settings TO authenticated;
GRANT ALL ON public.notification_queue TO authenticated;
