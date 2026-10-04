# Galuxium Nexus V2: Design System Specification

## 1. Typography Hierarchy
The design pairs a refined editorial serif with a high-legibility geometric sans:
- **Display & Headings:** `Newsreader` (Fallback: `Georgia, serif`) — Conveys statutory authority, archival paper texture, and Indian ledger heritage (*Bahi Khata*).
- **Interface & Financial Data:** `Plus Jakarta Sans` (Fallback: `Inter, sans-serif`) — Optimized for tabular data, currency numbers, and invoice itemization.
- **Ledger & Hashes:** `JetBrains Mono` (Fallback: `monospace`) — Used for GSTINs, cryptographic SHA-256 hashes, and transaction references.

### Type Scale
| Token | REM | Pixels | Line Height | Tracking | Usage |
|---|---|---|---|---|---|
| `text-2xs` | 0.6875rem | 11px | 0.875rem | +0.02em | Badges, micro-meta, hash previews |
| `text-xs` | 0.75rem | 12px | 1.0rem | +0.01em | Table headers, form labels, tooltips |
| `text-sm` | 0.875rem | 14px | 1.25rem | Normal | Body text, input fields, button labels |
| `text-base` | 1.0rem | 16px | 1.5rem | Normal | Primary reading text, lead paragraphs |
| `text-lg` | 1.125rem | 18px | 1.625rem | Normal | Subheadings, card titles |
| `text-xl` | 1.25rem | 20px | 1.75rem | -0.01em | Section headers |
| `text-2xl` | 1.5rem | 24px | 2.0rem | -0.01em | Modal headers, dashboard widgets |
| `text-3xl` | 1.875rem | 30px | 2.25rem | -0.02em | Metric highlights, feature titles |
| `text-4xl` | 2.25rem | 36px | 2.625rem | -0.025em | Page titles |
| `text-5xl` | 3.0rem | 48px | 3.25rem | -0.03em | Hero headlines |
| `text-6xl` | 3.75rem | 60px | 4.0rem | -0.035em | Display hero text |

---

## 2. Palette & Contrast Rules
Strictly warm neutrals. Zero blue, zero green.

| Role | Token | Hex | WCAG AA on `#F7F4EE` | Allowed Usage |
|---|---|---|---|---|
| Background | `warm-bg` | `#F7F4EE` | 1:1 | Page background |
| Surface | `warm-surface` | `#EFEBE3` | ~1.1:1 | Panels, tables, modal bodies |
| Raised / Card | `warm-cream` | `#F3EBD8` | ~1.2:1 | Cards, inputs, dropdowns |
| Border | `warm-sand` | `#D9D0BF` | ~1.5:1 | Dividers, card borders |
| Primary text | `warm-charcoal` | `#2B2824` | 12.8:1 (AAA) | All body, table, and heading text |
| Secondary text | `warm-taupe` | `#6E665A` | 4.8:1 (AA) | Supporting descriptions, timestamps |
| Accent | `warm-accent` | `#B08D57` | 2.8:1 (Fails body) | **Strictly icons, borders, cards, large headings (>=24px)** |
| Warning | `warm-amber` | `#C98A2B` | 3.2:1 (Fails body) | **Badges, alert icons with charcoal text** |
| Error | `warm-terracotta` | `#B5523B` | 4.6:1 (AA) | Error messages, rejection tags |
| Success / Match | `warm-bronze` | `#8A6A3B` | 4.5:1 (AA) | Matched status tags, verified checks |
