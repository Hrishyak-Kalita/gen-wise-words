UPDATE public.product_versions SET active = false WHERE version = '1.0';

INSERT INTO public.product_versions (product_id, version, prompt, input_schema, output_schema)
SELECT id, '1.1',
'PRODUCT: LinkedIn Post

Write one LinkedIn post built primarily on the user''s own idea, experience, observation or opinion in this request.

Rules:
- One primary idea, taken from the Topic (and Main Point if given). Do not introduce unrelated concepts.
- Open with the genuinely interesting part of the user''s idea, stated plainly. No clickbait, no rhetorical hook, no "Stop scrolling".
- Only write in the first person about experiences the user explicitly provided. If they gave an idea with no story, argue the idea directly.
- Preserve the user''s opinion and stance exactly; never substitute a more generic or safer opinion.
- General examples and general reasoning are allowed when useful, but never presented as the user''s own experience, client, metric or result.
- Length follows the amount of information given: sparse input, roughly 80-150 words; normal input, roughly 120-250 words. No fixed word count. A shorter post beats filler.
- Professional but conversational. Not an academic paper, not corporate PR, not a motivational speech, not an AI essay.
- Simple LinkedIn-friendly paragraphs. No hashtags or emoji unless the user asked for them or they are clearly appropriate. No engagement bait.
- Do not force a closing question or call to action; add one only if it fits naturally.',
  '{"fields":[
    {"name":"topic","label":"Topic","type":"textarea","required":true,"placeholder":"What do you want to talk about?","maxLength":5000},
    {"name":"main_point","label":"Main Point","type":"textarea","required":false,"maxLength":3000},
    {"name":"audience","label":"Target Audience","type":"text","required":false,"maxLength":300},
    {"name":"tone","label":"Tone","type":"select","required":false,"options":["Professional","Conversational","Thoughtful","Bold"]},
    {"name":"context","label":"Additional Context","type":"textarea","required":false,"maxLength":5000}
  ]}'::jsonb,
  '{"fields":["content"]}'::jsonb
FROM public.products WHERE slug = 'linkedin_post';

INSERT INTO public.product_versions (product_id, version, prompt, input_schema, output_schema)
SELECT id, '1.1',
'PRODUCT: Cold Email

Write one concise, relevant, personalized cold email plus a subject line. The email must answer: why am I contacting this person, what am I offering, why is it relevant, and what do I want them to do.

PERSONALIZATION PRIORITY (use in this order, highest first):
1. Specific recipient/company information the user supplied
2. The specific problem or observation the user supplied
3. The specific reason for contacting
4. The user''s actual offer
5. The desired outcome
6. General domain context
7. Generic wording (last resort only)

Rules:
- If the user supplied a specific observation or problem, it must appear meaningfully — usually early, in the user''s own terms. Example: "their website loads slowly on mobile" belongs in the email; a generic "I''m reaching out to offer website development services" instead of it is a failure.
- No fake personalization. Never write "I''ve been following your company", "I was impressed by your growth", "I love what your company is doing" unless the user provided those facts.
- Conciseness: default roughly 80-140 words in the body. For a Direct or Concise tone, prefer roughly 60-110 words when the information supports it. Never add a paragraph just to look complete; every sentence must serve the purpose of the email.
- Value proposition: claim only capabilities, results or experience the user supplied. Never invent clients, results, statistics, credentials, case studies, guarantees or product capabilities.
- Never invent the recipient name, company, role, achievements, mutual connections or past interactions. Write around a missing detail.
- Call to action: use the user''s desired outcome, phrased as a low-pressure ask. No aggressive sales push.
- Subject: short and specific, reflecting the actual content — reference the user''s specific context when given. Avoid "Business Opportunity", "Service Inquiry", "Quick Question". No clickbait, no emoji.
- Tone: Professional = clear and credible. Friendly = warm but professional. Direct = get to the point immediately and cut everything optional. Never ignore the requested tone.
- Plain text, simple sign-off, no invented signature details.',
  '{"fields":[
    {"name":"recipient","label":"Who are you contacting?","type":"text","required":false,"maxLength":300},
    {"name":"offer","label":"What do you want to say or offer?","type":"textarea","required":true,"maxLength":3000},
    {"name":"reason","label":"Why are you contacting them?","type":"textarea","required":false,"maxLength":3000},
    {"name":"outcome","label":"Desired outcome","type":"text","required":false,"maxLength":500},
    {"name":"tone","label":"Tone","type":"select","required":false,"options":["Professional","Friendly","Direct"]}
  ]}'::jsonb,
  '{"fields":["subject","content"]}'::jsonb
FROM public.products WHERE slug = 'cold_email';

INSERT INTO public.product_versions (product_id, version, prompt, input_schema, output_schema)
SELECT id, '1.1',
'PRODUCT: Professional DM

Transform the user''s rough thoughts into a clearer, more professional direct message while preserving the original meaning. The result should read like the user''s own message, just clearer.

Rules:
- Preserve intent, the specific request, the user''s position, and their level of interest. A disagreement stays a disagreement. A networking note never becomes a job application.
- Improve grammar, clarity and professionalism. Do not change what is being said.
- Keep it concise: usually 2-5 sentences, never longer than the point requires. Do not make the message substantially longer than the original needs.
- Do not over-formalize. No stiff or archaic phrasing. Adapt politeness to the recipient type when given.
- Never add information, context, compliments, achievements, experience or reasons the user did not provide.
- No emoji unless the user used them. No filler openers or closers beyond a natural greeting and sign-off.
- Output only the message itself, ready to paste.

Example:
Input: "hey can u send me the details when free? wanna check it out"
Output style: "Hi, whenever you have a moment, could you please share the details? I would like to review them. Thanks!"',
  '{"fields":[
    {"name":"message","label":"What do you want to say?","type":"textarea","required":true,"placeholder":"Write it however it comes out. We will make it professional.","maxLength":5000},
    {"name":"recipient_type","label":"Who are you sending it to?","type":"select","required":false,"options":["Recruiter","Manager","Client","Founder","Colleague","Other"]},
    {"name":"tone","label":"Tone","type":"select","required":false,"options":["Professional","Friendly","Formal","Concise"]}
  ]}'::jsonb,
  '{"fields":["content"]}'::jsonb
FROM public.products WHERE slug = 'corporate_dm';