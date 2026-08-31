# Content Muse

Build V1 — AI Content Creation SaaS

Build a complete, working full-stack V1 web application for an AI content creation SaaS.

The goal is to create a simple, reliable, maintainable and extensible AI content-generation platform.

The application should allow users to select a content product, provide simple inputs, generate high-quality content using the Gemini API, and copy or regenerate the result.

This is V1.

Do not over-engineer it. Do not build unnecessary features.

The most important goals are:

Excellent generated content.

Simple user experience.

Clean and reusable architecture.

Easy debugging.

Easy addition of future products.

Secure Gemini API integration.

Reliable operation for approximately 1,000 registered users.

The application must be fully testable from the Lovable preview/development environment.

1. TECHNOLOGY STACK

Use:

Lovable for application development

React/TypeScript for the frontend

Supabase for authentication

Supabase PostgreSQL for the database

Supabase Edge Functions for server-side Gemini API calls

Gemini API as the initial AI provider

Do NOT build a separate traditional backend server unless technically necessary.

Use Supabase Edge Functions for protected server-side AI operations.

The Gemini API key must NEVER be exposed to the browser.

Store the Gemini API key as a secure server-side secret/environment variable.

2. CORE USER FLOW

The primary user flow should be:

Landing Page
    ↓
Sign Up / Login
    ↓
Dashboard
    ↓
Choose Product
    ↓
Fill Simple Input Form
    ↓
Generate
    ↓
Loading State
    ↓
Generated Result
    ↓
Copy / Regenerate


Keep this flow extremely simple.

Do not add unnecessary steps.

3. V1 PRODUCTS

Build only these three products.

PRODUCT 1 — LinkedIn Post

Purpose:

Turn a user's idea into a natural, useful and professional LinkedIn post.

Inputs:

Topic

Required textarea.

Example:

"I want to talk about why understanding fundamentals is still important when using AI coding tools."

Main Point

Optional textarea.

Target Audience

Optional text.

Tone

Optional select:

Professional

Conversational

Thoughtful

Bold

Additional Context

Optional textarea.

Button:

Generate Post

Output:

{
  "content": "generated LinkedIn post"
}


Display the generated post in a clean result card.

Actions:

Copy

Regenerate

Do not add many additional transformation buttons in V1.

4. PRODUCT 2 — COLD EMAIL

Purpose:

Help users write concise, professional cold emails.

Inputs:

Who are you contacting?

Optional text.

What do you want to say or offer?

Required textarea.

Why are you contacting them?

Optional textarea.

Desired outcome

Optional text.

Tone

Select:

Professional

Friendly

Direct

Button:

Generate Email

Output:

{
  "subject": "generated subject",
  "content": "generated email"
}


Display:

Subject

Email body

Actions:

Copy

Regenerate

The system must never fabricate:

recipient information

company information

achievements

statistics

relationships

previous interactions

customer results

personal experience

Use only information provided by the user.

5. PRODUCT 3 — PROFESSIONAL CORPORATE DM

Purpose:

Allow users to write their thoughts naturally and convert them into a polished professional corporate message.

Position this product clearly:

"Write what you want to say. We'll make it professional."

Inputs:

What do you want to say?

Required textarea.

Who are you sending it to?

Optional select:

Recruiter

Manager

Client

Founder

Colleague

Other

Tone

Select:

Professional

Friendly

Formal

Concise

Button:

Make It Professional

Output:

{
  "content": "generated professional DM"
}


Actions:

Copy

Regenerate

The generated message must preserve the user's original meaning.

Do not add information the user did not provide.

6. USER PROFILE

Create a simple optional user profile.

Fields:

Name

Profession / Role

Industry

Company

Expertise

Preferred Tone

Writing Style

Users should NOT be required to complete the profile before using the products.

The profile is additional context for generation.

The AI must not assume that profile information means the user has experienced something personally.

For example:

If the profile says:

"Software Engineer"

the AI may understand that the user is a software engineer.

It must NOT invent:

"I spent five years building distributed systems..."

unless the user actually provided that information.

7. DATABASE

Use Supabase PostgreSQL.

Keep the database simple.

Initial tables:

profiles

Fields conceptually:

id
user_id
name
profession
industry
company
expertise
preferred_tone
writing_style
created_at
updated_at


products

id
slug
name
description
category
active
created_at
updated_at


product_versions

id
product_id
version
prompt
input_schema
output_schema
active
created_at


generations

id
user_id
product_id
product_version_id
input_data
output_data
status
model
created_at


Use appropriate PostgreSQL types.

JSON/JSONB can be used for flexible product inputs and outputs.

Do NOT create separate tables such as:

linkedin_posts
cold_emails
corporate_dms


Use the generic generation model.

8. SUPABASE AUTH

Use Supabase Auth.

Support:

Sign up

Login

Logout

