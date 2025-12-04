-- Migration: Add FCM (Firebase Cloud Messaging) token storage for push notifications
-- Date: 2025-01-20
-- Purpose: Store device FCM tokens for users to enable push notifications on Android app

-- Create user_fcm_tokens table
CREATE TABLE IF NOT EXISTS public.user_fcm_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
    fcm_token TEXT NOT NULL,
    device_id TEXT, -- Optional device identifier for multi-device support
    device_info JSONB DEFAULT '{}'::jsonb, -- Store device details (model, OS version, app version)
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint: one token per user per device
    CONSTRAINT unique_user_fcm_token UNIQUE (user_id, fcm_token)
);

-- Create notification_logs table for tracking sent notifications
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Target user (null for broadcast)
    notification_type TEXT NOT NULL, -- 'order_completed', 'result_ready', 'payment_due', 'system_alert', etc.
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb, -- Custom data payload
    fcm_token TEXT, -- Token used for delivery (null for topic)
    topic TEXT, -- Topic name if sent to topic
    message_id TEXT, -- FCM response message ID
    delivery_status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
    error_message TEXT, -- Error details if failed
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE,
    
    -- Reference to related entity
    related_table TEXT, -- 'orders', 'results', 'invoices', 'patients', etc.
    related_id UUID -- ID of the related record
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_user_id ON public.user_fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_lab_id ON public.user_fcm_tokens(lab_id);
CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_token ON public.user_fcm_tokens(fcm_token);
CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_active ON public.user_fcm_tokens(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_notification_logs_lab_id ON public.notification_logs(lab_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON public.notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON public.notification_logs(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON public.notification_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_related ON public.notification_logs(related_table, related_id);

-- Enable Row Level Security
ALTER TABLE public.user_fcm_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_fcm_tokens
-- Users can only see/manage their own tokens
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view own FCM tokens" ON public.user_fcm_tokens;
    CREATE POLICY "Users can view own FCM tokens" ON public.user_fcm_tokens
        FOR SELECT
        USING (
            user_id = auth.uid() OR
            lab_id IN (SELECT lab_id FROM public.users WHERE id = auth.uid())
        );
        
    DROP POLICY IF EXISTS "Users can insert own FCM tokens" ON public.user_fcm_tokens;
    CREATE POLICY "Users can insert own FCM tokens" ON public.user_fcm_tokens
        FOR INSERT
        WITH CHECK (user_id = auth.uid());
        
    DROP POLICY IF EXISTS "Users can update own FCM tokens" ON public.user_fcm_tokens;
    CREATE POLICY "Users can update own FCM tokens" ON public.user_fcm_tokens
        FOR UPDATE
        USING (user_id = auth.uid());
        
    DROP POLICY IF EXISTS "Users can delete own FCM tokens" ON public.user_fcm_tokens;
    CREATE POLICY "Users can delete own FCM tokens" ON public.user_fcm_tokens
        FOR DELETE
        USING (user_id = auth.uid());
END $$;

-- RLS Policies for notification_logs
-- Lab admins can see all logs for their lab
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view notification logs for own lab" ON public.notification_logs;
    CREATE POLICY "Users can view notification logs for own lab" ON public.notification_logs
        FOR SELECT
        USING (
            lab_id IN (SELECT lab_id FROM public.users WHERE id = auth.uid())
        );
        
    -- Service role can insert (for backend notification sending)
    DROP POLICY IF EXISTS "Service can insert notification logs" ON public.notification_logs;
    CREATE POLICY "Service can insert notification logs" ON public.notification_logs
        FOR INSERT
        WITH CHECK (true);
END $$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_fcm_token_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating timestamp
DROP TRIGGER IF EXISTS trigger_update_fcm_token_timestamp ON public.user_fcm_tokens;
CREATE TRIGGER trigger_update_fcm_token_timestamp
    BEFORE UPDATE ON public.user_fcm_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_fcm_token_timestamp();

-- Function to clean up old/invalid tokens (call periodically)
CREATE OR REPLACE FUNCTION cleanup_inactive_fcm_tokens(days_inactive INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.user_fcm_tokens
    WHERE is_active = false
       OR last_used_at < NOW() - (days_inactive || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON TABLE public.user_fcm_tokens IS 'Stores Firebase Cloud Messaging tokens for each user device';
COMMENT ON TABLE public.notification_logs IS 'Logs of all push notifications sent through the system';
COMMENT ON COLUMN public.user_fcm_tokens.device_info IS 'JSON object containing device details like model, OS, app version';
COMMENT ON COLUMN public.notification_logs.notification_type IS 'Type of notification: order_completed, result_ready, payment_due, system_alert, etc.';
COMMENT ON FUNCTION cleanup_inactive_fcm_tokens IS 'Removes FCM tokens that are inactive or not used for specified days';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_fcm_tokens TO authenticated;
GRANT SELECT, INSERT ON public.notification_logs TO authenticated;
GRANT ALL ON public.user_fcm_tokens TO service_role;
GRANT ALL ON public.notification_logs TO service_role;
