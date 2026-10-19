# Forge

A personal tracker for diet, bodyweight, lifting and MCAT study, built as a static site for GitHub Pages.
It replaces the old *Training* and *MCAT schedule* spreadsheets.

- **Today:** a weigh-in, calories and protein against the current phase target (with quick-add meals), the four daily MCAT tasks, and the next workout in the rotation. A new quote and a dithered icon appear each day.
- **Lift:** a 4-day Lower/Upper split. Tap a set to log reps. Next session's weight follows the progression rule: hit every set and you add weight; stall twice and you drop 10%. Deload weeks (8, 16, 24…) are handled automatically.
- **Body:** a 7-day average against the cut/reverse/bulk plan, a weekly check, and diet history.
- **MCAT:** this week's schedule, practice-exam scores (each exam slot takes the next unscored exam), and CARS accuracy and pace.
- **Plan:** fits lifts and study blocks around your Google Calendar and writes them to a separate "Forge" calendar.

Data saves on the device first (offline-safe) and syncs through Firebase when you're signed in. See [SETUP.md](SETUP.md).

No build step. To run it locally: `python3 -m http.server` in this folder, then open http://localhost:8000.