Session persistence

Password reset if straightforward

Protect authenticated application routes.

Users must only be able to access their own:

profile

generations

Implement appropriate Supabase Row Level Security policies.

Never trust a user_id supplied by the frontend.

Determine the authenticated user from the Supabase session/token.

9. PRODUCT ARCHITECTURE

This is extremely important.

Products must be designed so that future products can be added without rewriting the generation engine.

Do NOT create separate generation logic such as:

generateLinkedInPost()
generateColdEmail()
generateCorporateDM()


Instead create one reusable generation pipeline.

Conceptually:

generateContent(productId, inputs)


Pipeline:

Authenticate User
       ↓
Load Product
       ↓
Load Active Product Version
       ↓
Validate Inputs
       ↓
Load User Profile
       ↓
Build Prompt
       ↓
Call AI Provider
       ↓
Validate Structured Output
       ↓
Save Generation
       ↓
Return Result


10. PRODUCT CONFIGURATION

Make products configuration-driven wherever practical.

A product definition should conceptually contain:

{
  "slug": "linkedin_post",
  "name": "LinkedIn Post",
  "description": "Create a professional LinkedIn post.",
  "category": "linkedin",
  "active": true
}


Each product should define its input fields/schema.

The frontend should use a reusable dynamic form component where practical.

Do not create an entirely custom form architecture for every product.

11. FUTURE PRODUCT REQUIREMENT

The architecture should make it easy to add a future product such as:

Instagram Caption


or:

Professional Follow-up Email


without changing the core generation service.

Ideally adding a new product requires:

Product definition
+
Input schema
+
Prompt
+
Output schema


The existing:

authentication

product page

dynamic form

generation API

Gemini provider

generation history

result component

should continue to work.

Do NOT implement these future products now.

12. PROMPT ARCHITECTURE

Prompts are the core intellectual property of the application.

Do NOT put production prompts inside React components.

Do NOT scatter prompts across frontend and backend files.

Keep prompts in a dedicated and maintainable product/prompt structure.

Conceptually:

prompts/
    shared/
        global_rules
        writing_rules
        factuality_rules

    products/
        linkedin_post/
            prompt
            output_schema

        cold_email/
            prompt
            output_schema

        corporate_dm/
            prompt
            output_schema


Adapt the exact storage mechanism to the Lovable/Supabase implementation.

13. PROMPT COMPOSITION

Every prompt should conceptually be composed from:

GLOBAL RULES

PRODUCT-SPECIFIC RULES

USER PROFILE

CURRENT USER INPUT

QUALITY REQUIREMENTS

OUTPUT FORMAT


Use reusable prompt-building logic.

Do not duplicate common instructions unnecessarily.

14. GLOBAL AI WRITING RULES

The AI must:

Use the user's provided information as the source of truth.

Preserve the user's intended meaning.

Never invent facts.

Never invent personal experiences.

Never invent achievements.

Never invent statistics.

Never invent company information.

Never invent recipient information.

Never fabricate relationships or previous interactions.

Avoid generic filler.

Avoid unnecessary verbosity.

Avoid clichés.

Avoid exaggerated claims.

Avoid fake enthusiasm.

Avoid excessive emojis.

Avoid unnecessary hashtags.

Avoid repetitive sentence structures.

Prefer specific information over generic statements.

Produce natural human language.

Produce useful, publication-ready content.

The AI should not simply make text grammatically correct.

It should make the content genuinely useful while preserving the user's intent.

15. ANTI-AI WRITING RULES

Avoid obvious AI-generated patterns and generic phrases such as:

"In today's fast-paced world"

"In the ever-evolving landscape"

"It's important to note"

"At the end of the day"

"Unlock your potential"

"Embrace the journey"

"Stop scrolling"

"You won't believe"

"Here's the thing"

generic motivational statements

artificial engagement bait

forced storytelling

Do not mechanically remove every phrase from the blacklist if the phrase is genuinely appropriate.

The actual objective is:

Natural, specific, human-sounding writing.

Prefer details supplied by the user.

16. LINKEDIN PROMPT REQUIREMENTS

The LinkedIn prompt should:

Focus on one primary idea.

Create a natural opening.

Use specific information from the user's input.

Avoid clickbait.

Avoid fake personal stories.

Avoid generic motivational language.

Avoid excessive formatting.

Avoid excessive emojis.

Avoid unnecessary hashtags.

Avoid corporate jargon.

Maintain a credible professional voice.

Preserve the user's opinions.

Do not invent experiences.

If the user provides only an idea, develop the idea without pretending that the user personally experienced something.

17. COLD EMAIL PROMPT REQUIREMENTS

The cold email prompt should:

Be concise.

Clearly explain why the recipient is being contacted.

Clearly communicate the purpose/value.

Produce a natural subject line.

Avoid excessive sales language.

