# 🏏 Jabali Cricket Academy Management System - Project Documentation

Welcome to your new Academy ERP! This documentation is designed to help you understand, maintain, and customize your mobile-first React application.

---

## 🚀 1. Getting Started

### Prerequisites
- **Node.js**: Installed on your computer.
- **Terminal/Command Prompt**: Basic knowledge of running commands.

### Running the App Locally
1. Open the project folder in your terminal.
2. Install dependencies: `npm install`
3. Start the app: `npm run dev`
4. Open the link (usually `http://localhost:5173`) in your browser.

> [!TIP]
> To see the app as it will look on a phone, right-click on the browser page, select **Inspect**, and click the **Toggle Device Toolbar** icon (mobile icon) at the top of the inspect panel.

---

## 🛠 2. Tech Stack (The "Engine")

- **React + Vite**: The foundation of the app. Vite makes it super fast to develop and load.
- **Tailwind CSS**: Used for all styling. Instead of writing separate CSS files, we use utility classes directly in the HTML (e.g., `bg-orange-500` for an orange background).
- **Framer Motion**: Handles all smooth animations, transitions between pages, and button "pops."
- **Lucide React**: The library providing all the beautiful icons (Search, Users, Trophy, etc.).

---

## 📂 3. Project Structure

Here is a map of your files:

```text
/
├── public/                 # Static assets (logos, manifest for PWA)
├── src/
│   ├── components/         # Reusable UI parts (BottomNav, StudentDetail)
│   ├── data/               # Mock data (mockData.js - your "database")
│   ├── lib/                # Helper functions (utils.js)
│   ├── pages/              # Main screens of the app
│   │   ├── Login.jsx       # The entry screen
│   │   ├── Dashboard.jsx   # The home screen with analytics
│   │   ├── Students.jsx    # The student directory & search
│   │   ├── Attendance.jsx  # Daily attendance marking
│   │   ├── Fees.jsx        # Finance & collection overview
│   │   └── Profile.jsx     # Settings & logout
│   ├── App.jsx             # The "Brain" - handles routing and state
│   ├── App.css             # Secondary styles (mostly empty now)
│   ├── index.css           # Global styles and custom "glass" effects
│   └── main.jsx            # The entry point that starts React
├── index.html              # The main HTML wrapper
├── tailwind.config.js      # Custom theme colors and settings
└── package.json            # List of all installed tools/libraries
```

---

## 🧩 4. Key Features & Customization

### How Search Works
The search bar in `Students.jsx` is "multi-parameter." It checks the student's **Name**, **Date of Birth (DOB)**, and **Mobile Number** simultaneously. 
*   **Location**: `src/pages/Students.jsx` inside the `filteredStudents` function.

### How to Add/Edit Students
Since there is no backend (Firebase/SQL) connected yet, we use "Mock Data."
*   **File**: `src/data/mockData.js`
*   **Action**: Simply add a new object to the `students` array to see it appear in the app instantly.

### Changing the Theme Color
If you want to change the primary color again:
1. Open `tailwind.config.js`.
2. Change the hex code for `accent` or `orange`.
3. Tailwind will automatically update the entire app.

---

## 🧠 5. Deep Dive: How the App "Thinks" (State & Hooks)

If you are new to React, understanding how data flows can feel like magic. Let's break it down using simple analogies.

### A. State: The "Memory" of Your App
In React, **State** is how a component remembers things. Without state, your app would "forget" everything every time it updates.

#### 1. Global State (The Central Logbook)
**Location**: `App.jsx`
**Analogy**: Think of `App.jsx` as the **Head Office** of the academy. It keeps the "Central Logbook" for things everyone needs to know.
*   **`isLoggedIn`**: The security guard at the gate. If this is `false`, you can't enter the building (the app).
*   **`activeTab`**: The "Current Floor" indicator. It tells the elevator which floor (Dashboard, Students, etc.) to show you.
*   **`selectedStudent`**: A "Temporary File" on the manager's desk. When you click a student, their file is placed here so it can be read in the detail overlay.

**Why?** We keep these in `App.jsx` because they affect the *entire* app.
**Alternative**: If the app grows to 50+ pages, we might use **Context API** or **Redux**. These are like a "Cloud Database" that every room can access without asking the Head Office.

#### 2. Local State (The Waiter's Notepad)
**Location**: Individual pages like `Students.jsx` or `Attendance.jsx`.
**Analogy**: Think of a waiter's notepad. It's important *now*, but once the order is served, you don't need to store it in the central logbook.
*   **Search Box (`search`)**: Temporary text while you look for someone.
*   **Attendance Marks**: Temporary "check-marks" before you hit the "Save" button.

---

### B. React Hooks: The "Superpowers"
Hooks are special functions that let you "hook into" React features.

#### 1. `useState` (The Scoreboard)
*   **What it is**: `const [value, setValue] = useState(initial);`
*   **Analogy**: Imagine a **Digital Scoreboard** at a cricket match.
    *   `value`: The current score shown on the screen.
    *   `setValue`: The remote control button. When you press it, the scoreboard *automatically* flashes and updates the number.
*   **Why use it?** If you use a normal variable (like `let score = 0`), React won't know the score changed, and the screen will stay at `0`. `useState` tells React: "Hey, the data changed, please re-draw the screen!"
*   **Alternative**: In older versions of React, we had to use "Class Components" which were much more complex to write.

#### 2. `useEffect` (The Reaction)
*   **What it is**: `useEffect(() => { ... }, [dependencies]);`
*   **Analogy**: An **Automatic Night Light**. 
    *   "When it gets dark (the dependency), turn on the light (the effect)."
*   **How we use it**: In `App.jsx`, when the user successfully logs in, we trigger the `enableFullScreen()` function.
*   **Why?** It allows you to run code *outside* of the normal rendering flow (like talking to a database or changing the browser settings).
*   **Alternative**: You could trigger these things manually inside click handlers, but `useEffect` is cleaner for things that should happen "automatically" when something else changes.

#### 3. `useMemo` (The Efficient Student)
*   **What it is**: `useMemo(() => calculate(), [input]);`
*   **Analogy**: Imagine a student who has to calculate a very difficult math problem. 
    *   Instead of doing the math every time someone asks for the answer, the student writes the answer down on a piece of paper.
    *   As long as the question (input) doesn't change, they just show the paper. If the question changes, they do the math again.
*   **How we use it**: In `Students.jsx`, we use it to filter the list of 100+ students. 
*   **Why?** Filtering a long list can be slow. `useMemo` ensures we only do the "math" when you actually type in the search bar.
*   **Alternative**: You could just calculate it every time (standard variable), but as your student list grows to 1000+, the app will start to lag.

---

## 📱 6. Mobile "Native" Feel

We have implemented several tricks to make this feel like a real App:
1. **Fullscreen Logic**: In `App.jsx`, there is a function `enableFullScreen()` that triggers when you log in.
2. **PWA Manifest**: The `public/manifest.json` tells phones that this website can be "Installed" to the home screen.
3. **No-Scroll Body**: The `index.css` hides scrollbars and prevents accidental "pull-to-refresh" on mobile browsers.

---

## 💡 6. Pro Tips for Development

- **Tailwind Classes**: Use [Tailwind Cheat Sheet](https://nerdcave.com/tailwind-cheat-sheet) to find class names quickly.
- **Icons**: Search for icons at [lucide.dev](https://lucide.dev/icons).
- **Console Errors**: If the app stops working, check the browser console (Press F12) for error messages.

---

*Documentation generated for Academy ERP v1.0.4*
