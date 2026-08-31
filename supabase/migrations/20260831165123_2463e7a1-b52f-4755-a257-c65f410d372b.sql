
-- profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  name TEXT,
  profession TEXT,
  industry TEXT,
  company TEXT,
  expertise TEXT,
  preferred_tone TEXT,
  writing_style TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own_all" ON public.profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- products
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_read_active" ON public.products FOR SELECT TO authenticated USING (active);

-- product_versions
CREATE TABLE public.product_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  prompt TEXT NOT NULL,
  input_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, version)
);
CREATE INDEX product_versions_product_active_idx ON public.product_versions (product_id, active);
GRANT SELECT ON public.product_versions TO authenticated;
GRANT ALL ON public.product_versions TO service_role;
ALTER TABLE public.product_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_versions_read_active" ON public.product_versions FOR SELECT TO authenticated USING (active);

-- generations
CREATE TABLE public.generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_version_id UUID REFERENCES public.product_versions(id) ON DELETE SET NULL,
  input_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_data JSONB,
  status TEXT NOT NULL DEFAULT 'success',
  error_code TEXT,
  model TEXT,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX generations_user_created_idx ON public.generations (user_id, created_at DESC);
GRANT SELECT, INSERT ON public.generations TO authenticated;
GRANT ALL ON public.generations TO service_role;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "generations_select_own" ON public.generations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "generations_insert_own" ON public.generations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- seed products
INSERT INTO public.products (slug, name, description, category) VALUES
  ('linkedin_post', 'LinkedIn Post', 'Turn your ideas into natural, professional LinkedIn posts.', 'linkedin'),
  ('cold_email', 'Cold Email', 'Create concise and personalized cold emails.', 'email'),
  ('corporate_dm', 'Professional DM', 'Turn your thoughts into polished professional messages.', 'message');

INSERT INTO public.product_versions (product_id, version, prompt, input_schema, output_schema)
SELECT id, '1.0',
'PRODUCT: LinkedIn Post

Write one LinkedIn post based only on the information the user provided.

Rules:
- Focus on one primary idea, taken from the Topic (and Main Point if given).
- Open with a natural, concrete first line. No clickbait, no "Stop scrolling", no rhetorical hooks.
- Develop the idea with reasoning and specifics from the user input.
- If the user gave only an idea and no personal story, argue the idea directly. Never invent an experience, project, metric, client, or timeline.
- Keep a credible professional voice. No corporate jargon, no motivational filler, no fake enthusiasm.
- At most one emoji, and only if the tone clearly calls for it. At most 3 hashtags, and only if they are genuinely relevant. Usually zero of both.
- Length: roughly 100-250 words. Short paragraphs, no heavy formatting or bullet spam.
- Preserve the user opinion and stance exactly.',
  '{"fields":[
    {"name":"topic","label":"Topic","type":"textarea","required":true,"placeholder":"What do you want to talk about?"},
    {"name":"main_point","label":"Main Point","type":"textarea","required":false},
    {"name":"audience","label":"Target Audience","type":"text","required":false},
    {"name":"tone","label":"Tone","type":"select","required":false,"options":["Professional","Conversational","Thoughtful","Bold"]},
    {"name":"context","label":"Additional Context","type":"textarea","required":false}
  ]}'::jsonb,
  '{"fields":["content"]}'::jsonb
FROM public.products WHERE slug = 'linkedin_post';

INSERT INTO public.product_versions (product_id, version, prompt, input_schema, output_schema)
SELECT id, '1.0',
'PRODUCT: Cold Email

Write one short cold email plus a subject line, using only the information the user provided.

Rules:
- Be concise: 70-150 words in the body.
- State clearly and early why you are contacting this person, based on the user input.
- Communicate the offer or message plainly, then a single reasonable call to action tied to the desired outcome.
- Never invent the recipient name, company, role, achievements, statistics, mutual connections, past interactions, or customer results. If a detail is missing, write around it naturally instead of guessing.
- No generic compliments ("I love what you are doing"), no fake personalization, no aggressive sales language, no unnecessary background.
- Subject line: 3-8 words, specific, no hype, no clickbait, no emoji.
- Plain text only. Do not add a signature block with invented details; end with a simple sign-off.',
  '{"fields":[
    {"name":"recipient","label":"Who are you contacting?","type":"text","required":false},
    {"name":"offer","label":"What do you want to say or offer?","type":"textarea","required":true},
    {"name":"reason","label":"Why are you contacting them?","type":"textarea","required":false},
    {"name":"outcome","label":"Desired outcome","type":"text","required":false},
    {"name":"tone","label":"Tone","type":"select","required":false,"options":["Professional","Friendly","Direct"]}
  ]}'::jsonb,
  '{"fields":["subject","content"]}'::jsonb
FROM public.products WHERE slug = 'cold_email';

INSERT INTO public.product_versions (product_id, version, prompt, input_schema, output_schema)
SELECT id, '1.0',
'PRODUCT: Professional DM

Rewrite the user message so it reads as a polished professional direct message.

Rules:
- Preserve the user intended meaning, stance, requests, and any specifics exactly.
- Improve grammar, clarity, structure, and professionalism. Do not change what is being said.
- Keep it short: usually 2-5 sentences. Never longer than the point requires.
- Adapt politeness to the recipient type when provided, without stiff or archaic formality.
- Never add information, context, compliments, achievements, or reasons the user did not provide.
- No emoji unless the user used them. No filler openers or closers beyond a natural greeting and sign-off.
- Output the message itself only, ready to paste.',
  '{"fields":[
    {"name":"message","label":"What do you want to say?","type":"textarea","required":true,"placeholder":"Write it however it comes out. We will make it professional."},
    {"name":"recipient_type","label":"Who are you sending it to?","type":"select","required":false,"options":["Recruiter","Manager","Client","Founder","Colleague","Other"]},
    {"name":"tone","label":"Tone","type":"select","required":false,"options":["Professional","Friendly","Formal","Concise"]}
  ]}'::jsonb,
  '{"fields":["content"]}'::jsonb
FROM public.products WHERE slug = 'corporate_dm';
