# Project Overview: Topi (Cash Flow Front)

Topi is a React-based personal finance dashboard that helps users manage their bank accounts, track incomes/expenses, and plan budgets.

## Tech Stack
- **Frontend**: React (Hooks-based)
- **State Management**: Redux (with Thunk)
- **Styling**: Tailwind CSS + Vanilla CSS (for complex animations/gradients)
- **Icons**: Heroicons + Emoji-picker-react
- **Network**: Axios for API communication

## Project Structure
- `/src/components`: Reusable UI components.
  - `/dashboard`: Specific dashboard sections (Accounts, Budget).
  - `/navigation`: Sidebar, Navbar, etc.
- `/src/containers`: Main page views and business logic wrappers.
- `/src/redux`: Store configuration, actions, and reducers.
- `/src/helpers.js`: Utility functions (formatting, date parsing).
- `/src/hocs`: Higher Order Components (Layout wrappers, Onboarding logic).

## Key Patterns & Rules

### 1. Data Formatting
Always use the central helper functions in `src/helpers.js`:
- `formatCurrency(amount)`: For all monetary values.
- `capitalizeWords(string)`: For category and account names.
- `parseDatetimetoDateStrFormat(date, format)`: For consistent date display.

### 2. Redux Integration
- Dispatch actions for all data fetching (e.g., `get_user_transactions`, `get_user_extra_data`).
- Use `mapStateToProps` to connect components to the global state.

### 3. Component Design
- **Modals**: Follow the `Dialog` (from `@headlessui/react`) pattern seen in `CreateCategory` or `EditCategory`.
- **Responsive**: Ensure all new sections have both PC (`lg:flex`) and Mobile (`lg:hidden`) optimized layouts.
- **Defensive Coding**: Always check for `items` presence before mapping (e.g., `user_categories && user_categories.items`).

### 4. Style System
- Adhere to the [brand_guidelines.md](./brand_guidelines.md).
- Use Tailwind utility classes primarily.
- Maintain the "Premium" look: rounded corners, subtle shadows, and vibrant semantic colors.
