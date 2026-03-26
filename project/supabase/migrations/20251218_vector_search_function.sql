-- SQL function for vector similarity search
-- Enables AI-powered placeholder suggestions via semantic search
-- Using Google Gemini text-embedding-004 (768 dimensions)

-- First, update the embedding column in test_catalog_embeddings table
ALTER TABLE test_catalog_embeddings 
ALTER COLUMN embedding TYPE VECTOR(768);

CREATE OR REPLACE FUNCTION match_placeholders(
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5,
  filter_lab_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  placeholder_name TEXT,
  placeholder_type TEXT,
  display_name TEXT,
  description TEXT,
  unit TEXT,
  reference_range TEXT,
  example_value TEXT,
  category TEXT,
  test_group_name TEXT,
  analyte_code TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tce.id,
    tce.placeholder_name,
    tce.placeholder_type,
    tce.display_name,
    tce.description,
    tce.unit,
    tce.reference_range,
    tce.example_value,
    tce.category,
    tce.test_group_name,
    tce.analyte_code,
    1 - (tce.embedding <=> query_embedding) AS similarity
  FROM test_catalog_embeddings tce
  WHERE 
    (filter_lab_id IS NULL OR tce.lab_id = filter_lab_id)
    AND 1 - (tce.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_placeholders IS 'Vector similarity search for AI-powered placeholder suggestions. Returns top N matches above threshold for a given query embedding.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION match_placeholders TO authenticated;
GRANT EXECUTE ON FUNCTION match_placeholders TO service_role;
GRANT EXECUTE ON FUNCTION match_placeholders TO anon;
