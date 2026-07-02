# Prompt Template Reference

Complete template for generating vibe coding prompts (Replit/Lovable).

## Prompt Structure Overview

```
1. BRIEF - High-level description
2. DESIGN.JSON - Complete design system
3. SECTION SPECS - Detailed section-by-section requirements
4. NOTES - Additional implementation guidance
```

---

## 1. BRIEF Section

```markdown
# [PRODUCT NAME] Landing Page

Create a premium landing page for [Product Name], a [market category with modifier].
The design should feel [2-3 adjectives matching brand personality].

## DESIGN SYSTEM REFERENCE
Use the design.json below as the definitive style guide. Key points:
- Color Palette: [summarize primary, accent, background colors]
- Typography: [font family, headline style]
- Buttons: [shape, colors, hover effects]
- Cards: [padding, shadows, corners]
- Spacing: [philosophy - generous/compact]
- Hover Effects: [describe interactions]
```

---

## 2. DESIGN.JSON Template

```json
{
  "designSystem": {
    "name": "[Product] Design System",
    "version": "1.0",
    "description": "[Overall design philosophy in one sentence]"
  },

  "designPrinciples": [
    {
      "name": "[Principle 1]",
      "description": "[How this principle manifests in the design]"
    },
    {
      "name": "[Principle 2]",
      "description": "[...]"
    }
  ],

  "colors": {
    "primary": {
      "main": "#HEXCODE",
      "light": "#HEXCODE",
      "dark": "#HEXCODE",
      "description": "[When to use this color]"
    },
    "accent": {
      "main": "#HEXCODE",
      "hover": "#HEXCODE",
      "description": "[When to use accent - CTAs, highlights]"
    },
    "background": {
      "white": "#FFFFFF",
      "cream": "#HEXCODE",
      "dark": "#HEXCODE",
      "description": "[Section background alternation pattern]"
    },
    "text": {
      "primary": "#HEXCODE",
      "secondary": "#HEXCODE",
      "muted": "#HEXCODE",
      "onDark": "#FFFFFF",
      "description": "[Text hierarchy usage]"
    },
    "ui": {
      "border": "#HEXCODE",
      "shadow": "rgba(0,0,0,0.XX)",
      "success": "#HEXCODE"
    }
  },

  "typography": {
    "fontFamily": {
      "heading": "[Font], system-ui, sans-serif",
      "body": "[Font], system-ui, sans-serif"
    },
    "headings": {
      "h1": {
        "size": "clamp(2.5rem, 5vw, 4rem)",
        "weight": "700",
        "lineHeight": "1.1",
        "letterSpacing": "-0.02em"
      },
      "h2": {
        "size": "clamp(2rem, 4vw, 3rem)",
        "weight": "600",
        "lineHeight": "1.2"
      },
      "h3": {
        "size": "1.25rem",
        "weight": "600",
        "lineHeight": "1.4"
      }
    },
    "body": {
      "large": { "size": "1.125rem", "lineHeight": "1.7" },
      "base": { "size": "1rem", "lineHeight": "1.6" },
      "small": { "size": "0.875rem", "lineHeight": "1.5" }
    }
  },

  "spacing": {
    "section": {
      "paddingY": "clamp(4rem, 10vw, 8rem)",
      "paddingX": "clamp(1.5rem, 5vw, 4rem)"
    },
    "container": { "maxWidth": "1200px" },
    "grid": { "gap": "2rem", "cardGap": "1.5rem" }
  },

  "components": {
    "buttons": {
      "primary": {
        "background": "#HEXCODE",
        "text": "#HEXCODE",
        "borderRadius": "9999px",
        "paddingX": "2rem",
        "paddingY": "1rem",
        "fontWeight": "600",
        "hoverBackground": "#HEXCODE",
        "hoverTransform": "translateY(-2px)",
        "transition": "all 0.2s ease"
      },
      "secondary": {
        "background": "transparent",
        "text": "#HEXCODE",
        "border": "2px solid #HEXCODE",
        "borderRadius": "9999px"
      }
    },
    "cards": {
      "default": {
        "background": "#FFFFFF",
        "borderRadius": "1rem",
        "padding": "2rem",
        "boxShadow": "0 4px 20px rgba(0,0,0,0.06)",
        "border": "1px solid #EDF2F7",
        "hoverTransform": "translateY(-4px)",
        "transition": "all 0.3s ease"
      }
    },
    "badges": {
      "style": {
        "background": "#HEXCODE",
        "text": "#HEXCODE",
        "borderRadius": "9999px",
        "padding": "0.375rem 1rem",
        "fontSize": "0.75rem",
        "fontWeight": "600",
        "textTransform": "uppercase"
      }
    }
  },

  "effects": {
    "shadows": {
      "sm": "0 1px 3px rgba(0,0,0,0.08)",
      "md": "0 4px 12px rgba(0,0,0,0.08)",
      "lg": "0 10px 40px rgba(0,0,0,0.1)"
    },
    "transitions": {
      "default": "all 0.2s ease",
      "smooth": "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
    }
  },

  "responsive": {
    "breakpoints": {
      "sm": "640px",
      "md": "768px",
      "lg": "1024px",
      "xl": "1280px"
    },
    "mobileAdaptations": [
      "Single column layouts",
      "Reduced heading sizes",
      "Full-width buttons",
      "Hamburger navigation"
    ]
  }
}
```

