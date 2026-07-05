<h1 align="center">Jellyfin Binge Buddy</h1>

![Binge Buddy](https://raw.githubusercontent.com/cyprien-png/jellyfin-binge-buddy/master/thumbnail.png)

## About

**Binge Buddy** helps household and friend groups see what everyone has already started watching on your Jellyfin server. An admin creates **binge-watching groups**, picks which Jellyfin users belong to each group, and the web client shows buddy avatars on posters plus **progress cards** on item detail pages so you can compare where everyone left off.

Use it to plan the next watch session—or use **Watch together** to record what buddies watched on someone else's device and let them sync that progress to their own account later.

Use it to plan the next watch session: browse a library, open a movie or season, and see who has started what—and how far they are—without guessing.

## Requirements

- Jellyfin **10.11.11** or later (plugin ABI `10.11.11.0`)
- Administrative access to configure groups
- Jellyfin **web client** for overlays and detail cards

## Installation

1. Open **Dashboard → Plugins → Manage Repositories** and add a new one:
   - Name: `Binge Buddy`
   - URL: `https://raw.githubusercontent.com/Cyprien-png/jellyfin-binge-buddy/master/manifest.json`
2. Go back to **Dashboard → Plugins** and filter "All".
3. Binge Buddy must be listed. You are now able to install it.
4. After installation you must restart the server to enable the plugin (**Dashboard → Restart**).

## How It Works

### Groups

A **group** is a named list of Jellyfin users on your server (for example, “Friday Night Crew” or “Roommates”). Groups are stored in the plugin configuration and managed from the dashboard.

- Any **administrator** can create, rename, or delete groups.
- Each group has a **name** and a set of **members** selected from existing Jellyfin accounts.
- Members are stored by user ID, not username, so renames on the server do not break membership.
- A user can belong to multiple groups. When overlays are built, members from all of your groups are combined and deduplicated.

Groups do **not** change Jellyfin permissions or libraries. They only define which users Binge Buddy treats as your “buddies” for progress display.

### What counts as “started”

For each buddy, Binge Buddy reads Jellyfin **user data** for the item (or for any episode in a season). Someone counts as having **started** if any of the following is true:

- Marked as played
- Play count greater than zero
- Partial playback position saved
- A last-played date recorded

Watch history is retroactive—it counts even if someone watched **before** they were added to a group.

You never see your own avatar on poster overlays; detail cards compare **You** vs **Them** instead.

### Poster overlays

When you browse in the **Jellyfin web client**, Binge Buddy adds a small stack of profile avatars to the **top-left** of supported thumbnails:

| Item type | What it shows |
|-----------|----------------|
| **Movies** | Buddies who started that movie |
| **Episodes** | Buddies who started that episode |
| **Seasons** | Buddies who started **any episode** in that season |
| **Shows (series)** | Buddies who started **any episode** in that show |

Display rules:

- Up to **three** avatars are shown; if more buddies qualify, a **+N** badge lists the rest on hover.
- Hover an avatar or the **+N** badge to see names.

Poster overlays require the **web UI**. Mobile and TV apps do not load the injected client script.

### Detail page cards (movies, seasons & series)

On **movie**, **season**, and **series** detail pages, Binge Buddy injects a **Binge buddies** section with one card per group mate who has started the title (or any episode in the season or show).

Each card shows:

- Buddy **avatar** and **username**
- A **Progress** block comparing **You** and **Them**

For each row (**You** / **Them**), the card shows:

- A status line, for example `45m 3s watched (86%)`, `1h 45m 13s watched (86%)`, or **`Finished`**
- A rounded progress bar (**gray** for you, **coral** for them)

**Finished** follows Jellyfin’s own played state (someone can finish during credits without being at 100% of the runtime bar). The bar is shown **full** when Jellyfin marks the item as played.

#### Movies

Cards appear at the **bottom** of the details section. Progress is based on that movie’s runtime.

#### Seasons

Cards appear at the **top** of the season view (above the episode list). Progress is based on each person’s **highest started episode** in that season—for example, if a buddy is on episode 7, the card shows **Episode 7** with that episode’s watch time and percentage.

#### Series

Cards appear on the **series** detail page. Each buddy card shows their furthest started episode across the show (season and episode index, watch time, and percentage).

### Watch together

**Watch together** lets a **host** mark which group buddies are watching on their device. Binge Buddy records what was watched on the host’s Jellyfin account; when those buddies sign in later on their own devices, they get a **validation dialog** to copy the progress they care about into their own watch history.

#### Starting a session (host)

1. In the **Jellyfin web client**, start playback on the host account.
2. When prompted, open **Watch together** and select which group buddies are watching on this device.
3. On pause or stop, Binge Buddy records movies and episodes watched on the host account.

Only items watched for at least **10 seconds** (or already marked as played) are tracked for buddy sync.

#### Catching up (buddy)

The next time a buddy signs in to the web client, Binge Buddy shows a validation dialog for each host they watched with:

- **Host intro** — profile photo, name, and a short message explaining they can confirm what they watched
- **Media list** — items in **watch order** (oldest first)
  - **Movies** appear as selectable cards (thumbnail, title, watch date, progress)
  - **TV shows** are **grouped by series**: series logo over a backdrop header, with **expandable seasons** (only seasons that have episodes to validate). Episodes use the same card layout as movies.
- Buddies check the media they want to keep, then click **Continue** to apply that progress to their Jellyfin account and clear the pending queue for that host.

After validation, the web UI refreshes **poster overlays**, **Binge buddies** detail cards (including pages already open), and Jellyfin’s native progress bars where possible.

#### Watch together rules

- Requires the **web client** on both host and buddy sides.
- Pending items that are no longer in the library (or inaccessible to the buddy) are removed automatically.
- Watch dates in the validation dialog are formatted using the **Jellyfin server culture** (not necessarily the browser language).

## Features

- Create and manage binge-watching groups from the plugin settings page
- Pick members with checkboxes and profile avatars
- Avatar stacks on **movie**, **episode**, **season**, and **show** posters in the web client
- **Binge buddies** detail cards on **movie**, **season**, and **series** pages
- Side-by-side **You / Them** progress with time watched, percentage, and Jellyfin **Finished** state
- Season and series cards show the **highest started episode** and that episode’s progress
- Progress based on each user’s Jellyfin watch state (retroactive)
- **Watch together** — host records shared viewing; buddies validate and sync progress on next login
- Validation UI with host profile, grouped series/seasons, and selective media approval
- Post-validation UI refresh for overlays, detail cards, and library progress bars

## Configuration

1. Sign in to Jellyfin as an administrator.
2. Go to **Dashboard → Plugins → Binge Buddy**.
3. **Create a group**
   - Enter a name (for example, `Friday Night Crew`).
   - Click **Create group**.
4. **Add members**
   - Click **Manage group →** on the group card.
   - Check the Jellyfin users who should be in the group.
   - Click **Save members**.
5. Repeat for any other groups you need.

Each server user who should see overlays and cards must be included in at least one group with the people they watch with. Users who are not in any group with you will not appear on your UI, and you will not appear on theirs.

To remove a group, open it and use **Delete group** (with confirmation).

## Usage

After groups are configured:

1. Sign in to Jellyfin in a **browser**.
2. **Library browsing** — look at poster thumbnails for stacked buddy avatars (movies, episodes, seasons, shows).
3. **Movie details** — scroll to **Binge buddies** for You vs Them progress on that film.
4. **Season details** — **Binge buddies** appears at the top; each card shows the buddy’s furthest episode and progress.
5. **Series details** — **Binge buddies** shows each buddy’s furthest episode across the show.
6. **Watch together (host)** — when playback starts, choose buddies on this device; their pending sync is updated when you pause or stop.
7. **Watch together (buddy)** — on login, confirm watched media in the validation dialog to update your own progress.

If nothing appears for a title, no other group member has started it yet—or you may be the only one who has.

If overlays or cards do not show up after an update, try a hard refresh (**Ctrl + F5**); the plugin injects UI as Jellyfin renders each view.

## Build

1. Install the [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0).
2. From the repository root, build and publish:
   ```bash
   dotnet publish Jellyfin.Plugin.BingeBuddy/Jellyfin.Plugin.BingeBuddy.csproj --configuration Release --output bin
   ```
3. Copy the published `Jellyfin.Plugin.BingeBuddy.dll` (and related files) into your Jellyfin plugins folder and restart the server.

Plugin metadata for catalog builds is defined in [`build.yaml`](./build.yaml).

## Contributing

Contributions, issues, and feature requests are welcome.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-change`)
3. Commit your changes (`git commit -am "Add my change"`)
4. Push to the branch (`git push origin feature/my-change`)
5. Open a pull request

Refer to the [Jellyfin contributing guidelines](https://github.com/jellyfin/.github/blob/master/CONTRIBUTING.md) for more information.

## License

This plugin is licensed under the **GNU General Public License v3.0**. See [LICENSE](./LICENSE) for the full text.

![That way I'll know you stopped by](https://ws.jaquier.dev/load?app=bingebuddy-repo)