Avoid fake personalization.

Avoid generic compliments.

Avoid invented facts.

Avoid unnecessary background.

Include a reasonable call to action.

If information is missing, write naturally without fabricating it.

18. CORPORATE DM PROMPT REQUIREMENTS

The DM prompt should:

Preserve the user's intended meaning.

Improve grammar.

Improve clarity.

Improve professionalism.

Keep the message concise.

Avoid unnecessary formal language.

Avoid changing the user's intention.

Avoid inventing information.

The final result should feel like:

the user's own message, just clearer and more professional.

19. GEMINI SERVICE

Create a reusable AI provider abstraction.

Conceptually:

AIProvider
    generate()


Implement:

GeminiProvider


Only Gemini is required for V1.

The rest of the application must not directly depend on Gemini-specific implementation details.

This allows another provider to be added later without rewriting the product engine.

20. GEMINI API SECURITY

The Gemini API key must only exist server-side.

Use a Supabase Edge Function for Gemini calls.

Architecture:

Browser
   ↓
Authenticated request
   ↓
Supabase Edge Function
   ↓
Gemini API


Never:

Browser
   ↓
Gemini API


Do not put the Gemini key in frontend code.

Do not expose the key in browser network requests.

Do not commit secrets to the repository.

21. STRUCTURED AI OUTPUT

Use structured JSON responses.

The backend must validate Gemini's response before returning it to the frontend.

LinkedIn:

{
  "content": "string"
}


Cold Email:

{
  "subject": "string",
  "content": "string"
}


Corporate DM:

{
  "content": "string"
}


If Gemini returns invalid JSON or invalid structure:

Log the technical error.

Retry once if appropriate.

If still invalid, return a safe user-facing error.

Never display broken/raw malformed AI output.

22. GENERATION HISTORY

Save every successful generation.

Do not overwrite previous generations when the user clicks Regenerate.

Each generation must have a unique ID.

History should show:

Product

Short preview

Date/time

Users can click a history item to view the result.

Users must only see their own history.

Keep history functionality simple in V1.

23. REGENERATE

Implement a simple Regenerate button.

When clicked:

Use the same original inputs.

Use the current active prompt version.

Generate another result.

Save it as a new generation.

Do not overwrite the previous generation.

24. COPY

Copy is a frontend operation.

It should not call Gemini.

LinkedIn:

Copy only the post.

Cold Email:

Copy subject + body in a clean format.

Corporate DM:

Copy only the message.

Show a small confirmation such as:

"Copied"

25. LOADING EXPERIENCE

While Gemini is generating:

Disable Generate button.

Show a clear loading indicator.

Prevent accidental duplicate submissions.

Display a useful message such as:
"Creating your content..."

Do not make the user think the application has frozen.

26. ERROR HANDLING

Create centralized error handling.

Internal error categories can include:

INVALID_INPUT
UNAUTHORIZED
PRODUCT_NOT_FOUND
AI_PROVIDER_ERROR
AI_TIMEOUT
INVALID_AI_RESPONSE
OUTPUT_VALIDATION_ERROR
RATE_LIMITED
INTERNAL_ERROR


Users should receive simple messages.

Example:

"Unable to generate content right now. Please try again."

Do not expose stack traces, API keys or internal implementation details.

27. RATE LIMITING

Implement basic protection against excessive generation requests.

Prevent a single user from sending unlimited requests.

Make the limit configurable.

Do not build a sophisticated abuse-prevention platform in V1.

28. OBSERVABILITY / DEBUGGING

Easy debugging is a major requirement.

Every generation should have a unique generation ID.

Store/log useful information such as:

generation_id
user_id
product_id
product_version
model
status
created_at
latency


If token usage is available from Gemini, record it where practical.

Do not unnecessarily log sensitive user content.

When a generation fails, the developer should be able to determine which stage failed:

Authentication
Input validation
Product loading
Prompt building
Gemini request
Gemini response
Output validation
Database save


Use structured logging.

29. PROMPT VERSIONING

Prompts must be versioned.

Example:

linkedin_post v1.0
cold_email v1.0
corporate_dm v1.0


When a prompt is improved:

linkedin_post v1.1


Do not silently modify historical prompt versions.

Save the prompt version with each generation.

This is important because prompt quality will be continuously improved based on user feedback.

30. BASIC SECURITY

Follow secure application practices.

Requirements:

Supabase Auth

RLS

Server-side Gemini API key

Protected Edge Functions

Input validation

Authorization checks

User-owned data isolation

Rate limiting

No secrets in frontend

No secrets committed to source control

No stack traces exposed to users

31. UI DESIGN

Create a clean, modern and professional SaaS interface.

Avoid:

excessive gradients

excessive animations

glowing AI effects

complicated dashboards

unnecessary charts

visual clutter

Use:

clean whitespace

readable typography

simple cards

