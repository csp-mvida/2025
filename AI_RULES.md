# AI Development Rules - CSP Project

## Tech Stack
*   **React 19**: Modern UI library using functional components and hooks.
*   **TypeScript**: Strict type checking for all components, services, and utilities.
*   **Vite**: Ultra-fast build tool and development server.
*   **Tailwind CSS**: Utility-first CSS framework for all styling and responsive design.
*   **Supabase**: Backend-as-a-Service for PostgreSQL database and file storage.
*   **jsPDF**: Client-side library for generating PDF summaries of payment requests.
*   **Custom UI System**: A set of cohesive, accessible components located in `src/components/ui/`.

## Coding & Architectural Rules

### 1. UI & Styling
*   **Tailwind Exclusively**: Never write raw CSS. Use Tailwind classes for all layouts, spacing, and colors.
*   **Reusable Components**: Always check `src/components/ui/` before creating new inputs, buttons, or icons.
*   **Icons**: All icons must be sourced from or added to `src/components/ui/Icons.tsx` to maintain consistency.

### 2. State & Data
*   **Local State**: Use React `useState` and `useEffect` for form flow and UI state.
*   **Services Layer**: All API calls (Supabase, external fetch) must reside in `src/services/api.ts`. Never call `supabase` directly inside components.
*   **Formatting**: Use `src/utils/formatters.ts` for any currency (BRL), phone number, or date manipulation to ensure system-wide uniformity.

### 3. Forms & Validation
*   **Step-by-Step Flow**: Maintain the Stepper architecture for complex forms.
*   **Validation**: Implement field-level validation that provides immediate feedback via the `error` prop in UI components.
*   **Drafts**: Persist unsaved form data to `localStorage` to prevent data loss on refresh.

### 4. Database & Storage
*   **Naming Convention**: Use `snake_case` for database columns (matching Supabase) and `camelCase` for TypeScript interfaces.
*   **Public URLs**: When uploading files to Supabase Storage, always retrieve and store the Public URL for administration access.

### 5. PDF Generation
*   **Templates**: Use the `src/utils/pdfGenerator.ts` utility for any document generation to maintain the institutional brand identity (colors, fonts).