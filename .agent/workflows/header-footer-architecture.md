# Header/Footer Technical Architecture

## Overview
This document outlines the technical implementation of Location and Account-specific headers/footers, contrasting it with the existing Lab Branding system.

## Comparison of Approaches

| Feature | Lab Branding (Legacy) | Report Headers (New) |
|---------|----------------------|---------------------|
| **Target Table** | `lab_branding_assets` | `attachments` |
| **Upload Method** | Netlify Function (`branding-upload`) | Direct Supabase Client Upload |
| **Processing** | Background Job (`imagekit-process`) | Client-side HTML Wrapping |
| **Output** | Optimized Image URL | HTML Document (`.html`) |

## Why the "HTML Wrapper" Strategy?

The PDF Generation engine (`generate-pdf-from-html`) is designed to consume **HTML Content** for headers and footers to allow for rich text, layout, and variable substitution.

1.  **PDF Compatibility:** Providing a raw image URL (e.g., from ImageKit) would fail because the engine expects an HTML document.
2.  **Simplicity:** Instead of creating a complex pipeline (Upload Image -> Trigger background job -> Wrap URL in HTML -> Save), we perform this logic purely on the client side:
    - User selects image.
    - Component generates simple HTML: `<html><body style="margin:0"><img src="..." style="width:100%"/></body></html>`
    - Component uploads this HTML file.
    - Database records point to this HTML file.

## `attachments` Table Support
While the `attachments` table schema includes columns for `imagekit_url` and `processed_url`, these are currently **unused** for the Header/Footer feature. The strict requirement for HTML content makes the wrapper strategy the most robust solution for this specific use case.

## Summary
The Location Header/Footer feature uses a **distinct, optimized architecture** separate from the Lab Branding flow to ensure perfect compatibility with the reporting engine.
