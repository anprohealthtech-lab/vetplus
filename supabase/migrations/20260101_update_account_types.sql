-- Migration to update account type check constraint
DO $$ 
BEGIN
    -- Check if constraint exists and drop it to allow flexibility or new types
    -- We can either update it or just drop it if we want to rely on frontend validation + simple text
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'accounts_type_check' 
        AND table_name = 'accounts'
    ) THEN
        ALTER TABLE public.accounts DROP CONSTRAINT accounts_type_check;
    END IF;
    
    -- Re-add with new types including 'lab_to_lab' and 'collection_center'
    -- Or just leave it unconstrained if we want future flexibility without migrations
    ALTER TABLE public.accounts 
    ADD CONSTRAINT accounts_type_check 
    CHECK (type IN ('hospital', 'corporate', 'insurer', 'clinic', 'doctor', 'lab_to_lab', 'collection_center', 'other'));
    
END $$;