---

## 3. SECTION SPECIFICATIONS Template

### Section 1: Hero

```markdown
## Section 1: Hero

**Layout:** 2 columns (55% text / 45% visual)
**Background:** [color from design.json]

### Left Column
- **Badge** (optional): "[Category label]" - pill shape, [color] background
- **Title h1:** "[Exact title copy]"
  - Style: [font], emphasize "[word]" with [bold/italic/color]
  - Size: clamp(2.5rem, 5vw, 4rem)
- **Subtitle:** "[Exact subtitle copy]"
  - Style: text-secondary, 1.125rem, max-width 480px
- **CTA Button:** "[CTA text] →"
  - Style: pill, [color], arrow icon
- **Trust indicator:** [Social proof element below CTA]

### Right Column
[Generate] [Detailed image generation prompt]
- Style: [3D/flat/photo/illustration]
- Content: [What to show - product mockup, dashboard, etc.]
- Elements: [Floating UI cards, icons, etc.]
- Mood: [Professional/friendly/technical]
- Colors: Reference design.json palette
- NO background, transparent or subtle gradient only

### Animations
- Hero image: Subtle floating animation (translateY 10px, 3s ease-in-out infinite)
- Floating elements: Staggered fade-in on load
- CTA button: Subtle pulse or glow effect
```

### Section 2: Social Proof

```markdown
## Section 2: Social Proof

**Layout:** Centered, single row
**Background:** [color] or same as hero

### Content
- **Text:** "[Social proof copy]"
- **Logos:** [List company names] - grayscale, 60% opacity, height 24-32px

### Animation
- Logos: Fade in with stagger (0.1s delay each)
- Optional: Subtle infinite horizontal scroll on mobile
```

### Section 3: Product vs. Alternatives

```markdown
## Section 3: Product vs. Alternatives

**Layout:** [Table / Cards / Before-After]
**Background:** [alternating color from previous section]

### Header
- **Eyebrow:** "[Section label]" - badge style
- **Title h2:** "[Section title]"

### Comparison Content
[Detailed comparison structure based on chosen format]

### Animation
- Cards/rows: Stagger fade-in on scroll
- Checkmarks: Pop-in animation with slight scale
```

### Section 4: Features & Value

