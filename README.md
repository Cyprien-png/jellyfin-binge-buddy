<h1 align="center">Jellyfin Binge Buddy</h1>

![Binge Buddy](https://raw.githubusercontent.com/cyprien-png/jellyfin-binge-buddy/master/thumbnail.png)

## About

**Binge Buddy** helps household and friend groups see what everyone has already started watching on your Jellyfin server. An admin creates **binge-watching groups**, picks which Jellyfin users belong to each group, and the web client shows small avatar stacks on movie and episode posters so you can spot shared progress at a glance.

Use it to plan the next watch session: open a library, see who has already begun a title, and pick up together without guessing where everyone left off.

## Requirements

- Jellyfin **10.11.11** or later (plugin ABI `10.11.11.0`)
- Administrative access to configure groups
- Jellyfin **web client** for poster overlays

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

Groups do **not** change Jellyfin permissions or libraries. They only define which users Binge Buddy treats as your “buddies” for progress overlays.

### Poster Overlays

When you browse movies or episodes in the **Jellyfin web client**, Binge Buddy adds a small stack of profile avatars to the bottom-left of each poster.

For each title, the plugin looks at **every other member** in your groups and checks their personal Jellyfin play state for that item. A member is shown if they have **started** the title, meaning any of the following is true in their user data:

- Marked as played
- Play count greater than zero
- Partial playback position saved
- A last-played date recorded

Watch history is read from Jellyfin’s user data store, so progress counts even if someone watched **before** they were added to a group.

Display rules:

- You never see your own avatar on a poster only other group members.
- Up to **three** avatars are shown. If more buddies started the title, a **+N** badge appears for the rest.
- Overlays appear on **movies and episodes** only (not folders, collections, or other item types).

The overlay feature requires the **web UI**. Other Jellyfin clients (mobile apps, TV apps, etc.) do not load the injected client script.

## Features

- Create and manage binge-watching groups from the plugin settings page
- Pick members with checkboxes and profile avatars
- Avatar stacks on movie and episode posters in the web client
- Progress based on each user’s Jellyfin watch state (retroactive)

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

Each server user who should see overlays must be included in at least one group with the people they watch with. Users who are not in any group with you will not appear on your posters, and you will not appear on theirs.

To remove a group, open it and use **Delete group** (with confirmation).

## Usage

After groups are configured:

1. Sign in to Jellyfin in a **browser**.
2. Open a movies or TV library.
3. Look at the bottom-left of posters for stacked buddy avatars.
4. Hover avatars or the **+N** badge to see names.

If no avatars appear on a title, no other member of your groups has started it yet or you may be the only member who has.

## Build

1. Install the [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0).
2. From the repository root, build and publish:
   ```bash
   dotnet publish Jellyfin.Plugin.Template/Jellyfin.Plugin.Template.csproj --configuration Release --output bin
   ```
3. Copy the published `Jellyfin.Plugin.Template.dll` into your Jellyfin plugins folder and restart the server.

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