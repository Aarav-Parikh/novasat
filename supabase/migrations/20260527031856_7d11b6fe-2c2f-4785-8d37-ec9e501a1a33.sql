
INSERT INTO storage.buckets (id, name, public)
VALUES ('pet-renders', 'pet-renders', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Public can read pet renders"
ON storage.objects FOR SELECT
USING (bucket_id = 'pet-renders');
