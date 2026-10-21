# Turning on sign-ins for crehoover.com

The site is live on GitHub Pages and works today in **preview mode**: everything can be clicked and tried, but RSVPs, posts and votes are saved only on the visitor's own device. To make them shared across the neighborhood, connect a free Supabase database. About 15 minutes, one time.

## 1. Create the database
1. Go to supabase.com and sign up with **crehoover@gmail.com** (so the HOA owns it, not one person).
2. New project. Name: `crehoover`. Region: East US. Save the database password somewhere safe.
3. Open **SQL Editor > New query**, paste everything in `supabase/schema.sql`, and click **Run**.

## 2. Set up sign-in emails
1. **Authentication > URL Configuration**: set Site URL to `https://crehoover.com` and add `https://crehoover.com/**` under Redirect URLs.
2. **Authentication > Emails > SMTP Settings**: turn on custom SMTP using the crehoover@gmail.com account (host `smtp.gmail.com`, port 465, user `crehoover@gmail.com`, password = a Google *app password* made at myaccount.google.com/apppasswords). Supabase's built-in email only sends a few messages an hour, which is not enough for 100 households.
3. Optional: edit the **Magic Link** email template so it says "Cahaba River Estates" and reads plainly.

## 3. Connect the site
1. **Project Settings > API**: copy the **Project URL** and the **anon / publishable** key.
2. On GitHub, edit `js/config.js` and paste both values in. Commit. The yellow preview banner disappears within a minute.

## 4. Make yourself the admin
1. Go to crehoover.com, open any section, enter your email, tap the link, and fill in your name.
2. In Supabase **SQL Editor**, run:
   `update profiles set approved = true, is_admin = true where name = 'Your Name';`
3. From then on, approve neighbors at **crehoover.com/admin.html** (linked in the home page footer as "Board tools"). You can also give other board members admin access there.

## What each section does
| Page | What neighbors do |
|---|---|
| Events | RSVP with one tap, pick party size, automatic waitlist when full, add to Google or iPhone calendar |
| Help Board | "I need help" and "I can help" posts, one-tap offers with a note |
| Recommend | Add contractors and restaurants by category, thumbs up/down, one vote per household, ranked by confidence |
| Care | Organizer lists days and needs, neighbors claim a slot |
| News | Board and editors post, everyone reads |
| History | Neighbors add and edit pages, every version saved, admins can restore |
| City Services | Links to My Hoover Connect and Alabama Power |

## Phase 2 (needs a small scheduled job, not built yet)
- Weekly email digest from crehoover@gmail.com
- Automatic sync of events into the crehoover Google Calendar
- Email to a poster when someone offers help (for now they see responses on the page)

## Privacy
No analytics, no ad trackers, no cookies beyond the sign-in session. Only approved households can see names, events, or posts.