subtle borders

clear buttons

professional visual hierarchy

The generated content should be the main focus.

The application should feel like a useful professional tool rather than an AI demo.

32. LANDING PAGE

Hero:

Create professional content in seconds.

Supporting text:

Turn your ideas into polished LinkedIn posts, cold emails and professional messages.

CTA:

Start Creating

Show three product cards:

LinkedIn Post

Turn your ideas into natural, professional LinkedIn posts.

Cold Email

Create concise and personalized cold emails.

Professional DM

Turn your thoughts into polished professional messages.

Do not make unsupported claims about engagement, revenue or guaranteed results.

33. DASHBOARD

After login:

Show the three products prominently.

Navigation should be minimal:

Create

History

Profile

Do not build an unnecessarily complex dashboard.

34. RESPONSIVE DESIGN

The application must work properly on:

Desktop

Tablet

Mobile

The content input and generated result must remain easy to read and interact with.

35. PERFORMANCE

For V1:

Avoid unnecessary frontend requests.

Prevent duplicate generation submissions.

Keep API payloads reasonable.

Use database indexes where appropriate.

Keep Edge Functions stateless.

Do not introduce unnecessary background queues.

The application should be capable of growing to approximately 1,000 registered users without architectural redesign.

Do not optimize prematurely for millions of users.

36. TESTING

Create a meaningful test structure.

Test:

Authentication

Signup

Login

Logout

Protected routes

Authorization

User can access own generations.

User cannot access another user's generations.

Product system

Products load.

Inactive products cannot be generated.

Input validation

Required fields are enforced.

Invalid values are rejected.

Prompt builder

Inputs are correctly inserted.

Profile information is correctly included.

No missing variables.

Generation

Mock the Gemini provider for automated tests.

Test:

Successful generation

Gemini failure

Timeout

Invalid JSON

Invalid output schema

History

Generation saved.

Regeneration creates a separate record.

Do not rely entirely on live Gemini API calls for automated tests.

37. DEVELOPMENT / CODE QUALITY

Write clean TypeScript.

Use meaningful names.

Avoid giant components.

Separate:

UI

product configuration

API calls

business logic

prompt building

AI provider

database operations

Do not duplicate code unnecessarily.

Do not introduce unnecessary design patterns.

Favor simple, understandable code.

The application should be maintainable by one developer.

38. IMPORTANT — DO NOT OVERBUILD

For V1, DO NOT implement:

Payments

Subscription billing

Complex credit system

Direct LinkedIn publishing

Instagram publishing

X publishing

Facebook publishing

Teams

Collaboration

Advanced analytics

AI model selection

Multiple AI providers

Prompt marketplace

Affiliate system

Referral system

Admin analytics dashboard

Advanced AI evaluation pipeline

Complex queues/workers

Microservices

Mobile application

These may be added later based on actual user feedback.

39. V1 RESULT

At the end of this implementation, I should have a working application where I can:

Open the website.

Create an account.

Log in.

Choose LinkedIn Post, Cold Email or Professional DM.

Fill in simple inputs.

Click Generate.

Send the request securely through Supabase to Gemini.

Receive structured output.

See the result in the UI.

Copy it.

Regenerate it.

See previous generations in History.

Update my profile.

Log out.

The application should be fully usable from the Lovable preview.

40. MOST IMPORTANT ARCHITECTURAL REQUIREMENT

The application should be designed around this abstraction:

PRODUCT
   ↓
INPUT SCHEMA
   ↓
PROMPT
   ↓
OUTPUT SCHEMA
   ↓
GENERATION ENGINE


The generation engine is shared.

The AI provider is shared.

Authentication is shared.

Database infrastructure is shared.

UI components are shared.

Only product-specific configuration and prompt/workflow logic should differ.

The purpose is that after V1 I can add a new product without rewriting the application.

41. IMPLEMENTATION APPROACH

Build incrementally.

First establish:

Project structure

Supabase connection

Authentication

Database schema

Product architecture

Generic generation service

Gemini Edge Function

LinkedIn Post

Cold Email

Corporate DM

History

Error handling

Testing

After each major stage, ensure the application still runs correctly.

Do not generate a huge amount of unrelated code at once.

Prioritize a working, testable V1 over feature count.

FINAL INSTRUCTION

Build this as a real working application, not a static mockup.

All three products must actually generate content through the Gemini API.

Supabase Auth must actually work.

Database persistence must actually work.

Generation history must actually work.

The Gemini API key must remain server-side.

The application must be testable directly through the Lovable preview.

Keep the architecture clean enough that I can later open the code in GitHub/VS Code and understand, debug and extend it myself.

When a design choice is not explicitly specified, prefer:

simple + secure + maintainable + reusable

over:

complex + clever + feature-heavy.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a9399128-85cc-4e13-8e0d-8a9416f001b4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