```markdown
## Section 4: Features & Value

**Layout:** Alternating 2-column (image left/right)
**Background:** [color]

### Header
- **Eyebrow:** "[Section label]"
- **Title h2:** "[Section title]"

### Feature 1
- **Layout:** Image left, text right
- **Image:** [Screenshot needed: description] OR [Generate: prompt]
- **Title h3:** "[Feature title]"
- **Description:** "[Feature description]"

### Feature 2
- **Layout:** Image right, text left
- [Same structure...]

### Feature 3
- [Same structure...]

### Animation
- Each feature: Fade-in-up on scroll
- Images: Subtle parallax effect
```

### Section 5: How It Works

```markdown
## Section 5: How It Works

**Layout:** Horizontal steps (desktop) / Vertical (mobile)
**Background:** [color]

### Header
- **Eyebrow:** "[Section label]"
- **Title h2:** "[Section title]"

### Steps
**Step 1:**
- Number: "1" in accent circle
- Title: "[Step title]"
- Description: "[Step description]"
- Icon: [Lucide icon name]

**Step 2:**
[Same structure...]

**Step 3:**
[Same structure...]

### Visual
- Connecting line between steps (dashed or solid)
- Icons in colored containers

### Animation
- Steps: Stagger reveal on scroll
- Connecting line: Draw animation
- Optional: [Generate] Short video showing the flow in action
```

### Section 6: Testimonials

```markdown
## Section 6: Testimonials

**Layout:** 3-column card grid (desktop) / carousel (mobile)
**Background:** [color]

### Header
- **Eyebrow:** "[Section label]"
- **Title h2:** "[Section title]"

### Testimonial Cards

**Card 1:**
- Quote: "[Full quote text]"
- Name: "[Name]"
- Role: "[Role], [Company type]"
- Avatar: [Generate] Professional headshot, [gender], [age range], [style]
- [SUGGESTION - replace with real testimonial if available]

**Card 2:**
[Same structure...]

**Card 3:**
[Same structure...]

### Card Style
- White background, rounded corners (1.5rem)
- Quote marks icon (top left, accent color, 20% opacity)
- Soft shadow, hover lift

### Animation
- Cards: Stagger fade-in
- Hover: Lift + shadow increase
```

### Section 7: Target Customers

```markdown
## Section 7: Target Customers

**Layout:** 3-4 column card grid
**Background:** [color]

### Header
- **Eyebrow:** "[Section label]"
- **Title h2:** "[Section title]"
- **Subtitle:** "[Supporting text]"

### Customer Cards

**Card 1: [Persona Name]**
- Icon: [Lucide icon] in accent container
- Title: "[Persona title]"
- Description: "[Why perfect for them]"

**Card 2:**
[Same structure...]

### Animation
- Cards: Stagger fade-in
- Icons: Subtle bounce on hover
```

### Section 8: CTA

```markdown
## Section 8: Final CTA

**Layout:** Centered, single column, max-width 600px
**Background:** [dark color for contrast]
**Text color:** White

### Content
- **Title h2:** "[Aspirational headline]"
- **Benefits list:**
  - ✓ [Benefit 1]
  - ✓ [Benefit 2]
  - ✓ [Benefit 3]
- **CTA Button:** "[CTA text] →" - inverted colors (light bg on dark section)

### Animation
- Section: Fade-in on scroll
- Checkmarks: Stagger pop-in
- Button: Subtle pulse
```

### Section 9: FAQ

```markdown
## Section 9: FAQ

**Layout:** Single column, accordion style
**Background:** [color]

### Header
- **Title h2:** "[Section title]"

### Questions (Accordion)

**Q1:** "[Question text]"
**A1:** "[Answer text]"

**Q2:** "[Question text]"
**A2:** "[Answer text]"

[Continue for all questions...]

### Accordion Style
- Closed: Question + chevron-down icon
- Open: Question bold + answer revealed + chevron-up
- Smooth height transition (0.3s ease)
- Border-bottom between items
```

### Section 10: Footer

