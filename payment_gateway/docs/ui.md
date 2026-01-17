# UI & Frontend Documentation

The frontend dashboard is built using **React** and styled using **Vanilla CSS** (no Tailwind/Bootstrap), following a clean and minimal layout.

---

## Pages & Components

| Page | File Path | Purpose |
|------|----------|---------|
| Login | `src/pages/Login.jsx` | Merchant login screen |
| Dashboard | `src/pages/Dashboard.jsx` | Displays API credentials and key statistics |
| Transactions | `src/pages/Transactions.jsx` | Displays payment history in a table |

---

## Styling Approach

Each page has its own dedicated CSS file for better separation and easier maintenance.

| CSS File | Purpose |
|---------|---------|
| `src/styles/Login.css` | Login page layout and form styling |
| `src/styles/Dashboard.css` | Dashboard cards, credentials section, and stats grid |
| `src/styles/Transactions.css` | Table styling for transactions page |

If your project uses a different folder name for styles (example: `src/css/`), update the paths above accordingly.

---

## Design Details

### 1) Login Page (`Login.css`)
- Centered card layout with subtle shadow
- Light background with white form card
- Primary action button with hover effect

### 2) Dashboard (`Dashboard.css`)
- API credentials shown in separate cards with clear labels
- Stats shown in a responsive grid layout
- Desktop: 3-column stats grid
- Mobile: stacked layout for readability

### 3) Transactions (`Transactions.css`)
- Simple, readable table layout
- Consistent padding and row separators
- Full-width table with clean borders

---

## Responsive Design

Media queries are used to ensure mobile/tablet compatibility.

Example:

```css
@media (max-width: 900px) {
  .credentials {
    flex-direction: column;
  }

  .stats {
    grid-template-columns: 1fr;
  }
}
