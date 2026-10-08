# Managing Spaces

A space is a set of pages kept together: in this browser, in a folder on your computer, or in a GitHub repository. Manage your spaces in **Settings > Spaces**: open the **More** menu at the bottom of the sidebar, choose **Settings**, then the **Spaces** tab.

## Creating a space

Choose **Create new space** in Settings > Spaces, then where the space lives:

- **Local**: the pages are kept in the browser's storage on this device.
- **Local folder**: the pages are Markdown files in a folder you pick (see [Platform support](platform-support.md#opening-a-folder-in-the-browser)).
- **Git**: Cept copies a repository's pages to this device.

The new space opens right away.

## What each space holds

Settings > Spaces lists every space with where it lives, its number of pages and the size of its page files, whether it is open or not. A folder space whose folder is not connected shows "pages unknown" until you reconnect its folder.

Choose **Space settings** (the gear) next to a space for its details.

## Renaming a space

In a space's details, click its name, type the new one and choose **Save**. You can also click the space name at the top of the sidebar.

A space kept as files has a `space.cept.yaml` file (see [Space configuration](../reference/space-config.md)). Renaming the space changes the `name:` line in that file and keeps the rest of the file, comments included. A comment at the end of the `name:` line itself is dropped. If Cept cannot read the file, it does not rename the space and says why; fix the file and try again. A folder space needs its folder connected to be renamed.

### The slug

The details also show the space's **slug**, a short lowercase name such as `my-notes`. Cept uses it to name the space in listings and in published links. Click it to change it. Cept warns you first: links that use the old slug stop working.

## Removing or deleting a space

Choose the trash icon next to a space, or the button at the bottom of its details. Cept always asks first, and says what happens:

| Where the space lives | The button says           | What happens                                                                                        |
| --------------------- | ------------------------- | --------------------------------------------------------------------------------------------------- |
| In this browser       | **Delete this space**     | The space and its pages are deleted for good.                                                       |
| Local folder          | **Remove from Cept**      | Cept forgets the space. The folder and its files stay on your computer, and you can open it again. |
| Git repository        | **Remove from this device** | The copy on this device is deleted, with changes not yet synced. The repository on GitHub is not changed. |

When a GitHub space has changes made on this device that are not on GitHub yet, Cept says how many and suggests syncing the space first.

You can delete any space, including your first one and your only one. When you delete your only space, a new, empty space named **My Space** takes its place. Deleting a space never deletes your settings or your other spaces.

## Signing in to GitHub

To open private repositories, sign in with a GitHub personal access token in **Settings > Settings**, under **GitHub**. A [fine-grained token](https://github.com/settings/personal-access-tokens/new) limited to the repositories you want is recommended; classic tokens also work.

Paste the token and choose **Sign in**. Cept checks it with GitHub before keeping it, then shows the account it signs in as and what the token grants: its scopes for a classic token, and when it expires. The token is stored encrypted on this device and never written to your pages.

In the browser, git traffic goes through a proxy, which can see the token when Cept clones or syncs a repository. Settings names the proxy in use.

Once signed in, adding a GitHub repository as a space uses the token, so private repositories you can read open like public ones. The token is only ever sent to github.com. If GitHub refuses access (the token was revoked, or cannot read that repository), Cept says so and asks you to sign in again here; it does not keep retrying.

### Spaces discovered on GitHub

Once you are signed in, Cept looks for spaces in every repository your token can read and lists them under **Discovered on GitHub** in **Settings > Spaces**. A space is any folder with a `space.cept.yaml` (or `space.cept.yml`) on the repository's default branch; a space that names another `branch:` in that file opens on that branch. Forks and archived repositories are not searched.

Nothing is downloaded until you choose a space:

- **Open** downloads the space and switches to it.
- **Pin** downloads it and adds it to your spaces without leaving the one you are in.

Spaces already on this device are not listed again. A space whose `space.cept.yaml` has a problem (for example, no slug) is shown with the reason and cannot be opened until it is fixed.

Cept looks again each time you sign in or start Cept with a saved token, and when you choose **Look again**. Until a new look finishes, the list from last time is shown. GitHub limits how many requests a token can make each hour; on a very large account Cept may stop before checking every repository and says so. Repositories it could not read are listed under the notes at the bottom.

If a space on this device can no longer be found (the token lost access, the space was removed, or the repository was archived), it is listed under **No longer found on GitHub**. The copy on this device is kept. Signing out forgets the list.

Each space keeps its copy of the repository on this device. Refreshing it, or opening it more than 5 minutes after the last sync, downloads only what changed on GitHub.

### Editing a GitHub space

A space you added while signed in, whose folder holds a `space.cept.yaml` (or `space.cept.yml`), is editable. Spaces added without signing in, and folders without that file, are read-only.

- Your edits are saved on this device and committed to the repository a few seconds after you stop typing, as your GitHub account (with its private `users.noreply.github.com` address). Deleting a page deletes its file in a commit.
- Cept syncs about every 30 seconds: it gets what changed on GitHub, then sends your commits. With the same space open in several tabs, only one of them syncs on its own; when you close it, another tab takes over. The other tabs' sync status updates when it syncs.
- The header shows whether the space is synced, syncing, offline, in conflict or failed to sync, how many changes are not on GitHub yet, and when it last synced. Choose **Sync now** to sync at once, in any tab. Refreshing the space also syncs it, and never throws away your changes.
- When the sync brings in changes, the page tree updates, and the page you are on reloads unless you are typing in it.
- When you sign out, the space becomes read-only until you sign in again. Changes already on this device are kept.

### When a sync meets a conflict

When you and someone else changed the same space, Cept merges the changes on its own wherever they do not overlap: different parts of a page, or different front matter keys (even on the same page). What is left is a conflict: the same lines or the same key changed both here and on GitHub, a file added on both sides, a file deleted on one side and changed on the other, or a binary file (such as an image) changed on both sides.

- The header then shows **Conflict**. Your changes stay on this device and nothing is pushed until every conflict is resolved; you can keep editing other pages.
- Choose **Resolve conflicts** to see each file with your version and the one on GitHub. Pick **Keep mine**, **Keep theirs** or **Edit merged**. Edit merged starts from both versions with conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) around what differs; remove them before applying. For a file deleted on one side, pick **Keep the file** or **Delete it**.
- When you keep one version, the other is saved next to the file as `Name (their version abc1234).md` (or `my version`), so nothing is lost. Choose **Apply and sync** to commit the merge and push it.

### When GitHub refuses the push

If the branch is protected, or the push is refused for another reason, the header shows **Sync failed** with **Push to a new branch**. Cept then pushes your changes to a new branch named `cept/<your login>/<date>-<commit>`, and the space goes back to following its own branch (without those changes) so you can open a pull request on GitHub. The conflict view offers the same, to set your changes aside instead of resolving them.

### Starting a space in a repository

Signed in, choose **Start a space in a GitHub repository** in Settings > Spaces. Pick one of your repositories (or create a new one), name the space and, if you want, a folder. Cept writes `space.cept.yaml` in that folder, commits and pushes it, and opens the space. If the folder is already a space, Cept opens it as it is.

## Working in a repository space

A link to a Markdown file on GitHub, in the form `/g/github.com/<owner>/<repo>/blob/<branch>/<path>`, opens it in Cept (see [Page links](../reference/space-config.md#page-links)). The first link into a repository adds it as a space; later links into the same repository and branch open in that space.

While a repository space is open, the **Page actions** menu at the top right has:

- **View on GitHub**: opens the page (or folder) on github.com in a new tab.
- **Refresh from remote**: downloads what changed on GitHub (in an editable space, syncs it). The page you are on stays open if the repository still has it.
- **Space settings**: opens the space's details, which show the repository, branch, path and last sync, with **Open on GitHub** and a refresh button.

Each time Cept starts it checks the saved token again. A token GitHub no longer accepts (expired or revoked) is forgotten and you are signed out. When GitHub cannot be reached, the token is kept and checked next time.

Choose **Sign out** to forget the token on this device. To revoke it, delete it on GitHub.