```markdown
## Section 10: Footer

**Layout:** 4-5 column grid
**Background:** [dark or light based on design]

### Columns
**Column 1: Brand**
- Logo
- Tagline or brief description (optional)

**Column 2: Product**
- Features
- Pricing
- Integrations

**Column 3: Company**
- About
- Blog
- Careers

**Column 4: Legal**
- Privacy Policy
- Terms of Service
- Security

**Column 5: Connect** (optional)
- Social media icons
- Contact email

### Bottom Bar
- Copyright: "© [Year] [Company]. Todos os direitos reservados."
- Trust badges (if applicable)
```

---

## 4. ADDITIONAL NOTES Section

```markdown
## IMPORTANT STYLE NOTES

1. **Whitespace:** Generous spacing between all elements - sections should breathe
2. **Headlines:** Use mixed font weights for emphasis on key words
3. **Interactions:** All interactive elements need smooth hover transitions (0.2-0.3s)
4. **Cards:** Subtle lift on hover (translateY(-4px) + shadow increase)
5. **Consistency:** Maintain [X]rem border-radius across all components
6. **Rhythm:** Alternate section backgrounds to create visual flow
7. **Trust:** Position trust signals near every CTA
8. **Responsive:** Mobile-first with single-column stacking
9. **Performance:** Optimize images, use lazy loading for below-fold content
10. **Accessibility:** Ensure sufficient color contrast, focusable elements

## VIDEO/ANIMATION OPPORTUNITIES

Consider adding these motion elements for enhanced engagement:
- **Hero:** [Specific video/animation suggestion]
- **Features:** Short looping demo videos (5-10s each)
- **How it works:** Animated step transitions
- **Testimonials:** Subtle card rotation or carousel auto-play

## IMAGE GENERATION SUMMARY

All images to generate with [Midjourney/Nanobanana/Replit Image Gen]:
1. Hero: [Summary of hero image prompt]
2. Feature 1: [Summary]
3. Feature 2: [Summary]
4. Feature 3: [Summary]
5. Testimonial avatars: [Summary]
6. [Any other images needed]
```

---

## Example: Complete Section Spec

Here's a fully realized example for reference:

```markdown
## Section 1: Hero

**Layout:** 2 columns (55% text / 45% visual)
**Background:** #FFFFFF

### Left Column
- **Badge:** "Assistente Financeiro IA" - pill shape, #C4F233 background, #0A0F1C text
- **Title h1:** "O primeiro assistente financeiro com IA que realmente entende seu dinheiro"
  - Style: Inter 700, emphasize "realmente entende" with 800 weight
  - Size: clamp(2.5rem, 5vw, 4rem)
  - Letter-spacing: -0.02em
- **Subtitle:** "O único app que combina Open Finance com IA conversacional para respostas instantâneas sobre suas finanças."
  - Style: Inter 400, #4A5568, 1.125rem, max-width 480px, line-height 1.7
- **CTA Button:** "Teste grátis por 14 dias →"
  - Style: #C4F233 bg, #0A0F1C text, border-radius 9999px, padding 1rem 2rem
  - Hover: #D4FF4D bg, translateY(-2px)
- **Trust indicator:** Banco Central logo + "Open Finance Certificado" - grayscale, 60% opacity

### Right Column
[Generate] Modern 3D phone mockup showing chat interface
- Style: 3D render, slight 15° tilt, floating effect
- Content: iPhone mockup with AI chat interface visible on screen
- Elements: 2-3 floating UI cards around phone showing:
  - "Meta atingida! ✓" card (top right)
  - "Você economizou R$2.800" card (bottom left)
  - Small chart visualization (top left)
- Mood: Premium, trustworthy, innovative
- Colors: Phone in space gray, UI cards with #C4F233 accents, soft shadows
- Background: Transparent/none - elements float on white page background

### Animations
- Phone mockup: Gentle floating (translateY 0-10px, 4s ease-in-out infinite)
- Floating cards: Stagger fade-in (0.2s delay each), subtle independent float
- CTA button: Soft glow pulse on idle (box-shadow animation)
- Badge: Fade-in-down on load
```
